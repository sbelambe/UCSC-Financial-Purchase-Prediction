from google.cloud import bigquery
import os

def retrain_arima_model():
    """
    Executes the CREATE OR REPLACE MODEL queries for all active BigQuery ML forecasting models.
    
    This function initializes a BigQuery client and synchronously triggers the retraining 
    of the production models (e.g., Bookstore, Amazon). It waits for the jobs to complete 
    before returning, ensuring the system state is updated before the API responds.
    
    Returns:
        dict: A summary of the retraining execution status.
        
    Raises:
        Exception: If any of the BigQuery jobs fail to execute or compile.
    """
    project_id = os.getenv("VITE_FIREBASE_PROJECT_ID")
    dataset = os.getenv("BIGQUERY_DATASET")

    client = bigquery.Client(project=project_id)

    # defining the training queries
    queries = [
        # bookstire inventory forecast model
        f"""
        CREATE OR REPLACE MODEL `{project_id}.{dataset}.bookstore_inventory_forecast`
        OPTIONS(
          model_type='ARIMA_PLUS', 
          time_series_timestamp_col='Transaction_Date', 
          time_series_data_col='Quantity',      
          time_series_id_col='Item_Description'        
        ) AS
        WITH RealignedData AS (
          SELECT
            COALESCE(
              SAFE_CAST(`Transaction Date` AS DATE),
              SAFE.PARSE_DATE('%m/%d/%Y', `Transaction Date`)
            ) AS Transaction_Date,
            `Item Description` AS Item_Description,
            SAFE_CAST(Quantity AS INT64) AS Quantity
          FROM `{project_id}.{dataset}.bookstore_cleaned`
        )
        SELECT Transaction_Date, Item_Description, SUM(Quantity) AS Quantity
        FROM RealignedData
        WHERE Transaction_Date IS NOT NULL AND Item_Description IS NOT NULL
        GROUP BY Transaction_Date, Item_Description;
        """,

        # amazon demand forecast model
        f"""
        CREATE OR REPLACE MODEL `{project_id}.{dataset}.amazon_demand_forecast`
        OPTIONS(
          model_type='ARIMA_PLUS', 
          time_series_timestamp_col='Transaction_Date', 
          time_series_data_col='Quantity',      
          time_series_id_col='Item_Description'        
        ) AS
        WITH RealignedData AS (
          SELECT
            COALESCE(
              SAFE_CAST(`Transaction Date` AS DATE),
              SAFE.PARSE_DATE('%m/%d/%Y', `Transaction Date`)
            ) AS Transaction_Date,
            `Item Description` AS Item_Description,
            SAFE_CAST(Quantity AS INT64) AS Quantity
          FROM `{project_id}.{dataset}.amazon_cleaned`
        )
        SELECT Transaction_Date, Item_Description, SUM(Quantity) AS Quantity
        FROM RealignedData
        WHERE Transaction_Date IS NOT NULL AND Item_Description IS NOT NULL
        GROUP BY Transaction_Date, Item_Description;
        """
    ]
    
    # exceute queries synchronously
    try:
        for query in queries:
            client.query(query).result()      # .result() forces the Python thread to wait for the BigQuery job to finish first

        print("[INFO] ML model retraining completed successfully.")
        return {"status": "success", "message": "All prediction models retrained."}
  

    except Exception as e:
        print(f"[ERROR] Failed to retrained prediction models: {e}")
        raise e