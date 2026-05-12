import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from google.cloud import bigquery
from google.cloud.firestore import FieldFilter, Query

from .data_config import CANONICAL_COLUMN_ORDER, DATASET_COLUMN_CONFIG, dataset_schema
from .firebase import bucket, cred_path, db
from functools import lru_cache


BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

# Just in case there are issues with pcard/onecard naming
DATASET_ALIASES = {
    "amazon": "amazon",
    "cruzbuy": "cruzbuy",
    "onecard": "onecard",
    "pcard": "onecard",
    "bookstore": "bookstore",
    "overall": "overall",
}

# To be changed later when there are less storage paths in Storage
HARDCODED_STORAGE_PATHS = {
    "amazon": "clean/amazon/amazon_clean_20260305_050239.csv",
    "bookstore": "clean/bookstore/bookstore_clean_20260305_050239.csv",
    "cruzbuy": "clean/cruzbuy/cruzbuy_clean_20260305_050239.csv",
    "onecard": "clean/onecard/onecard_clean_20260305_050239.csv",
}

SEARCH_TOKEN_PATTERN = re.compile(r'(\w+):"([^"]+)"|(\w+):(\S+)')
CANONICAL_SQL_ALIASES = {
    "Transaction Date": "transaction_date",
    "Item Name": "item_name",
    "Item Description": "item_description",
    "Category": "category",
    "Subcategory": "subcategory",
    "Subtotal": "subtotal",
    "Sales Tax": "sales_tax",
    "Total Price": "total_price",
    "Quantity": "quantity",
    "Merchant Name": "merchant_name",
    "Merchant State": "merchant_state",
    "Merchant City": "merchant_city",
    "Merchant Type": "merchant_type",
    "Transaction Type": "transaction_type",
}

# For Amazon, we want to group all gift cards together since they can be purchased from various vendors but are essentially the same item for analysis purposes.
# User Story 5.4 should build off of this logic and condense data within various groups
AMAZON_GIFT_CARD_CATEGORIES = (
    "Electronic Gift Card",
    "Gift Card",
    "Target Gift Card",
    "ACD Gift Card",
)

CONDENSED_PURCHASE_GROUP_RULES = (
    ("Gift Cards", r"(?i)\\b|gift\\s*cards?\\b|giftcard"),
    ("AT&T Bills", r"(?i)\\bat\\s*&\\s*t\\b|\\batt\\b|\\bat and t\\b|wireless bill|mobility bill"),
    ("Food Bulk Purchases", r"(?i)(bulk|case|pack).*(food|grocery|snack|beverage)|\\b(food|grocery|snack|beverage)\\b.*(bulk|case|pack)|costco wholesale"),
    ("Order Summaries", r"(?i)order summary|order total|summary line|invoice summary"),
    ("Business Services", r"(?i)business service|professional service|consulting|subscription service|software service|service fee"),
)


def _bq_column_name(column_name: str) -> str:
    """Convert a display column name into the sanitized BigQuery CSV field name."""
    normalized = re.sub(r"[^A-Za-z0-9_]", "_", column_name.strip())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    if not normalized:
        raise ValueError(f"Invalid BigQuery column name derived from '{column_name}'")
    return normalized


def _normalize_dataset(dataset: str) -> str:
    """Resolve a requested dataset name or alias into the canonical dataset key."""
    normalized = DATASET_ALIASES.get((dataset or "overall").strip().lower())
    if not normalized:
        raise ValueError(f"Unsupported dataset '{dataset}'")
    return normalized


def _amazon_gift_card_condition() -> str:
    """Build the SQL condition used to collapse Amazon gift-card categories."""
    category_name = _bq_column_name("Category")
    quoted = ", ".join([f"'{value.upper()}'" for value in AMAZON_GIFT_CARD_CATEGORIES])
    return f"UPPER(TRIM(CAST(`{category_name}` AS STRING))) IN ({quoted})"


def _latest_upload_metadata(dataset: str) -> Optional[Dict[str, Any]]:
    """Return the storage metadata for the dataset CSV BigQuery should read."""
    if dataset in HARDCODED_STORAGE_PATHS:
        return {
            "upload_id": f"hardcoded-{dataset}",
            "dataset": dataset,
            "storagePath": HARDCODED_STORAGE_PATHS[dataset],
        }

    docs = (
        db.collection("uploads")
        .where(filter=FieldFilter("dataset", "==", dataset))
        .order_by("createdAt", direction=Query.DESCENDING)
        .limit(1)
        .stream()
    )
    latest = next(docs, None)
    if not latest:
        return None

    payload = latest.to_dict()
    payload["upload_id"] = latest.id
    return payload


def _build_external_config(storage_uri: str) -> bigquery.ExternalConfig:
    """Create a BigQuery external table config for a CSV in Cloud Storage."""
    config = bigquery.ExternalConfig("CSV")
    config.source_uris = [storage_uri]
    config.autodetect = True
    config.options.skip_leading_rows = 1
    config.options.allow_quoted_newlines = True
    return config


def _storage_uri(storage_path: str) -> str:
    """Convert a Firebase Storage object path into a gs:// URI."""
    bucket_name = bucket.name
    return f"gs://{bucket_name}/{storage_path.lstrip('/')}"


def _parse_search_query(search_query: str) -> Dict[str, Any]:
    """Split search text into free-text filters and field-specific query tokens."""
    raw = (search_query or "").strip()
    if not raw:
        return {"free_text": "", "item_terms": [], "vendor_terms": [], "year": None}

    tokenized = raw
    item_terms: List[str] = []
    vendor_terms: List[str] = []
    year: Optional[str] = None
    quarter: Optional[str] = None

    for match in SEARCH_TOKEN_PATTERN.finditer(raw):
        key = (match.group(1) or match.group(3) or "").strip().lower()
        value = (match.group(2) or match.group(4) or "").strip()
        if not key or not value:
            continue

        if key in {"item", "name"}:
            item_terms.append(value)
        elif key in {"vendor", "merchant", "supplier"}:
            vendor_terms.append(value)
        elif key == "year":
            year = value
        elif key == "quarter":
            quarter = value

        tokenized = tokenized.replace(match.group(0), " ")

    free_text = " ".join(tokenized.split())
    return {
        "free_text": free_text,
        "item_terms": item_terms,
        "vendor_terms": vendor_terms,
        "year": year,
        "quarter": quarter,
    }


def _amount_expression(column_name: str) -> str:
    """Build SQL that safely parses a currency or numeric-looking column as FLOAT64."""
    resolved_name = _bq_column_name(column_name)
    return (
        "SAFE_CAST("
        f"REGEXP_REPLACE(CAST(`{resolved_name}` AS STRING), r'[^0-9.-]', '')"
        " AS FLOAT64)"
    )


def _string_expression(column_name: str) -> str:
    """Build SQL that trims a column and treats blank strings as NULL."""
    resolved_name = _bq_column_name(column_name)
    return f"NULLIF(TRIM(CAST(`{resolved_name}` AS STRING)), '')"


def _year_expression(column_name: str) -> str:
    """Build SQL that extracts a four-digit year from a date-like column."""
    resolved_name = _bq_column_name(column_name)
    return (
        f"REGEXP_EXTRACT(CAST(`{resolved_name}` AS STRING), r'(?:19|20)\\d{{2}}')"
    )

