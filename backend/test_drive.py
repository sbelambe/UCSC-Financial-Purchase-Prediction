from backend.app.drive import get_drive_service
import os
from dotenv import load_dotenv

load_dotenv()

FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

service = get_drive_service()

results = service.files().list(
    q=f"'{FOLDER_ID}' in parents",
    fields="files(id, name, modifiedTime)"
).execute()

files = results.get("files", [])

print("Drive files found:")
for f in files:
    print(f["name"], f["modifiedTime"])

