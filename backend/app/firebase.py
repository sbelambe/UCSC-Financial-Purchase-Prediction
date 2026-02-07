import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

cred_filename = os.getenv("FIREBASE_CREDENTIALS_PATH")

if not cred_filename:
    raise ValueError("Error: FIREBASE_CREDENTIALS_PATH is missing in .env")

# construct absolute path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(current_dir))
cred_path = os.path.join(root_dir, cred_filename)

# initialize firebase
if not firebase_admin._apps:
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print(f"Firebase initialized using key: {cred_filename}")
    else:
        raise FileNotFoundError(f"Could not find the key file at: {cred_path}")

db = firestore.client()