def _normalized_quarter(selected_quarter: Optional[str]) -> str:
    """Normalize quarter labels from the UI/search into supported values."""
    raw = (selected_quarter or "All Quarters").strip().lower()

    mapping = {
        "all quarters": "All Quarters",
        "all": "All Quarters",
        "fall": "Fall",
        "winter": "Winter",
        "spring": "Spring",
        "summer": "Summer",
    }

    return mapping.get(raw, "All Quarters")


def _quarter_case_expression(date_expr: str) -> str:
    """Return BigQuery SQL that maps a parsed DATE to the custom academic quarter."""
    return f"""
        CASE
          WHEN (
            (EXTRACT(MONTH FROM {date_expr}) = 9 AND EXTRACT(DAY FROM {date_expr}) >= 15)
            OR EXTRACT(MONTH FROM {date_expr}) IN (10, 11, 12)
          ) THEN 'Fall'
          WHEN (
            EXTRACT(MONTH FROM {date_expr}) IN (1, 2)
            OR (EXTRACT(MONTH FROM {date_expr}) = 3 AND EXTRACT(DAY FROM {date_expr}) <= 20)
          ) THEN 'Winter'
          WHEN (
            (EXTRACT(MONTH FROM {date_expr}) = 3 AND EXTRACT(DAY FROM {date_expr}) >= 21)
            OR EXTRACT(MONTH FROM {date_expr}) IN (4, 5)
            OR (EXTRACT(MONTH FROM {date_expr}) = 6 AND EXTRACT(DAY FROM {date_expr}) <= 20)
          ) THEN 'Spring'
          ELSE 'Summer'
        END
    """.strip()


def _parsed_date_expression(column_name: str) -> str:
    """Build SQL that parses a cleaned YYYY-MM-DD date column into DATE."""
    resolved_name = _bq_column_name(column_name)
    return f"SAFE.PARSE_DATE('%Y-%m-%d', CAST(`{resolved_name}` AS STRING))"

def _numeric_expression(column_name: str) -> str:
    """Alias numeric field handling to the shared amount parsing SQL."""
    return _amount_expression(column_name)


def _source_field_expression(dataset: str, canonical_name: str) -> str:
    """Build the SELECT expression for one canonical output field."""
    column_config = DATASET_COLUMN_CONFIG[dataset]["columns"][canonical_name]
    cleaned_name = column_config["cleaned_name"]
    alias = CANONICAL_SQL_ALIASES[canonical_name]
    is_numeric = canonical_name in {"Subtotal", "Sales Tax", "Total Price", "Quantity"}
    if not column_config["available"] or not cleaned_name:
        null_type = "FLOAT64" if is_numeric else "STRING"
        return f"CAST(NULL AS {null_type}) AS {alias}"

    if is_numeric:
        return f"{_numeric_expression(cleaned_name)} AS {alias}"

    return f"{_string_expression(cleaned_name)} AS {alias}"


def _source_select_sql(table_name: str, dataset: str) -> str:
    """Build the normalized source SELECT for one dataset external table."""
    config = DATASET_COLUMN_CONFIG[dataset]["bigquery"]
    metric_col = config["metric_column"]
    date_col = config["date_column"]
    amazon_gift_card_condition = _amazon_gift_card_condition() if dataset == "amazon" else None

    item_candidates = ", ".join(
        [_string_expression(column) for column in config["item_candidates"]]
    )
    vendor_candidates = ", ".join(
        [_string_expression(column) for column in config["vendor_candidates"]]
    )
    canonical_fields = ",\n          ".join(
        _source_field_expression(dataset, canonical_name)
        for canonical_name in CANONICAL_COLUMN_ORDER
    )
    clean_item_name_expression = f"COALESCE({item_candidates}, 'Unknown Item')"
    if amazon_gift_card_condition:
        clean_item_name_expression = (
            f"CASE WHEN {amazon_gift_card_condition} THEN 'Gift Cards' "
            f"ELSE {clean_item_name_expression} END"
        )

        canonical_fields = canonical_fields.replace(
            _source_field_expression(dataset, "Item Description"),
            "CASE WHEN "
            + amazon_gift_card_condition
            + " THEN 'Gift Cards' ELSE "
            + _string_expression("Item Description")
            + " END AS item_description",
        )
        canonical_fields = canonical_fields.replace(
            _source_field_expression(dataset, "Category"),
            "CASE WHEN "
            + amazon_gift_card_condition
            + " THEN 'Gift Cards' ELSE "
            + _string_expression("Category")
            + " END AS category",
        )

    parsed_date_expression = _parsed_date_expression(date_col)

    return f"""
        SELECT
          '{dataset}' AS dataset,
          {clean_item_name_expression} AS clean_item_name,
          COALESCE({vendor_candidates}, 'Unknown') AS vendor_name,
          {_amount_expression(metric_col)} AS amount,
          {_year_expression(date_col)} AS transaction_year,
          {_numeric_expression('Quantity')} AS item_quantity,
          {parsed_date_expression} AS parsed_transaction_date,
          {_quarter_case_expression(parsed_date_expression)} AS transaction_quarter,
          {canonical_fields}
        FROM `{table_name}`
    """.strip()


def _build_search_where(parsed_query: Dict[str, Any], category_originals: Optional[List[str]] = None) -> str:
    """Build the WHERE clause used for year, text, item, vendor, and category filters."""
    clauses = [
        "clean_item_name IS NOT NULL",
        "clean_item_name != ''",
        "parsed_transaction_date IS NOT NULL",
        "(@selected_year = 'All Time' OR transaction_year = @selected_year)",
        "(@selected_quarter = 'All Quarters' OR transaction_quarter = @selected_quarter)",
    ]

    if parsed_query["free_text"]:
        clauses.append(
            "("
            "LOWER(clean_item_name) LIKE CONCAT('%', LOWER(@free_text), '%') "
            "OR LOWER(vendor_name) LIKE CONCAT('%', LOWER(@free_text), '%')"
            ")"
        )

    for index, _ in enumerate(parsed_query["item_terms"]):
        clauses.append(
            f"LOWER(clean_item_name) LIKE CONCAT('%', LOWER(@item_term_{index}), '%')"
        )

    for index, _ in enumerate(parsed_query["vendor_terms"]):
        clauses.append(
            f"LOWER(vendor_name) LIKE CONCAT('%', LOWER(@vendor_term_{index}), '%')"
        )

    if category_originals:
        clauses.append("LOWER(COALESCE(category, '')) IN UNNEST(@category_list)")

    return " AND ".join(clauses)


def _condensed_group_case_expression(source_alias: str = "") -> str:
    """Build SQL CASE that maps noisy/repetitive purchases into high-level groups."""
    prefix = f"{source_alias}." if source_alias else ""
    searchable_text = (
        f"LOWER(CONCAT(' ', "
        f"COALESCE({prefix}clean_item_name, ''), ' ', "
        f"COALESCE({prefix}category, ''), ' ', "
        f"COALESCE({prefix}subcategory, ''), ' ', "
        f"COALESCE({prefix}item_description, ''), ' ', "
        f"COALESCE({prefix}merchant_name, ''), ' ', "
        f"COALESCE({prefix}vendor_name, ''), ' '))"
    )

    cases = "\n".join(
        f"WHEN REGEXP_CONTAINS({searchable_text}, r\"{pattern}\") THEN '{label}'"
        for label, pattern in CONDENSED_PURCHASE_GROUP_RULES
    )
    return f"CASE\n{cases}\nELSE NULL END"


