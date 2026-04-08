# Initializes Firebase connection to prevent redundant initialization across 
# multiple files
import os
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the path to the Firebase credentials and the storage bucket name from
# environment variables
cred_filename = os.getenv("FIREBASE_CREDENTIALS_PATH")
bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")

# Validate that the required environment variables are set
if not cred_filename:
    raise ValueError("Error: FIREBASE_CREDENTIALS_PATH is missing in .env")

# Construct absolute path to the credentials file
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(current_dir))
cred_path = os.path.join(root_dir, cred_filename)
bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")

# Initialize firebase_admin
if not firebase_admin._apps:
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        # bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
        if not bucket_name:
            raise ValueError("FIREBASE_STORAGE_BUCKET is missing in .env")

        firebase_admin.initialize_app(cred, {
            "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET")
        })

        print(f"Firebase initialized using key: {cred_filename}")
    else:
        raise FileNotFoundError(f"Could not find the key file at: {cred_path}")

# Initialize reusable Firestore clients so we can write data to FireStore
db = firestore.client()
bucket = storage.bucket(bucket_name)


