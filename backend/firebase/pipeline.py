from typing import Dict, Any, Optional

from firebase.storage import upload_all_to_storage
from firebase.firestore import df_to_firestore
from firebase.summaries import save_top_values_summary, save_spend_over_time_summary

DEFAULT_UPLOAD_IDS = {
    "amazon": "amazon",
    "cruzbuy": "cruzbuy",
    "pcard": "pcard",
}

def upload_cleaned_data(
    *,
    dataframes: Dict[str, Any],
    local_paths: Dict[str, str],
    upload_ids: Optional[Dict[str, str]] = None,
) -> Dict[str, Dict[str, str]]:
    """
    Uploads cleaned CSVs to Storage, writes upload metadata to Firestore,
    and stores summary docs in Firestore (without writing row documents).
    """
    chosen_upload_ids = {**DEFAULT_UPLOAD_IDS, **(upload_ids or {})}
    storage_paths = upload_all_to_storage(local_paths)
    upload_ids = {
        "amazon": df_to_firestore(
            dataframes["amazon"],
            dataset="amazon",
            storage_path=storage_paths["amazon"],
            upload_id=chosen_upload_ids["amazon"],
            write_rows=False,
        ),
        "cruzbuy": df_to_firestore(
            dataframes["cruzbuy"],
            dataset="cruzbuy",
            storage_path=storage_paths["cruzbuy"],
            upload_id=chosen_upload_ids["cruzbuy"],
            write_rows=False,
        ),
        "pcard": df_to_firestore(
            dataframes["pcard"],
            dataset="pcard",
            storage_path=storage_paths["pcard"],
            upload_id=chosen_upload_ids["pcard"],
            write_rows=False,
        ),
    }

    save_top_values_summary(
        upload_id=upload_ids["cruzbuy"],
        dataset="cruzbuy",
        storage_path=storage_paths["cruzbuy"],
        summary_name="top_manufacturers_10",
        title="Top manufacturers",
        df=dataframes["cruzbuy"],
        column="Manufacturer",
        n=10,
    )

    save_top_values_summary(
        upload_id=upload_ids["amazon"],
        dataset="amazon",
        storage_path=storage_paths["amazon"],
        summary_name="top_manufacturers_10",
        title="Top manufacturers",
        df=dataframes["amazon"],
        column="Merchant Name",
        n=10,
    )

    save_top_values_summary(
        upload_id=upload_ids["pcard"],
        dataset="pcard",
        storage_path=storage_paths["pcard"],
        summary_name="top_merchants_10",
        title="Top merchants",
        df=dataframes["pcard"],
        column="Merchant Name",
        n=10,
    )

    save_spend_over_time_summary(
        upload_id=upload_ids["amazon"],
        dataset="amazon",
        storage_path=storage_paths["amazon"],
        summary_name="spend_over_time_monthly",
        title="Spend over time",
        df=dataframes["amazon"],
        date_col="Transaction Date",
        amount_col="Total Price",
        time_period="month",
    )

    save_spend_over_time_summary(
        upload_id=upload_ids["cruzbuy"],
        dataset="cruzbuy",
        storage_path=storage_paths["cruzbuy"],
        summary_name="spend_over_time_monthly",
        title="Spend over time",
        df=dataframes["cruzbuy"],
        date_col="Transaction Date",
        amount_col="Total Price",
        time_period="month",
    )

    save_spend_over_time_summary(
        upload_id=upload_ids["pcard"],
        dataset="pcard",
        storage_path=storage_paths["pcard"],
        summary_name="spend_over_time_monthly",
        title="Spend over time",
        df=dataframes["pcard"],
        date_col="Transaction Date",
        amount_col="Total Price",
        time_period="month",
        transaction_type_col="Transaction Type",
        include_refunds=True,
    )

    return {
        "uploaded": storage_paths,
        "firestore_upload_ids": upload_ids,
    }
