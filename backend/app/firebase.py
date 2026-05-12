# Initializes Firebase connection to prevent redundant initialization across 
# multiple files
import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the storage bucket name from environment variables
bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
if not bucket_name:
    raise ValueError("FIREBASE_STORAGE_BUCKET is missing in .env or Vercel")

# Initialize firebase_admin
if not firebase_admin._apps:
    
    # 1. Try to load from Vercel Environment Variable (JSON String)
    firebase_env_creds = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    
    if firebase_env_creds:
        # We are on Vercel: Parse the JSON string
        cred_dict = json.loads(firebase_env_creds)
        cred = credentials.Certificate(cred_dict)
        print("Firebase initialized using Vercel environment variable.")
    else:
        # 2. Fall back to local file path for development
        # Get the path to the Firebase credentials
        cred_filename = os.getenv("FIREBASE_CREDENTIALS_PATH")
        if not cred_filename:
            raise ValueError("Error: FIREBASE_CREDENTIALS_PATH is missing in .env")

        # Construct absolute path to the credentials file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(current_dir))
        cred_path = os.path.join(root_dir, cred_filename)

        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            print(f"Firebase initialized using key: {cred_filename}")
        else:
            raise FileNotFoundError(f"Could not find the key file at: {cred_path}")

    # Initialize the app with the selected credentials and storage bucket
    firebase_admin.initialize_app(cred, {
        "storageBucket": bucket_name
    })

# Initialize reusable Firestore clients so we can write data to FireStore
db = firestore.client()
bucket = storage.bucket(bucket_name)