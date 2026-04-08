# Handles syncing source files from Google Drive into the backend's
# raw-data directory for processing. It checks for new or modified 
# files, downloads and normalizes them, and tracks metadata to 
# avoid unnecessary reprocessing.
import io
import os
import json
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


# ----------------------------------------------------
# DRIVE SERVICE
# ----------------------------------------------------
# Authenticates and creates a Google Drive service client using 
# a service account
def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        os.getenv("GOOGLE_DRIVE_CREDENTIALS"),
        scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)

# Lists files in the specified Google Drive folder and returns 
# their metadata (id, name, modified time)
def list_files(folder_id):
    service = get_drive_service()
    results = service.files().list(
        q=f"'{folder_id}' in parents",
        fields="files(id, name, modifiedTime)"
    ).execute()
    return results.get("files", [])


# ----------------------------------------------------
# DOWNLOAD + NORMALIZE
# ----------------------------------------------------
# Downloads the specified file from Google Drive and saves it to the
# given local path
def download_excel(file_id, destination_path):
    service = get_drive_service()
    request = service.files().get_media(fileId=file_id)

    with open(destination_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

# Converts the downloaded Excel file to CSV format for easier processing
def convert_excel_to_csv(excel_path, csv_path):
    df = pd.read_excel(excel_path)
    df.to_csv(csv_path, index=False)


# ----------------------------------------------------
# SYNC LOGIC
# ----------------------------------------------------
# Main function to sync the specified Google Drive folder with the backend's
# raw data directory. It checks for new or modified files, downloads and
# normalizes them, and updates metadata to track changes
def sync_drive_folder(folder_id, raw_dir):
    os.makedirs(raw_dir, exist_ok=True)

    # Load old metadata to compare against
    metadata_path = os.path.join(raw_dir, "drive_metadata.json")
    old_metadata = load_metadata(metadata_path)

    files = list_files(folder_id)
    new_metadata = {}

    changed = False

    # Process each file
    for file in files:
        name = file["name"]
        file_id = file["id"]
        modified = file["modifiedTime"]

        new_metadata[name] = modified

        if name not in old_metadata or old_metadata[name] != modified:
            print(f"File changed: {name}")
            changed = True

            # Determine normalized name for the file based on its name
            if "Amazon" in name:
                base_name = "amazon"
            elif "CruzBuy" in name:
                base_name = "cruzbuy"
            elif "OneCard" in name:
                base_name = "onecard"
            elif "Bay Tree" in name or "Bookstore" in name:
                base_name = "bookstore"
            else:
                continue

            temp_excel_path = os.path.join(raw_dir, f"{base_name}.xlsx")
            final_csv_path = os.path.join(raw_dir, f"{base_name}.csv")

            # 1. Download Excel
            download_excel(file_id, temp_excel_path)

            # 2. Convert to CSV
            convert_excel_to_csv(temp_excel_path, final_csv_path)

            # 3. Remove temp Excel
            os.remove(temp_excel_path)

    # If any files were changed, save the new metadata
    if changed:
        save_metadata(metadata_path, new_metadata)

    return changed


# ----------------------------------------------------
# METADATA
# ----------------------------------------------------
# Loads metadata from the specified path, which tracks file modification times
def load_metadata(metadata_path):
    if not os.path.exists(metadata_path):
        return {}
    with open(metadata_path, "r") as f:
        return json.load(f)

# Saves metadata to the specified path, which tracks file modification times
def save_metadata(metadata_path, data):
    with open(metadata_path, "w") as f:
        json.dump(data, f, indent=2)
