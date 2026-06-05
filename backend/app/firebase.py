# Initializes Firebase connection to prevent redundant initialization across 
# multiple files
import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# check if running in a google cloud env
is_gcp = os.getenv("K_SERVICE") is not None

# get the storage bucket name from environment variables
bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
if not bucket_name:
    raise ValueError("FIREBASE_STORAGE_BUCKET is missing in .env or Vercel")

# initialize firebase_admin
if not firebase_admin._apps:
    
    # prod: authenticate using default credentials (GCP environment)
    if is_gcp:
        # Initialize the app with default credentials and storage bucket
        firebase_admin.initialize_app(options={
            "storageBucket": bucket_name
        })
        print("Firebase initialized using default credentials (GCP environment).")
        
    # local dev: authenticate using service account key file
    else:
        firebase_env_creds = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        
        if firebase_env_creds:
            # we are on Vercel: parse the JSON string
            cred_dict = json.loads(firebase_env_creds)
            cred = credentials.Certificate(cred_dict)
            print("Firebase initialized using Vercel environment variable.")
        else:
            # fall back to local file path for development
            # get the path to the Firebase credentials
            cred_filename = os.getenv("FIREBASE_CREDENTIALS_PATH")
            if not cred_filename:
                # use default fallback path if environment variable is missing locally
                cred_filename = "serviceAccountKey.json"

            current_dir = os.path.dirname(os.path.abspath(__file__))
            root_dir = os.path.dirname(os.path.dirname(current_dir))
            cred_path = os.path.join(root_dir, cred_filename)

            # alternate backup check for the sibling directory structure
            if not os.path.exists(cred_path):
                cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "serviceAccountKey.json")

            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                print(f"Firebase initialized using key: {cred_path}")
            else:
                raise FileNotFoundError(f"Could not find the key file at: {cred_path}")

        # initialize the app with the selected credentials and storage bucket
        firebase_admin.initialize_app(cred, {
            "storageBucket": bucket_name
        })

# initialize reusable Firestore clients so we can write data to FireStore
db = firestore.client()
bucket = storage.bucket(bucket_name)