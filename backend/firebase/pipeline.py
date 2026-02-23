from typing import Dict, Any

from firebase.storage import upload_all_to_storage
from firebase.firestore import df_to_firestore
from firebase.summaries import save_top_values_summary, save_top_items_detailed_summary


def upload_cleaned_data(*, dataframes: Dict[str, Any], local_paths: Dict[str, str]) -> Dict[str, Dict[str, str]]:
    """
    Uploads cleaned CSVs to Storage, rows to Firestore, and summary docs to Firestore.
    """
    storage_paths = upload_all_to_storage(local_paths)
    upload_ids = {
        "amazon": df_to_firestore(
            dataframes["amazon"], dataset="amazon", storage_path=storage_paths["amazon"]
        ),
        "cruzbuy": df_to_firestore(
            dataframes["cruzbuy"], dataset="cruzbuy", storage_path=storage_paths["cruzbuy"]
        ),
        "pcard": df_to_firestore(
            dataframes["pcard"], dataset="pcard", storage_path=storage_paths["pcard"]
        ),
    }

    # ---------------- CRUZBUY SUMMARIES ----------------
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

    save_top_items_detailed_summary(
        upload_id=upload_ids["cruzbuy"],
        dataset="cruzbuy",
        storage_path=storage_paths["cruzbuy"],
        summary_name="top_items_detailed",
        title="Top Purchased Items",
        df=dataframes["cruzbuy"],
        item_col="Product Description",     
        price_col="Total Price",       
        vendor_col="Supplier Name",
        n=20
    )

    # ---------------- AMAZON SUMMARIES ----------------
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

    save_top_items_detailed_summary(
        upload_id=upload_ids["amazon"],
        dataset="amazon",
        storage_path=storage_paths["amazon"],
        summary_name="top_items_detailed",
        title="Top Purchased Items",
        df=dataframes["amazon"],
        item_col="Item Description",
        price_col="Subtotal",
        vendor_col="Merchant Name",
        n=20
    )

    # ---------------- PCARD SUMMARIES ----------------
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

    save_top_items_detailed_summary(
        upload_id=upload_ids["pcard"],
        dataset="pcard",
        storage_path=storage_paths["pcard"],
        summary_name="top_items_detailed",
        title="Top Purchased Items",
        df=dataframes["pcard"],
        item_col="Item Name",
        price_col="Subtotal",
        vendor_col="Merchant Name",
        n=20
    )

    return {
        "uploaded": storage_paths,
        "firestore_upload_ids": upload_ids,
    }