def _query_parameters(
    *,
    selected_year: str,
    selected_quarter: str,
    min_spend: float,
    limit: int,
    parsed_query: Dict[str, Any],
    category_originals: Optional[List[str]] = None,
) -> List[bigquery.ScalarQueryParameter]:
    """Create parameter bindings for the top-items BigQuery request."""
    params: List[bigquery.QueryParameter] = [
        bigquery.ScalarQueryParameter("selected_year", "STRING", selected_year),
        bigquery.ScalarQueryParameter("selected_quarter", "STRING", selected_quarter),
        bigquery.ScalarQueryParameter("min_spend", "FLOAT64", float(min_spend or 0)),
        bigquery.ScalarQueryParameter("limit", "INT64", int(limit)),
        bigquery.ScalarQueryParameter("free_text", "STRING", parsed_query["free_text"]),
    ]

    for index, value in enumerate(parsed_query["item_terms"]):
        params.append(bigquery.ScalarQueryParameter(f"item_term_{index}", "STRING", value))

    for index, value in enumerate(parsed_query["vendor_terms"]):
        params.append(bigquery.ScalarQueryParameter(f"vendor_term_{index}", "STRING", value))

    if category_originals:
        params.append(bigquery.ArrayQueryParameter("category_list", "STRING", category_originals))

    return params


def _bigquery_client() -> bigquery.Client:
    """Create an authenticated BigQuery client from project env vars and service credentials."""
    project_id = (
        os.getenv("BIGQUERY_PROJECT_ID")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("VITE_FIREBASE_PROJECT_ID")
    )
    if not project_id:
        raise ValueError(
            "Set BIGQUERY_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or VITE_FIREBASE_PROJECT_ID in the root .env"
        )

    location = os.getenv("BIGQUERY_LOCATION")
    return bigquery.Client.from_service_account_json(
        cred_path,
        project=project_id,
        location=location,
    )


def _serialize_vendors(vendors: Any) -> List[Dict[str, Any]]:
    """Convert BigQuery vendor structs into JSON-safe vendor dictionaries."""
    serialized: List[Dict[str, Any]] = []
    for vendor in vendors or []:
        if vendor is None:
            continue
        serialized.append(
            {
                "name": vendor.get("name", "Unknown"),
                "count": int(vendor.get("count") or 0),
                "spend": round(float(vendor.get("spend") or 0), 2),
            }
        )
    return serialized


def _representative_text_field(alias: str) -> str:
    """Build SQL that picks one representative non-null text value per grouped item."""
    return (
        f"ARRAY_AGG({alias} IGNORE NULLS ORDER BY {alias} LIMIT 1)[SAFE_OFFSET(0)] AS {alias}"
    )


def _serialize_row_values(row: Any) -> Dict[str, Any]:
    """Serialize canonical row fields from a BigQuery result row for the frontend table."""
    row_values: Dict[str, Any] = {}
    for canonical_name in CANONICAL_COLUMN_ORDER:
        alias = CANONICAL_SQL_ALIASES[canonical_name]
        value = row.get(alias)
        if isinstance(value, float):
            row_values[canonical_name] = round(value, 2)
        else:
            row_values[canonical_name] = value
    return row_values


def _serialize_drilldown_items(items: Any) -> List[Dict[str, Any]]:
    """Convert nested BigQuery drilldown structs into JSON-safe dictionaries."""
    serialized: List[Dict[str, Any]] = []
    for item in items or []:
        if item is None:
            continue

        row_values = {
            "Item Name": item.get("item_name"),
            "Item Description": item.get("item_description"),
            "Category": item.get("category"),
            "Subcategory": item.get("subcategory"),
            "Merchant Name": item.get("merchant_name"),
            "Merchant Type": item.get("merchant_type"),
        }

        serialized.append(
            {
                "clean_item_name": item.get("clean_item_name", ""),
                "count": int(item.get("count") or 0),
                "total_spent": round(float(item.get("total_spent") or 0), 2),
                "vendors": _serialize_vendors(item.get("vendors")),
                "row_values": row_values,
            }
        )

    return serialized


def _serialize_detail_rows(rows: Any) -> List[Dict[str, Any]]:
    """Convert nested BigQuery raw-row structs into JSON-safe dictionaries."""
    serialized: List[Dict[str, Any]] = []
    for row in rows or []:
        if row is None:
            continue

        serialized.append(
            {
                "row_values": _serialize_row_values(row),
            }
        )

    return serialized


