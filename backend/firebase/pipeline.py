# Transforms cleaned data into dashboard-ready data stored inside Firestore.
# Takes cleaned dataframes, stores metadata, then generates summaries usable
# By the dashboard
from typing import Dict, Any, Optional
from firebase.storage import upload_all_to_storage
from firebase.firestore import df_to_firestore
from firebase.summaries import save_top_values_summary, save_spend_over_time_summary, save_top_items_detailed_summary

DEFAULT_UPLOAD_IDS = {
    "amazon": "amazon",
    "cruzbuy": "cruzbuy",
    "onecard": "onecard",
    "bookstore": "bookstore",
}

# Used for spend over time to show daily, weekly, monthly, and yearly spend
SPEND_PERIODS = ("day", "week", "month", "year")


def upload_cleaned_data(
    *,
    dataframes: Dict[str, Any],
    local_paths: Dict[str, str],
    upload_ids: Optional[Dict[str, str]] = None,
    upload_storage: bool = False,
) -> Dict[str, Any]:
    # Optionally upload cleaned CSVs to Firebase Storage. Else, set paths 
    # to None. More useful for backups/downloads, not the dashboard itself
    chosen_upload_ids = {**DEFAULT_UPLOAD_IDS, **(upload_ids or {})}
    if upload_storage:
        storage_paths = upload_all_to_storage(local_paths)
    else:
        storage_paths = {
            "amazon": None,
            "cruzbuy": None,
            "onecard": None,
            "bookstore": None,
        }
    
    # Write metadata to Firestore
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
        "onecard": df_to_firestore(
            dataframes["onecard"],
            dataset="onecard",
            storage_path=storage_paths["onecard"],
            upload_id=chosen_upload_ids["onecard"],
            write_rows=False,
        ),
        "bookstore": df_to_firestore(
            dataframes["bookstore"],
            dataset="bookstore",
            storage_path=storage_paths["bookstore"],
            upload_id=chosen_upload_ids["bookstore"],
            write_rows=False,
        ),
    }

    # Generate summaries
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
        item_col="Item Description",     
        price_col="Total Price",       
        vendor_col="Supplier Name",
        n=20
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

    save_top_values_summary(
        upload_id=upload_ids["onecard"],
        dataset="onecard",
        storage_path=storage_paths["onecard"],
        summary_name="top_merchants_10",
        title="Top merchants",
        df=dataframes["onecard"],
        column="Merchant Name",
        n=10,
    )

    save_top_items_detailed_summary(
        upload_id=upload_ids["onecard"],
        dataset="onecard",
        storage_path=storage_paths["onecard"],
        summary_name="top_items_detailed",
        title="Top Purchased Items",
        df=dataframes["onecard"],
        item_col="Item Description",
        price_col="Subtotal",
        vendor_col="Merchant Name",
        n=20
    )

    save_top_values_summary(
        upload_id=upload_ids["bookstore"],
        dataset="bookstore",
        storage_path=storage_paths["bookstore"],
        summary_name="top_merchants_10",
        title="Top merchants",
        df=dataframes["bookstore"],
        column="Merchant Name",
        n=10,
    )

    save_top_items_detailed_summary(
        upload_id=upload_ids["bookstore"],
        dataset="bookstore",
        storage_path=storage_paths["bookstore"],
        summary_name="top_items_detailed",
        title="Top Purchased Items",
        df=dataframes["bookstore"],
        item_col="Item Description",
        price_col="Quantity",
        vendor_col="Category",
        n=20
    )

    
    for period in SPEND_PERIODS:
        save_spend_over_time_summary(
            upload_id=upload_ids["amazon"],
            dataset="amazon",
            storage_path=storage_paths["amazon"],
            summary_name=f"spend_over_time_{period}",
            title=f"Spend over time ({period})",
            df=dataframes["amazon"],
            date_col="Transaction Date",
            amount_col="Total Price",
            time_period=period,
        )

        save_spend_over_time_summary(
            upload_id=upload_ids["cruzbuy"],
            dataset="cruzbuy",
            storage_path=storage_paths["cruzbuy"],
            summary_name=f"spend_over_time_{period}",
            title=f"Spend over time ({period})",
            df=dataframes["cruzbuy"],
            date_col="Transaction Date",
            amount_col="Total Price",
            time_period=period,
        )

        save_spend_over_time_summary(
            upload_id=upload_ids["onecard"],
            dataset="onecard",
            storage_path=storage_paths["onecard"],
            summary_name=f"spend_over_time_{period}",
            title=f"Spend over time ({period})",
            df=dataframes["onecard"],
            date_col="Transaction Date",
            amount_col="Total Price",
            time_period=period,
            transaction_type_col="Transaction Type",
            include_refunds=True,
        )

        save_spend_over_time_summary(
            upload_id=upload_ids["bookstore"],
            dataset="bookstore",
            storage_path=storage_paths["bookstore"],
            summary_name=f"spend_over_time_{period}",
            title=f"Spend over time ({period})",
            df=dataframes["bookstore"],
            date_col="Transaction Date",
            amount_col="Total Price",
            time_period=period,
        )

    return {
        "uploaded": storage_paths,
        "firestore_upload_ids": upload_ids,
    }
