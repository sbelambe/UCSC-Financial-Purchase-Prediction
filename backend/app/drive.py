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

def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        os.getenv("GOOGLE_DRIVE_CREDENTIALS"),
        scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


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

def download_excel(file_id, destination_path):
    service = get_drive_service()
    request = service.files().get_media(fileId=file_id)

    with open(destination_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def convert_excel_to_csv(excel_path, csv_path):
    df = pd.read_excel(excel_path)
    df.to_csv(csv_path, index=False)


# ----------------------------------------------------
# SYNC LOGIC
# ----------------------------------------------------

def sync_drive_folder(folder_id, raw_dir):
    os.makedirs(raw_dir, exist_ok=True)

    metadata_path = os.path.join(raw_dir, "drive_metadata.json")
    old_metadata = load_metadata(metadata_path)

    files = list_files(folder_id)
    new_metadata = {}

    changed = False

    for file in files:
        name = file["name"]
        file_id = file["id"]
        modified = file["modifiedTime"]

        new_metadata[name] = modified

        if name not in old_metadata or old_metadata[name] != modified:
            print(f"File changed: {name}")
            changed = True

            # Determine normalized filename
            if "Amazon" in name:
                base_name = "amazon"
            elif "CruzBuy" in name:
                base_name = "cruzbuy"
            elif "ProCard" in name:
                base_name = "procard"
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

    if changed:
        save_metadata(metadata_path, new_metadata)

    return changed


# ----------------------------------------------------
# METADATA
# ----------------------------------------------------

def load_metadata(metadata_path):
    if not os.path.exists(metadata_path):
        return {}
    with open(metadata_path, "r") as f:
        return json.load(f)


def save_metadata(metadata_path, data):
    with open(metadata_path, "w") as f:
        json.dump(data, f, indent=2)
