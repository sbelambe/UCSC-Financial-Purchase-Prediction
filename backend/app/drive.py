# Handles syncing source files from Google Drive into the backend's
# raw-data directory for processing. It checks for new or modified 
# files, downloads and normalizes them, and tracks metadata to 
# avoid unnecessary reprocessing.
import os, re, json, google.auth
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# check if running in a google cloud env
is_gcp = os.getenv("K_SERVICE") is not None

# define the scopes the pipeline needs
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


# ----------------------------------------------------
# DRIVE SERVICE
# ----------------------------------------------------
# Authenticates and creates a Google Drive service client using 
# a service account
def get_drive_service():
    # authenticate using default creds (GCP environment)
    if is_gcp:
        print("[INFO] Authenticating Google Drive via GCP Application Default Credentials.")
        credentials, project = google.auth.default(scopes=SCOPES)
        return build("drive", "v3", credentials=credentials, cache_discovery=False)
    

    # vercel prod path (fallback)
    env_creds = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if env_creds:
        print("[INFO] Authenticating Google Drive via Vercel Environment Variable.")
        try:
            cred_dict = json.loads(env_creds)
            creds = service_account.Credentials.from_service_account_info(
                cred_dict, 
                scopes=SCOPES
            )
            return build("drive", "v3", credentials=creds, cache_discovery=False)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse GOOGLE_CREDENTIALS_JSON for Drive. Error: {e}")

    # local dev path
    print("[INFO] Authenticating Google Drive via Local JSON File.")
    cred_filename = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "google-drive-service.json")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    project_root = os.path.dirname(backend_dir)
    absolute_cred_path = os.path.join(project_root, cred_filename)

    if not os.path.exists(absolute_cred_path):
        raise FileNotFoundError(f"[ERROR] Missing Drive credentials at: {absolute_cred_path}")

    creds = service_account.Credentials.from_service_account_file(
        absolute_cred_path,
        scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)

# Lists files in the specified Google Drive folder and returns 
# their metadata (id, name, modified time)
def list_files(folder_id):
    service = get_drive_service()
    results = service.files().list(
        q=f"'{folder_id}' in parents and trashed = false",
        fields="files(id, name, modifiedTime, mimeType)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora="allDrives",
    ).execute()
    return results.get("files", [])

def list_files_recursive(folder_id, parent_path=""):
    all_files = []
    items = list_files(folder_id)

    for item in items:
        name = item["name"]
        mime_type = item.get("mimeType", "")
        current_path = os.path.join(parent_path, name)

        if mime_type == "application/vnd.google-apps.folder":
            all_files.extend(list_files_recursive(item["id"], current_path))
        else:
            item["path"] = parent_path
            all_files.append(item)

    return all_files

def is_supported_data_file(filename):
    lower_name = filename.lower()
    return lower_name.endswith((".xlsx", ".xls", ".csv"))

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
def convert_file_to_csv(input_path, csv_path):
    import pandas as pd 
    
    lower_path = input_path.lower()

    if lower_path.endswith(".csv"):
        df = pd.read_csv(input_path)
    else:
        df = pd.read_excel(input_path)

    df.to_csv(csv_path, index=False)

# Extracts the source name from the Drive filename
def detect_source(filename):
    lower_name = filename.lower()

    if "amazon" in lower_name:
        return "amazon"
    elif "cruzbuy" in lower_name or "cruz buy" in lower_name:
        return "cruzbuy"
    elif "onecard" in lower_name or "procard" in lower_name or "pcard" in lower_name or "pro card" in lower_name:
        return "onecard"
    elif "bay tree" in lower_name or "baytree" in lower_name or "bookstore" in lower_name or "campus store" in lower_name or "store" in lower_name:
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

def list_available_years(folder_id):
    files = list_files_recursive(folder_id)

    years = set()

    for file in files:
        name = file["name"]
        path = file.get("path", "")
        search_text = f"{path} {name}"

        source = detect_source(search_text)
        year = extract_year(search_text)

        if source and year:
            years.add(year)

    return sorted(years, reverse=True)

def next_available_dataset_path(raw_dir, source, year, used_output_names):
    base_name = f"{source}_{year}"
    candidate_name = f"{base_name}.csv"
    counter = 2

    while (
        candidate_name in used_output_names
        or os.path.exists(os.path.join(raw_dir, candidate_name))
    ):
        candidate_name = f"{base_name}_{counter}.csv"
        counter += 1

    used_output_names.add(candidate_name)
    return os.path.join(raw_dir, candidate_name)
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

    files = list_files_recursive(folder_id)
    new_metadata = {}

    changed = False
    changed_files = []
    used_output_names = set()

    # Process each file
    for file in files:
        name = file["name"]
        file_id = file["id"]
        modified = file["modifiedTime"]
        path = file.get("path", "")

        if not is_supported_data_file(name):
            continue

        search_text = f"{path} {name}"

        source = detect_source(search_text)

        # IMPORTANT:
        # Use the year from the actual file name first.
        # Only fall back to the folder path if the file name has no year.
        year = extract_year(name) or extract_year(path)

        if not source:
            continue

        # If no year is found, store as "unknown"
        if not year:
            year = "unknown"

        metadata_key = file_id

        if metadata_key not in old_metadata or old_metadata[metadata_key] != modified:
            print(f"File changed: {name}")
            changed = True
            changed_files.append(name)

            file_ext = os.path.splitext(name)[1].lower()
            temp_input_path = os.path.join(raw_dir, f"temp_{file_id}{file_ext}")
            final_csv_path = next_available_dataset_path(raw_dir, source, year, used_output_names)

            # 1. Download source file
            download_excel(file_id, temp_input_path)

            # 2. Convert to CSV
            convert_file_to_csv(temp_input_path, final_csv_path)

            # 3. Remove temp source file
            os.remove(temp_input_path)

        new_metadata[metadata_key] = modified
            

    # If any files were changed, save the new metadata
    if changed:
        save_metadata(metadata_path, new_metadata)

    return {
    "changed": changed,
    "files": changed_files
}


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
