# This main.py serves as the wrapper for the google cloud function that triggers the entire ETL pipeline. 
# It imports the existing pipeline from jobs/run_firebase_uploads.py, and adds CORS handling to allow requests from the React frontend. 
# The function is designed to be triggered by a POST request to /api/system/refresh, 
# which is called when the user clicks the "Refresh Data" button in the frontend. 
# The function will return a JSON response indicating success or failure of the ETL process, 
# along with any relevant data or error messages.

import functions_framework
from flask import jsonify

@functions_framework.http
def trigger_refresh(request):
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}

    try:
        from jobs.run_firebase_uploads import run_firebase_uploads
        
        result = run_firebase_uploads()
        return (jsonify({"status": "success", "data": result}), 200, headers)
        
    except Exception as e:
        print(f"[FATAL ETL ERROR]: {e}")
        return (jsonify({"status": "error", "message": str(e)}), 500, headers)