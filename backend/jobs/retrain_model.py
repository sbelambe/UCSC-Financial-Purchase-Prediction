from google.cloud import bigquery
import os

def retrain_arima_model():
    client = bigquery.Client()
    project = os.getenv("VITE_FIREBASE_PROJECT_ID")
    dataset = os.getenv("BIGQUERY_DATASET")

    query = f"""
    CREATE OR REPLACE MODEL `{project}.{dataset}.bookstore_inventory_forecast`
    OPTIONS(
      model_type='ARIMA_PLUS',
      time_series_timestamp_col='Transaction_Date',
      time_series_data_col='Quantity',
      time_series_id_col='Item_Description',
      data_frequency='AUTO'
    ) AS
    SELECT Transaction_Date, Quantity, Item_Description 
    FROM `{project}.{dataset}.bookstore_cleaned`
    """

    print("[INFO] Starting BigQueryML Retraining...")
    job = client.query(query)
    # waits for the job to complete
    job.result()
    print("[SUCCESS] BigQueryML model retrained successfully")