def query_top_items_from_bigquery(
    *,
    dataset: str = "overall",
    search_query: str = "",
    selected_year: str = "All Time",
    selected_quarter: str = "All Quarters",
    min_spend: float = 0,
    limit: int = 20,
    sort_mode: str = "frequency",
    group_by: str = "item",
    category_originals: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Query BigQuery external CSV tables for filtered and ranked top items."""
    normalized_dataset = _normalize_dataset(dataset)
    parsed_query = _parse_search_query(search_query)
    chosen_sort_mode = (sort_mode or "frequency").strip().lower()
    chosen_group_by = (group_by or "item").strip().lower()
    if chosen_sort_mode not in {"frequency", "cost"}:
        raise ValueError("sort_mode must be one of: frequency, cost")
    if chosen_group_by not in {"item", "merchant", "category"}:
        raise ValueError("group_by must be one of: item, merchant, category")
    if parsed_query["year"] and selected_year == "All Time":
        selected_year = parsed_query["year"]
    if parsed_query.get("quarter") and selected_quarter == "All Quarters":
        selected_quarter = parsed_query["quarter"]

    selected_quarter = _normalized_quarter(selected_quarter)

    datasets = (
        ["amazon", "cruzbuy", "onecard", "bookstore"]
        if normalized_dataset == "overall"
        else [normalized_dataset]
    )

    table_definitions: Dict[str, bigquery.ExternalConfig] = {}
    source_queries: List[str] = []
    storage_paths: Dict[str, str] = {}

    for current_dataset in datasets:
        latest_upload = _latest_upload_metadata(current_dataset)
        if not latest_upload or not latest_upload.get("storagePath"):
            continue

        table_name = f"{current_dataset}_ext"
        storage_paths[current_dataset] = latest_upload["storagePath"]
        table_definitions[table_name] = _build_external_config(
            _storage_uri(latest_upload["storagePath"])
        )
        source_queries.append(_source_select_sql(table_name, current_dataset))

    if not source_queries:
        return {
            "items": [],
            "dataset": normalized_dataset,
            "selected_year": selected_year,
            "search_query": search_query,
            "schema": dataset_schema(normalized_dataset),
            "storage_paths": storage_paths,
            "warnings": ["No uploaded CSV files with storage paths were found for the selected dataset."],
        }

    if chosen_group_by == "item":
        order_by_clause = (
            "ir.count DESC, ir.total_spent DESC, ir.dataset, ir.display_item_name"
            if chosen_sort_mode == "frequency"
            else "ir.total_spent DESC, ir.count DESC, ir.dataset, ir.display_item_name"
        )

        condensed_group_case = _condensed_group_case_expression("fs")

        sql = f"""
        WITH source_data AS (
          {' UNION ALL '.join(source_queries)}
        ),
        filtered_source AS (
          SELECT *
          FROM source_data
          WHERE {_build_search_where(parsed_query, category_originals)}
        ),
                classified_source AS (
                    SELECT
                        fs.*,
                        {condensed_group_case} AS condensed_group,
                        COALESCE({condensed_group_case}, fs.clean_item_name) AS display_item_name
                    FROM filtered_source fs
                ),
                subitem_vendor_rollup AS (
                    SELECT
                        dataset,
                        display_item_name,
                        clean_item_name,
                        IFNULL(NULLIF(vendor_name, ''), 'Unknown') AS vendor_name,
                        COUNT(*) AS vendor_count,
                        ROUND(SUM(IFNULL(amount, 0)), 2) AS vendor_spend
                    FROM classified_source
                    GROUP BY dataset, display_item_name, clean_item_name, vendor_name
                ),
                subitem_vendor_arrays AS (
                    SELECT
                        dataset,
                        display_item_name,
                        clean_item_name,
                        ARRAY_AGG(
                            STRUCT(
                                vendor_name AS name,
                                vendor_count AS count,
                                vendor_spend AS spend
                            )
                            ORDER BY vendor_spend DESC, vendor_count DESC, vendor_name
                        ) AS vendors
                    FROM subitem_vendor_rollup
                    GROUP BY dataset, display_item_name, clean_item_name
                ),
                subitem_rollup AS (
                    SELECT
                        dataset,
                        display_item_name,
                        clean_item_name,
                        COUNT(*) AS count,
                        MAX(transaction_date) AS transaction_date,
                        {_representative_text_field('item_name')},
                        {_representative_text_field('item_description')},
                        {_representative_text_field('category')},
                        {_representative_text_field('subcategory')},
                        {_representative_text_field('merchant_name')},
                        {_representative_text_field('merchant_type')},
                        ROUND(SUM(IFNULL(amount, 0)), 2) AS total_spent
                    FROM classified_source
                    GROUP BY dataset, display_item_name, clean_item_name
                ),
                drilldown_arrays AS (
                    SELECT
                        sr.dataset,
                        sr.display_item_name,
                        ARRAY_AGG(
                            STRUCT(
                                sr.clean_item_name AS clean_item_name,
                                sr.count AS count,
                                sr.total_spent AS total_spent,
                                sr.item_name AS item_name,
                                sr.item_description AS item_description,
                                sr.category AS category,
                                sr.subcategory AS subcategory,
                                sr.merchant_name AS merchant_name,
                                sr.merchant_type AS merchant_type,
                                sva.vendors AS vendors
                            )
                            ORDER BY sr.total_spent DESC, sr.count DESC, sr.clean_item_name
                        ) AS drilldown_items
                    FROM subitem_rollup sr
                    LEFT JOIN subitem_vendor_arrays sva
                        ON sr.dataset = sva.dataset
                        AND sr.display_item_name = sva.display_item_name
                        AND sr.clean_item_name = sva.clean_item_name
                    GROUP BY sr.dataset, sr.display_item_name
                ),
                raw_row_arrays AS (
                    SELECT
                        dataset,
                        display_item_name,
                        ARRAY_AGG(
                            STRUCT(
                                transaction_date,
                                item_name,
                                item_description,
                                category,
                                subcategory,
                                subtotal,
                                sales_tax,
                                total_price,
                                quantity,
                                merchant_name,
                                merchant_state,
                                merchant_city,
                                merchant_type,
                                transaction_type
                            )
                            ORDER BY transaction_date DESC, total_price DESC, item_description
                        ) AS raw_rows
                    FROM classified_source
                    GROUP BY dataset, display_item_name
                ),
        vendor_rollup AS (
          SELECT
            dataset,
                        display_item_name,
            IFNULL(NULLIF(vendor_name, ''), 'Unknown') AS vendor_name,
            COUNT(*) AS vendor_count,
            ROUND(SUM(IFNULL(amount, 0)), 2) AS vendor_spend
                    FROM classified_source
                    GROUP BY dataset, display_item_name, vendor_name
        ),
        vendor_arrays AS (
          SELECT
            dataset,
                        display_item_name,
            ARRAY_AGG(
              STRUCT(
                vendor_name AS name,
                vendor_count AS count,
                vendor_spend AS spend
              )
              ORDER BY vendor_spend DESC, vendor_count DESC, vendor_name
            ) AS vendors
          FROM vendor_rollup
                    GROUP BY dataset, display_item_name
        ),
        item_rollup AS (
          SELECT
            dataset,
                        display_item_name,
                        ARRAY_AGG(condensed_group IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS condensed_group,
            COUNT(*) AS count,
            MAX(transaction_date) AS transaction_date,
            {_representative_text_field('item_name')},
            {_representative_text_field('item_description')},
            {_representative_text_field('category')},
            {_representative_text_field('subcategory')},
            ROUND(SUM(IFNULL(subtotal, 0)), 2) AS subtotal,
            ROUND(SUM(IFNULL(sales_tax, 0)), 2) AS sales_tax,
            ROUND(SUM(IFNULL(total_price, 0)), 2) AS total_price,
            ROUND(SUM(IFNULL(quantity, 0)), 2) AS quantity,
            {_representative_text_field('merchant_name')},
            {_representative_text_field('merchant_state')},
            {_representative_text_field('merchant_city')},
            {_representative_text_field('merchant_type')},
            {_representative_text_field('transaction_type')},
            ROUND(SUM(IFNULL(amount, 0)), 2) AS total_spent,
            ROUND(
              SUM(IFNULL(amount, 0)) / NULLIF(SUM(IFNULL(item_quantity, 0)), 0),
              2
            ) AS cost_per_item
                    FROM classified_source
                    GROUP BY dataset, display_item_name
        )
        SELECT
          ir.dataset,
                    ir.display_item_name AS clean_item_name,
                    ir.condensed_group,
                    ir.condensed_group IS NOT NULL AS is_condensed,
          ir.count,
          ir.transaction_date,
          ir.item_name,
          ir.item_description,
          ir.category,
          ir.subcategory,
          ir.subtotal,
          ir.sales_tax,
          ir.total_price,
          ir.quantity,
          ir.cost_per_item,
          ir.merchant_name,
          ir.merchant_state,
          ir.merchant_city,
          ir.merchant_type,
          ir.transaction_type,
          ir.total_spent,
                    va.vendors,
                    da.drilldown_items,
                    rra.raw_rows
        FROM item_rollup ir
        LEFT JOIN vendor_arrays va
          ON ir.dataset = va.dataset
                    AND ir.display_item_name = va.display_item_name
                LEFT JOIN drilldown_arrays da
                    ON ir.dataset = da.dataset
                    AND ir.display_item_name = da.display_item_name
                LEFT JOIN raw_row_arrays rra
                    ON ir.dataset = rra.dataset
                    AND ir.display_item_name = rra.display_item_name
        WHERE ir.total_spent >= @min_spend
        ORDER BY {order_by_clause}
        LIMIT @limit
    """
    else:
        group_expr = (
            "IFNULL(NULLIF(vendor_name, ''), 'Unknown')"
            if chosen_group_by == "merchant"
            else "IFNULL(NULLIF(category, ''), 'Unknown')"
        )
        order_by_clause = (
            "gr.count DESC, gr.total_spent DESC, gr.dataset, gr.group_name"
            if chosen_sort_mode == "frequency"
            else "gr.total_spent DESC, gr.count DESC, gr.dataset, gr.group_name"
        )

        sql = f"""
        WITH source_data AS (
          {' UNION ALL '.join(source_queries)}
        ),
        filtered_source AS (
          SELECT *
          FROM source_data
          WHERE {_build_search_where(parsed_query, category_originals)}
        ),
        grouped_rollup AS (
          SELECT
            dataset,
            {group_expr} AS group_name,
            COUNT(*) AS count,
            MAX(transaction_date) AS transaction_date,
            {_representative_text_field('item_name')},
            {_representative_text_field('item_description')},
            {_representative_text_field('category')},
            {_representative_text_field('subcategory')},
            ROUND(SUM(IFNULL(subtotal, 0)), 2) AS subtotal,
            ROUND(SUM(IFNULL(sales_tax, 0)), 2) AS sales_tax,
            ROUND(SUM(IFNULL(total_price, 0)), 2) AS total_price,
            ROUND(SUM(IFNULL(quantity, 0)), 2) AS quantity,
            {_representative_text_field('merchant_name')},
            {_representative_text_field('merchant_state')},
            {_representative_text_field('merchant_city')},
            {_representative_text_field('merchant_type')},
            {_representative_text_field('transaction_type')},
            ROUND(SUM(IFNULL(amount, 0)), 2) AS total_spent
          FROM filtered_source
          GROUP BY dataset, group_name
        )
        SELECT
          gr.dataset,
          gr.group_name AS clean_item_name,
          CAST(NULL AS STRING) AS condensed_group,
          FALSE AS is_condensed,
          gr.count,
          gr.transaction_date,
          gr.item_name,
          gr.item_description,
          gr.category,
          gr.subcategory,
          gr.subtotal,
          gr.sales_tax,
          gr.total_price,
          gr.quantity,
          CAST(NULL AS FLOAT64) AS cost_per_item,
          gr.merchant_name,
          gr.merchant_state,
          gr.merchant_city,
          gr.merchant_type,
          gr.transaction_type,
          gr.total_spent,
          ARRAY<STRUCT<name STRING, count INT64, spend FLOAT64>>[] AS vendors,
          ARRAY<STRUCT<
            clean_item_name STRING,
            count INT64,
            total_spent FLOAT64,
            item_name STRING,
            item_description STRING,
            category STRING,
            subcategory STRING,
            merchant_name STRING,
            merchant_type STRING,
            vendors ARRAY<STRUCT<name STRING, count INT64, spend FLOAT64>>
          >>[] AS drilldown_items
        FROM grouped_rollup gr
        WHERE gr.total_spent >= @min_spend
        ORDER BY {order_by_clause}
        LIMIT @limit
    """

    client = _bigquery_client()
    job_config = bigquery.QueryJobConfig(
        table_definitions=table_definitions,
        query_parameters=_query_parameters(
            selected_year=selected_year,
            selected_quarter=selected_quarter,
            min_spend=min_spend,
            limit=limit,
            parsed_query=parsed_query,
            category_originals=category_originals,
        ),
    )

    results = client.query(sql, job_config=job_config).result()
    items: List[Dict[str, Any]] = []
    for row in results:
        items.append(
            {
                "dataset": row.get("dataset", normalized_dataset),
                "clean_item_name": row.get("clean_item_name", ""),
                "is_condensed": bool(row.get("is_condensed")),
                "condensed_group": row.get("condensed_group"),
                "count": int(row.get("count") or 0),
                "total_spent": round(float(row.get("total_spent") or 0), 2),
                "cost_per_item": round(float(row.get("cost_per_item") or 0), 2),
                "quantity": round(float(row.get("quantity") or 0), 2),
                "vendors": _serialize_vendors(row.get("vendors")),
                "row_values": _serialize_row_values(row),
                "drilldown_items": _serialize_drilldown_items(row.get("drilldown_items")),
                "raw_rows": _serialize_detail_rows(row.get("raw_rows")) if row.get("is_condensed") else [],
            }
        )

    return {
        "items": items,
        "dataset": normalized_dataset,
        "selected_year": selected_year,
        "selected_quarter": selected_quarter,
        "search_query": search_query,
        "sort_mode": chosen_sort_mode,
        "group_by": chosen_group_by,
        "schema": dataset_schema(normalized_dataset),
        "storage_paths": storage_paths,
        "warnings": [],
    }


def query_spend_over_time_from_bigquery(
    *,
    dataset: str = "overall",
    time_period: str = "month",
    selected_year: str = "All Time",
    selected_quarter: str = "All Quarters",
) -> Dict[str, Any]:
    """Query BigQuery external CSV tables for spend or quantity grouped over time."""
    normalized_dataset = _normalize_dataset(dataset)
    chosen_time_period = (time_period or "month").strip().lower()
    if chosen_time_period not in {"day", "week", "month", "year"}:
        raise ValueError("time_period must be one of: day, week, month, year")
    selected_quarter = _normalized_quarter(selected_quarter)

    datasets = (
        ["amazon", "cruzbuy", "onecard", "bookstore"]
        if normalized_dataset == "overall"
        else [normalized_dataset]
    )

    table_definitions: Dict[str, bigquery.ExternalConfig] = {}
    source_queries: List[str] = []
    storage_paths: Dict[str, str] = {}

    for current_dataset in datasets:
        latest_upload = _latest_upload_metadata(current_dataset)
        if not latest_upload or not latest_upload.get("storagePath"):
            continue

        config = DATASET_COLUMN_CONFIG[current_dataset]["bigquery"]
        table_name = f"{current_dataset}_spend_ext"
        storage_paths[current_dataset] = latest_upload["storagePath"]
        table_definitions[table_name] = _build_external_config(
            _storage_uri(latest_upload["storagePath"])
        )
        parsed_date_expression = _parsed_date_expression(config["date_column"])

        source_queries.append(
            f"""
            SELECT
              '{current_dataset}' AS dataset,
              {_amount_expression(config["metric_column"])} AS amount,
              {parsed_date_expression} AS parsed_date
            FROM `{table_name}`
            """.strip()
        )

    if not source_queries:
        return {
            "dataset": normalized_dataset,
            "time_period": chosen_time_period,
            "schema": dataset_schema(normalized_dataset),
            "storage_paths": storage_paths,
            "datasets": {},
            "combined": [],
            "warnings": ["No uploaded CSV files with storage paths were found for the selected dataset."],
        }

    period_expression = {
        "day": "FORMAT_DATE('%Y-%m-%d', parsed_date)",
        "week": "FORMAT_DATE('%G-W%V', parsed_date)",
        "month": "FORMAT_DATE('%Y-%m', parsed_date)",
        "year": "FORMAT_DATE('%Y', parsed_date)",
    }[chosen_time_period]

    sql = f"""
        WITH source_data AS (
          {' UNION ALL '.join(source_queries)}
        ),
        normalized AS (
          SELECT
            dataset,
            amount,
            parsed_date,
            {_quarter_case_expression('parsed_date')} AS transaction_quarter
          FROM source_data
        ),
        filtered AS (
          SELECT
            dataset,
            {period_expression} AS period,
            amount
          FROM normalized
          WHERE parsed_date IS NOT NULL
            AND amount IS NOT NULL
            AND (@selected_year = 'All Time' OR FORMAT_DATE('%Y', parsed_date) = @selected_year)
            AND (@selected_quarter = 'All Quarters' OR transaction_quarter = @selected_quarter)
        ),
        dataset_rollup AS (
          SELECT
            dataset,
            period,
            ROUND(SUM(amount), 2) AS spend
          FROM filtered
          GROUP BY dataset, period
        ),
        combined_rollup AS (
          SELECT
            period,
            ROUND(SUM(spend), 2) AS spend
          FROM dataset_rollup
          GROUP BY period
        )
        SELECT
          'dataset' AS row_type,
          dataset,
          period,
          spend
        FROM dataset_rollup
        UNION ALL
        SELECT
          'combined' AS row_type,
          'combined' AS dataset,
          period,
          spend
        FROM combined_rollup
        ORDER BY period, dataset
    """

    client = _bigquery_client()
    job_config = bigquery.QueryJobConfig(
        table_definitions=table_definitions,
        query_parameters=[
            bigquery.ScalarQueryParameter("selected_year", "STRING", selected_year),
            bigquery.ScalarQueryParameter("selected_quarter", "STRING", selected_quarter),
        ],
    )
    results = client.query(sql, job_config=job_config).result()

    dataset_series: Dict[str, List[Dict[str, Any]]] = {key: [] for key in datasets}
    combined: List[Dict[str, Any]] = []
    for row in results:
        point = {
            "period": row.get("period", ""),
            "spend": round(float(row.get("spend") or 0), 2),
        }
        if row.get("row_type") == "combined":
            combined.append(point)
        else:
            dataset_key = row.get("dataset", "")
            dataset_series.setdefault(dataset_key, []).append(point)

    return {
        "dataset": normalized_dataset,
        "time_period": chosen_time_period,
        "selected_year": selected_year,
        "selected_quarter": selected_quarter,
        "schema": dataset_schema(normalized_dataset),
        "storage_paths": storage_paths,
        "datasets": dataset_series,
        "combined": combined,
        "warnings": [],
    }


@lru_cache(maxsize=5)
def fetch_amazon_bookstore_recommendations():
    """
    Returns top Amazon items grouped by category and flags which ones are
    bookstore-adjacent so the UI can surface purchase signals.
    """
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset = os.getenv("BIGQUERY_DATASET", "")

    BOOKSTORE_ADJACENT = {
        "book", "books", "office product", "office products",
        "apparel", "clothing", "electronics", "computer",
        "printed publications", "educational", "art", "craft",
    }

    sql = f"""
    WITH AmazonTop AS (
        SELECT
            `Item Description` AS item_name,
            `Category`         AS category,
            SUM(Quantity)      AS amazon_count
        FROM `{bq_project}.{bq_dataset}.amazon_cleaned`
        WHERE `Item Description` IS NOT NULL
          AND `Category`         IS NOT NULL
        GROUP BY item_name, category
        ORDER BY amazon_count DESC
        LIMIT 50
    ),
    BookstoreItems AS (
        SELECT DISTINCT LOWER(`Item Description`) AS item_name_lower
        FROM `{bq_project}.{bq_dataset}.bookstore_cleaned`
        WHERE `Item Description` IS NOT NULL
    )
    SELECT
        a.item_name,
        a.category,
        a.amazon_count,
        b.item_name_lower IS NOT NULL AS in_bookstore
    FROM AmazonTop a
    LEFT JOIN BookstoreItems b ON LOWER(a.item_name) = b.item_name_lower
    ORDER BY a.amazon_count DESC
    """

    bq_client = _bigquery_client()
    rows = list(bq_client.query(sql).result())

    overlap, gaps = [], []
    for row in rows:
        category_lower = (row["category"] or "").lower()
        is_adjacent = any(k in category_lower for k in BOOKSTORE_ADJACENT)
        in_bookstore = bool(row["in_bookstore"])
        count = int(row["amazon_count"] or 0)
        item = {
            "item_name": row["item_name"],
            "category": row["category"],
            "amazon_count": count,
        }
        if in_bookstore:
            item["suggested_reason"] = f"High Amazon demand ({count:,} orders) confirms this is popular. Keep well-stocked."
            overlap.append(item)
        elif is_adjacent:
            item["suggested_reason"] = f"{count:,} Amazon orders in '{row['category']}'. Consider stocking in the bookstore."
            gaps.append(item)

    return {"overlap": overlap[:15], "gaps": gaps[:15]}

# This caches the last 30 unique (time_period, dev_mode, lookback) combos in server RAM.
@lru_cache(maxsize=30)
def fetch_bookstore_forecast_from_bigquery(time_period: str, dev_mode: bool = False, lookback: str = "2_year"):
    """
    Retrieves inventory health insights by comparing current stock against BQML demand forecasts.

    Key fixes vs. original:
    - Filters ML.EXPLAIN_FORECAST to time_series_type = 'forecast' only (historical rows were
      being summed in, inflating predictions by 10-30x).
    - Uses a rolling 6-month window for stock depletion instead of all-time sales.
    - Adds a HistoricalContext CTE that computes the average sales for the same calendar
      period (the months being forecast) across the past N years, giving a reality-check
      baseline alongside the ML prediction.
    """
    import datetime
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset = os.getenv("BIGQUERY_DATASET", "")
    model_suffix = "_dev" if dev_mode else ""
    model_path = f"{bq_project}.{bq_dataset}.bookstore_inventory_forecast{model_suffix}"
    data_table = f"{bq_project}.{bq_dataset}.bookstore_cleaned{model_suffix}"

    horizon_map = {"1_month": 1, "1_quarter": 3, "6_months": 6, "1_year": 12}
    months_to_forecast = horizon_map.get(time_period, 3)

    lookback_map = {"1_year": 1, "2_year": 2, "3_year": 3}
    lookback_years = lookback_map.get(lookback, 2)

    # Compute which calendar months we are forecasting (starting next month from today)
    today = datetime.date.today()
    forecast_months = [((today.month - 1 + i + 1) % 12) + 1 for i in range(months_to_forecast)]
    month_list_sql = ", ".join(str(m) for m in forecast_months)

    # Year range for historical comparison: the past N complete years before the current one
    hist_end_year   = today.year - 1
    hist_start_year = today.year - lookback_years

    sql = f"""
    -- Only sum FORECAST rows (not 'history' fitted rows).
    -- Without this filter, ML.EXPLAIN_FORECAST returns historical fitted values too,
    -- and summing all of them inflates predicted_qty by the full length of the training set.
    WITH Explanations AS (
        SELECT
            `Item_Description` AS item_name,
            SUM(time_series_data)                  AS predicted_qty,
            SUM(prediction_interval_lower_bound)   AS lower_bound,
            SUM(prediction_interval_upper_bound)   AS upper_bound,
            AVG(trend)                             AS avg_trend,
            AVG(seasonal_period_yearly)            AS yearly_seasonality
        FROM ML.EXPLAIN_FORECAST(
            MODEL `{model_path}`,
            STRUCT({months_to_forecast} AS horizon)
        )
        WHERE time_series_type = 'forecast'
        GROUP BY item_name
    ),

    -- Anchor all date calculations to the latest transaction in the dataset
    -- so the query works correctly regardless of how old the data is relative to today.
    DataBounds AS (
        SELECT
            MAX(CAST(`Transaction Date` AS DATE)) AS latest_date,
            MIN(CAST(`Transaction Date` AS DATE)) AS earliest_date
        FROM `{data_table}`
    ),

    -- CurrentStock: the bookstore dataset represents inventory on hand, not a sales ledger.
    -- We use the most recent quarter relative to the dataset's latest date as the freshest
    -- snapshot of what is on the shelf. No baseline subtraction — SUM(Quantity) IS inventory.
    CurrentStock AS (
        SELECT
            `Item Description` AS item_name,
            SUM(Quantity)      AS stock
        FROM `{data_table}`, DataBounds
        WHERE CAST(`Transaction Date` AS DATE) >= DATE_SUB(DataBounds.latest_date, INTERVAL 3 MONTH)
        GROUP BY item_name
    ),

    -- HistoricalContext: average sales for the SAME calendar months we are forecasting,
    -- measured over the past {lookback_years} year(s) relative to the dataset's latest year.
    HistoricalContext AS (
        SELECT item_name, AVG(period_qty) AS historical_avg
        FROM (
            SELECT
                `Item Description`                                    AS item_name,
                EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))   AS yr,
                SUM(Quantity)                                         AS period_qty
            FROM `{data_table}`, DataBounds
            WHERE
                EXTRACT(MONTH FROM CAST(`Transaction Date` AS DATE)) IN ({month_list_sql})
                AND EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))
                    BETWEEN EXTRACT(YEAR FROM DataBounds.latest_date) - {lookback_years}
                        AND EXTRACT(YEAR FROM DataBounds.latest_date) - 1
            GROUP BY item_name, yr
        )
        GROUP BY item_name
    )

    SELECT
        e.item_name,
        CAST(e.predicted_qty   AS INT64)                    AS predicted_qty,
        CAST(e.lower_bound     AS INT64)                    AS lower_bound,
        CAST(e.upper_bound     AS INT64)                    AS upper_bound,
        e.avg_trend,
        e.yearly_seasonality,
        COALESCE(CAST(c.stock  AS INT64), 0)                AS current_stock,
        CAST(COALESCE(h.historical_avg, 0) AS INT64)        AS historical_avg
    FROM Explanations e
    LEFT JOIN CurrentStock      c ON e.item_name = c.item_name
    LEFT JOIN HistoricalContext h ON e.item_name = h.item_name
    WHERE e.item_name IS NOT NULL
      AND CAST(e.predicted_qty AS INT64) > 0
    ORDER BY ABS(CAST(c.stock AS INT64) - CAST(e.predicted_qty AS INT64)) DESC
    LIMIT 25
    """
    
    bq_client = _bigquery_client()
    query_job = bq_client.query(sql)
    results = []

    for row in query_job.result():
        # data extraction
        item_name = row["item_name"]
        category = row["item_name"]
        predicted = int(row["predicted_qty"] or 0)
        stock = int(row["current_stock"] or 0)
        trend = row["avg_trend"] or 0
        seasonality = row["yearly_seasonality"] or 0
        upper = int(row["upper_bound"] or 0)
        lower = int(row["lower_bound"] or 0)
        historical_avg = int(row["historical_avg"] or 0)

        # 1. CALCULATE ACTUAL CERTAINTY SCORE
        # Formula: 1 - (Range Width / (2 * Predicted))
        # A tight range = high certainty. A wide range = low certainty.
        if predicted > 0:
            interval_width = upper - lower
            # We normalize the width against the prediction to get a percentage
            error_margin = interval_width / (predicted * 2) if predicted > 0 else 0.5
            certainty_score = max(5, min(99, int((1 - error_margin) * 100)))
        else:
            certainty_score = 50 # Default for items with no predicted sales

        # 2. HANDLE "NO SEASONALITY" DATA
        # we adjust the reasoning to reflect that this is a "Steady" item
        if seasonality == 0:
            seasonality_impact = "a stable, non-seasonal baseline"
        else:
            seasonality_impact = "historical seasonal spikes" if seasonality > 0 else "standard seasonal baseline"
        
        # Reasoning Section
        # =================
        # we calculate the shortfall (predicted - actual) to see if what we predicted match up with the actual stock
        shortfall = predicted - stock

        # update AI text generation to handle flat '0's
        if trend > 0.05:
            trend_direction = "growing"
        elif trend < -0.05:
            trend_direction = "declining"
        else:
            trend_direction = "stable"

        # seasonality_impact = "a strong historical seasonal spike" if seasonality > 0 else "standard seasonal baseline"

        # Historical context string for reasoning
        hist_note = (
            f" Same-period {lookback_years}yr avg: {historical_avg} units."
            if historical_avg > 0 else ""
        )

        # Logic gate: will we completely run out of stock?
        if shortfall > 0:
            action = "Critical Reorder" if shortfall > (stock * 0.5) else "Reorder Soon"
            reasoning = (
                f"Predicted shortfall of {shortfall} units. "
                f"The model projects {predicted} sales driven by a {trend_direction} long-term trend "
                f"and {seasonality_impact}. Current stock ({stock}) will not cover the selected period."
                f"{hist_note}"
            )

        # Logic gate: Are we within 20 units of running out of stock (the danger zone)?
        elif shortfall > -20:
            action = "Monitor Closely"
            reasoning = (
                f"Stock is cutting it close. You have {stock} units to cover a predicted demand of {predicted}. "
                f"Based on historical data, unexpected {seasonality_impact} variance could cause a stockout."
                f"{hist_note}"
            )

        # Logic gate: Dead Stock Risk
        elif stock > upper:
            action = "Dead Stock Risk"
            excess = stock - upper
            reasoning = (
                f"Overstock Risk: Current stock ({stock}) exceeds the highest projected demand ({upper}). "
                f"Historical baseline trend is {trend_direction}, suggesting ~{excess} units of trapped capital."
                f"{hist_note}"
            )

        # Logic gate: otherwise, we have plenty of stock left
        else:
            action = "Adequate Stock"
            reasoning = (
                f"No immediate action needed. Current stock ({stock}) safely covers the predicted demand ({predicted}). "
                f"Historical baseline trend is {trend_direction}, but you have sufficient buffer."
                f"{hist_note}"
            )

        reliability = "High" if certainty_score > 80 else "Moderate" if certainty_score > 50 else "Low"

        # Final Payload
        results.append({
            "category": category,
            "current_stock": stock,
            "predicted_demand": predicted,
            "lower_bound": lower,
            "upper_bound": upper,
            "certainty_score": certainty_score,
            "action": action,
            "historical_avg": historical_avg,
            "reasoning": f"{reasoning} Model reliability is {reliability} ({certainty_score}% certainty) based on prediction variance.",
            "trend_direction": trend_direction
        })

    return results


@lru_cache(maxsize=30)
def fetch_amazon_forecast_from_bigquery(time_period: str, dev_mode: bool = False, lookback: str = "2_year"):
    """
    Retrieves Amazon demand forecasts per item name using BQML ARIMA+.
    current_stock = recent 3-month Amazon order volume for that item.
    predicted_demand = ML forecast of future Amazon orders.
    Both values come from amazon_cleaned so the comparison is always valid.
    """
    import datetime
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset = os.getenv("BIGQUERY_DATASET", "")
    model_suffix = "_dev" if dev_mode else ""
    model_path = f"{bq_project}.{bq_dataset}.amazon_demand_forecast{model_suffix}"
    amazon_table = f"{bq_project}.{bq_dataset}.amazon_cleaned{model_suffix}"

    horizon_map = {"1_month": 1, "1_quarter": 3, "6_months": 6, "1_year": 12}
    months_to_forecast = horizon_map.get(time_period, 3)

    lookback_map = {"1_year": 1, "2_year": 2, "3_year": 3}
    lookback_years = lookback_map.get(lookback, 2)

    today = datetime.date.today()
    forecast_months = [((today.month - 1 + i + 1) % 12) + 1 for i in range(months_to_forecast)]
    month_list_sql = ", ".join(str(m) for m in forecast_months)

    sql = f"""
    WITH Explanations AS (
        SELECT
            `Item_Description` AS item_name,
            SUM(time_series_data)                AS predicted_qty,
            SUM(prediction_interval_lower_bound) AS lower_bound,
            SUM(prediction_interval_upper_bound) AS upper_bound,
            AVG(trend)                           AS avg_trend,
            AVG(seasonal_period_yearly)          AS yearly_seasonality
        FROM ML.EXPLAIN_FORECAST(
            MODEL `{model_path}`,
            STRUCT({months_to_forecast} AS horizon)
        )
        WHERE time_series_type = 'forecast'
        GROUP BY item_name
    ),

    -- Recent 3-month order volume per item, anchored to dataset's own latest date
    RecentOrders AS (
        SELECT
            `Item Description` AS item_name,
            SUM(Quantity)      AS recent_qty
        FROM `{amazon_table}`
        WHERE CAST(`Transaction Date` AS DATE) >= DATE_SUB(
            (SELECT MAX(CAST(`Transaction Date` AS DATE)) FROM `{amazon_table}`),
            INTERVAL 3 MONTH
        )
          AND `Item Description` IS NOT NULL
        GROUP BY `Item Description`
    ),

    HistoricalContext AS (
        SELECT item_name, AVG(period_qty) AS historical_avg
        FROM (
            SELECT
                `Item Description` AS item_name,
                EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))  AS yr,
                SUM(Quantity)                                        AS period_qty
            FROM `{amazon_table}`
            WHERE
                EXTRACT(MONTH FROM CAST(`Transaction Date` AS DATE)) IN ({month_list_sql})
                AND EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))
                    BETWEEN (SELECT EXTRACT(YEAR FROM MAX(CAST(`Transaction Date` AS DATE))) FROM `{amazon_table}`) - {lookback_years}
                        AND (SELECT EXTRACT(YEAR FROM MAX(CAST(`Transaction Date` AS DATE))) FROM `{amazon_table}`) - 1
                AND `Item Description` IS NOT NULL
            GROUP BY item_name, yr
        )
        GROUP BY item_name
    )

    SELECT
        e.item_name,
        CAST(e.predicted_qty   AS INT64)              AS predicted_qty,
        CAST(e.lower_bound     AS INT64)              AS lower_bound,
        CAST(e.upper_bound     AS INT64)              AS upper_bound,
        e.avg_trend,
        e.yearly_seasonality,
        COALESCE(CAST(r.recent_qty AS INT64), 0)      AS recent_orders,
        CAST(COALESCE(h.historical_avg, 0) AS INT64)  AS historical_avg
    FROM Explanations e
    LEFT JOIN RecentOrders      r ON e.item_name = r.item_name
    LEFT JOIN HistoricalContext h ON e.item_name = h.item_name
    WHERE e.item_name IS NOT NULL
      AND CAST(e.predicted_qty AS INT64) > 0
    ORDER BY CAST(e.predicted_qty AS INT64) DESC
    LIMIT 25
    """

    bq_client = _bigquery_client()
    query_job = bq_client.query(sql)
    results = []

    for row in query_job.result():
        item_name = row["item_name"]
        predicted = int(row["predicted_qty"] or 0)
        recent = int(row["recent_orders"] or 0)
        trend = row["avg_trend"] or 0
        seasonality = row["yearly_seasonality"] or 0
        upper = int(row["upper_bound"] or 0)
        lower = int(row["lower_bound"] or 0)
        historical_avg = int(row["historical_avg"] or 0)

        if predicted > 0:
            interval_width = upper - lower
            error_margin = interval_width / (predicted * 2) if predicted > 0 else 0.5
            certainty_score = max(5, min(99, int((1 - error_margin) * 100)))
        else:
            certainty_score = 50

        if trend > 0.05:
            trend_direction = "growing"
        elif trend < -0.05:
            trend_direction = "declining"
        else:
            trend_direction = "stable"

        if seasonality == 0:
            seasonality_impact = "a stable, non-seasonal baseline"
        else:
            seasonality_impact = "historical seasonal spikes" if seasonality > 0 else "standard seasonal baseline"

        hist_note = (
            f" Same-period {lookback_years}yr avg: {historical_avg} orders."
            if historical_avg > 0 else ""
        )

        shortfall = predicted - recent
        if shortfall > 0 and shortfall > (recent * 0.5):
            action = "Critical Reorder"
            reasoning = (
                f"Amazon demand is surging — forecast of {predicted} orders vs. only {recent} recent. "
                f"Shortfall of {shortfall} units driven by a {trend_direction} trend and {seasonality_impact}.{hist_note}"
            )
        elif shortfall > 0:
            action = "Reorder Soon"
            reasoning = (
                f"Demand is climbing — {predicted} orders forecast vs. {recent} recently. "
                f"A {trend_direction} trend suggests continued growth.{hist_note}"
            )
        elif shortfall > -20:
            action = "Monitor Closely"
            reasoning = (
                f"Demand is near recent volume ({recent} orders vs. {predicted} forecast). "
                f"Variance from {seasonality_impact} could push this higher.{hist_note}"
            )
        elif recent > upper:
            action = "Dead Stock Risk"
            reasoning = (
                f"Recent orders ({recent}) exceed the high-end forecast ({upper}), suggesting demand is cooling. "
                f"The {trend_direction} trend supports lower activity ahead.{hist_note}"
            )
        else:
            action = "Adequate Stock"
            reasoning = (
                f"Demand is stable. Forecast of {predicted} orders aligns with recent volume ({recent}). "
                f"Historical baseline is {trend_direction} with {seasonality_impact}.{hist_note}"
            )

        reliability = "High" if certainty_score > 80 else "Moderate" if certainty_score > 50 else "Low"

        results.append({
            "category": item_name,
            "current_stock": recent,
            "predicted_demand": predicted,
            "lower_bound": lower,
            "upper_bound": upper,
            "certainty_score": certainty_score,
            "action": action,
            "historical_avg": historical_avg,
            "reasoning": f"{reasoning} Model reliability is {reliability} ({certainty_score}% certainty).",
            "trend_direction": trend_direction,
        })

    return results


@lru_cache(maxsize=50)
def fetch_item_history(item_name: str, dev_mode: bool = False):
    """
    Returns monthly aggregated purchase quantities for a single bookstore item.
    Used to render the time-series chart in the ItemHistoryDrawer.
    """
    from google.cloud import bigquery as bq_lib
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset = os.getenv("BIGQUERY_DATASET", "")
    suffix = "_dev" if dev_mode else ""
    data_table = f"{bq_project}.{bq_dataset}.bookstore_cleaned{suffix}"

    sql = f"""
    SELECT
        FORMAT_DATE('%Y-%m', DATE_TRUNC(CAST(`Transaction Date` AS DATE), MONTH)) AS month,
        SUM(Quantity) AS quantity
    FROM `{data_table}`
    WHERE `Item Description` = @item_name
      AND `Transaction Date` IS NOT NULL
    GROUP BY month
    ORDER BY month ASC
    """

    job_config = bq_lib.QueryJobConfig(
        query_parameters=[bq_lib.ScalarQueryParameter("item_name", "STRING", item_name)]
    )
    bq_client = _bigquery_client()
    rows = list(bq_client.query(sql, job_config=job_config).result())
    return [{"month": row["month"], "quantity": int(row["quantity"] or 0)} for row in rows]
