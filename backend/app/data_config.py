from typing import Any, Dict, List


# Canonical columns are the normalized fields the backend exposes to the
# frontend table, regardless of the original dataset-specific CSV headers.
# Keep this list in display order because dataset_schema() and BigQuery row
# serialization both use it to build stable table columns.
CANONICAL_COLUMN_ORDER = [
    "Transaction Date",
    "Item Name",
    "Item Description",
    "Category",
    "Subcategory",
    "Subtotal",
    "Sales Tax",
    "Total Price",
    "Quantity",
    "Merchant Name",
    "Merchant State",
    "Merchant City",
    "Merchant Type",
    "Transaction Type",
]


# Per-dataset schema metadata. Each dataset has:
# - label: user-facing dataset name
# - metric_type: controls whether the UI formats values as currency or quantity
# - metric_label: user-facing label for the metric column and chart axes
# - group_label: user-facing label for vendor/category groupings
# - bigquery: source columns used to build item names, vendors, amounts, and dates
# - columns: mapping from canonical fields to raw source names and cleaned CSV names
DATASET_COLUMN_CONFIG: Dict[str, Dict[str, Any]] = {
    "amazon": {
        "label": "Amazon",
        "metric_type": "currency",
        "metric_label": "Total Spend",
        "group_label": "Merchant Name",
        "bigquery": {
            "item_candidates": ["Item Description", "Category"],
            "vendor_candidates": ["Merchant Name"],
            "metric_column": "Total Price",
            "date_column": "Transaction Date",
        },
        "columns": {
            "Transaction Date": {"available": True, "source_name": "Order Date", "cleaned_name": "Transaction Date"},
            "Item Name": {"available": False, "source_name": None, "cleaned_name": None},
            "Item Description": {"available": True, "source_name": "Title", "cleaned_name": "Item Description"},
            "Category": {"available": True, "source_name": "Amazon-Internal Product Category", "cleaned_name": "Category"},
            "Subcategory": {"available": True, "source_name": "Commodity", "cleaned_name": "Subcategory"},
            "Subtotal": {"available": True, "source_name": "Order Subtotal", "cleaned_name": "Subtotal"},
            "Sales Tax": {"available": True, "source_name": "Order Tax", "cleaned_name": "Sales Tax"},
            "Total Price": {"available": True, "source_name": "Order Net Total", "cleaned_name": "Total Price"},
            "Quantity": {"available": True, "source_name": "Order Quantity", "cleaned_name": "Quantity"},
            "Merchant Name": {"available": True, "source_name": "Seller Name", "cleaned_name": "Merchant Name"},
            "Merchant State": {"available": True, "source_name": "Seller State", "cleaned_name": "Merchant State"},
            "Merchant City": {"available": True, "source_name": "Seller City", "cleaned_name": "Merchant City"},
            "Merchant Type": {"available": False, "source_name": None, "cleaned_name": None},
            "Transaction Type": {"available": False, "source_name": None, "cleaned_name": None},
        },
    },
    "onecard": {
        "label": "OneCard",
        "metric_type": "currency",
        "metric_label": "Total Spend",
        "group_label": "Merchant Name",
        "bigquery": {
            "item_candidates": ["Item Description", "Category"],
            "vendor_candidates": ["Merchant Name"],
            "metric_column": "Total Price",
            "date_column": "Transaction Date",
        },
        "columns": {
            "Transaction Date": {"available": True, "source_name": "Transaction Date", "cleaned_name": "Transaction Date"},
            "Item Name": {"available": False, "source_name": None, "cleaned_name": None},
            "Item Description": {"available": True, "source_name": "ITEM_DSC", "cleaned_name": "Item Description"},
            "Category": {"available": True, "source_name": "Merchant Category Code Description", "cleaned_name": "Category"},
            "Subcategory": {"available": False, "source_name": None, "cleaned_name": None},
            "Subtotal": {"available": True, "source_name": "Transaction Amount", "cleaned_name": "Subtotal"},
            "Sales Tax": {"available": True, "source_name": "Sales Tax", "cleaned_name": "Sales Tax"},
            "Total Price": {"available": True, "source_name": "Total Price", "cleaned_name": "Total Price"},
            "Quantity": {"available": True, "source_name": "ITEM_QTY", "cleaned_name": "Quantity"},
            "Merchant Name": {"available": True, "source_name": "Merchant Name", "cleaned_name": "Merchant Name"},
            "Merchant State": {"available": True, "source_name": "Merchant State/Province", "cleaned_name": "Merchant State"},
            "Merchant City": {"available": True, "source_name": "Merchant City", "cleaned_name": "Merchant City"},
            "Merchant Type": {"available": True, "source_name": "Merchant Type", "cleaned_name": "Merchant Type"},
            "Transaction Type": {"available": True, "source_name": "Transaction Type", "cleaned_name": "Transaction Type"},
        },
    },
    "cruzbuy": {
        "label": "CruzBuy",
        "metric_type": "currency",
        "metric_label": "Total Spend",
        "group_label": "Merchant Name",
        "bigquery": {
            "item_candidates": ["Item Description", "Item Name", "Category"],
            "vendor_candidates": ["Merchant Name"],
            "metric_column": "Total Price",
            "date_column": "Transaction Date",
        },
        "columns": {
            "Transaction Date": {"available": True, "source_name": "Creation Date", "cleaned_name": "Transaction Date"},
            "Item Name": {"available": True, "source_name": "Category Name", "cleaned_name": "Item Name"},
            "Item Description": {"available": True, "source_name": "Product Description", "cleaned_name": "Item Description"},
            "Category": {"available": True, "source_name": "Category Level 1", "cleaned_name": "Category"},
            "Subcategory": {"available": True, "source_name": "Category Level 2", "cleaned_name": "Subcategory"},
            "Subtotal": {"available": True, "source_name": "Extended Price", "cleaned_name": "Subtotal"},
            "Sales Tax": {"available": False, "source_name": None, "cleaned_name": None},
            "Total Price": {"available": True, "source_name": "Total Price", "cleaned_name": "Total Price"},
            "Quantity": {"available": True, "source_name": "Quantity", "cleaned_name": "Quantity"},
            "Merchant Name": {"available": True, "source_name": "Supplier Name", "cleaned_name": "Merchant Name"},
            "Merchant State": {"available": False, "source_name": None, "cleaned_name": None},
            "Merchant City": {"available": False, "source_name": None, "cleaned_name": None},
            "Merchant Type": {"available": False, "source_name": None, "cleaned_name": None},
            "Transaction Type": {"available": False, "source_name": None, "cleaned_name": None},
        },
    },
    "bookstore": {
        "label": "Bookstore",
        "metric_type": "quantity",
        "metric_label": "Total Quantity",
        "group_label": "Category",
        "bigquery": {
            "item_candidates": ["Item Description", "Category"],
            "vendor_candidates": ["Category"],
            "metric_column": "Quantity",
            "date_column": "Transaction Date",
        },
        "columns": {
            "Transaction Date": {"available": True, "source_name": "Date", "cleaned_name": "Transaction Date"},
            "Item Name": {"available": False, "source_name": None, "cleaned_name": None},
            "Item Description": {"available": True, "source_name": "Item", "cleaned_name": "Item Description"},
            "Category": {"available": True, "source_name": "Product Category", "cleaned_name": "Category"},
            "Subcategory": {"available": False, "source_name": None, "cleaned_name": None},
            "Subtotal": {"available": False, "source_name": None, "cleaned_name": None},
            "Sales Tax": {"available": False, "source_name": None, "cleaned_name": None},
            "Total Price": {"available": False, "source_name": None, "cleaned_name": None},
            "Quantity": {"available": True, "source_name": "Quantity", "cleaned_name": "Quantity"},
            "Merchant Name": {"available": False, "source_name": None, "cleaned_name": None},
            "Merchant State": {"available": False, "source_name": None, "cleaned_name": None},
            "Merchant City": {"available": False, "source_name": None, "cleaned_name": None},
            "Merchant Type": {"available": False, "source_name": None, "cleaned_name": None},
            "Transaction Type": {"available": False, "source_name": None, "cleaned_name": None},
        },
    },
}


