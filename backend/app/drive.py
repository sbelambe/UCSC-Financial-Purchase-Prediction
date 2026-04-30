# Handles syncing source files from Google Drive into the backend's
# raw-data directory for processing. It checks for new or modified 
# files, downloads and normalizes them, and tracks metadata to 
# avoid unnecessary reprocessing.
import io
import os
import re
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

# Extracts the source name from the Drive filename
def detect_source(filename):
    lower_name = filename.lower()

    if "amazon" in lower_name:
        return "amazon"
    elif "cruzbuy" in lower_name:
        return "cruzbuy"
    elif "onecard" in lower_name or "procard" in lower_name:
        return "onecard"
    elif "bay tree" in lower_name or "bookstore" in lower_name:
        return "bookstore"

    return None


# Extracts a 4-digit year from the filename
def extract_year(filename):
    match = re.search(r"(19\d{2}|20\d{2})", filename)
    if not match:
        return None

    year = int(match.group(1))

    if 1900 <= year <= 2100:
        return str(year)

    return None


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

        source = detect_source(name)
        year = extract_year(name)

        if not source:
            continue

        # If no year is found, store as "unknown"
        if not year:
            year = "unknown"

        metadata_key = f"{source}_{year}"

        if metadata_key not in old_metadata or old_metadata[metadata_key] != modified:
            print(f"File changed: {name}")
            changed = True

            temp_excel_path = os.path.join(raw_dir, f"{source}_{year}.xlsx")
            final_csv_path = os.path.join(raw_dir, f"{source}_{year}.csv")

            # 1. Download Excel
            download_excel(file_id, temp_excel_path)

            # 2. Convert to CSV
            convert_excel_to_csv(temp_excel_path, final_csv_path)

            # 3. Remove temp Excel
            os.remove(temp_excel_path)

        new_metadata[metadata_key] = modified
            

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