def dataset_schema(dataset: str) -> Dict[str, Any]:
    """Return frontend-ready column metadata for one dataset or the overall view."""
    if dataset == "overall":
        return overall_schema()

    config = DATASET_COLUMN_CONFIG[dataset]
    return {
        "dataset": dataset,
        "label": config["label"],
        "metric_type": config["metric_type"],
        "metric_label": config["metric_label"],
        "group_label": config["group_label"],
        "columns": [
            {
                "canonical_name": column,
                "available": config["columns"][column]["available"],
                "display_in_table": column != "Transaction Date",
                "source_name": config["columns"][column]["source_name"],
                "cleaned_name": config["columns"][column]["cleaned_name"],
            }
            for column in CANONICAL_COLUMN_ORDER
        ],
    }


def overall_schema() -> Dict[str, Any]:
    """Return consolidated column metadata across all configured datasets."""
    consolidated_columns: List[Dict[str, Any]] = []
    for column in CANONICAL_COLUMN_ORDER:
        availability = []
        for dataset_key, config in DATASET_COLUMN_CONFIG.items():
            details = config["columns"][column]
            if details["available"]:
                availability.append(config["label"])

        consolidated_columns.append(
            {
                "canonical_name": column,
                "available": len(availability) > 0,
                "display_in_table": column != "Transaction Date",
                "available_in": availability,
                "common_to_all": len(availability) == len(DATASET_COLUMN_CONFIG),
            }
        )

    return {
        "dataset": "overall",
        "label": "Overall",
        "metric_type": "mixed",
        "metric_label": "Total Metric",
        "group_label": "Source Group",
        "columns": consolidated_columns,
    }
