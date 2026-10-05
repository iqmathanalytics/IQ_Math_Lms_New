import os
import shutil
import datetime
import zipfile
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
from dotenv import load_dotenv
import subprocess 
import base64
# Load env for DB credentials
load_dotenv()

# --- ⚙️ CONFIGURATION ---
BACKUP_DIR = "backups"
DRIVE_FOLDER_NAME = "iQmath_Backups_Vault"
DB_FILE_NAME = "sql_app.db"  # Change this if using PostgreSQL (see below)
RETENTION_DAYS = 30

# Ensure local backup dir exists
os.makedirs(BACKUP_DIR, exist_ok=True)

def get_drive_service():
    """Authenticates with Google Drive using Environment Variable or local token.json"""
    
    # 1. Check for Env Var and create file if missing
    # This logic runs on Render to "restore" the file from the variable
    if not os.path.exists('token.json'):
        token_b64 = os.getenv("GOOGLE_TOKEN_BASE64")
        if token_b64:
            print("🔑 Found GOOGLE_TOKEN_BASE64. Decoding to token.json...")
            try:
                with open("token.json", "wb") as f:
                    f.write(base64.b64decode(token_b64))
            except Exception as e:
                print(f"❌ Error decoding token: {e}")

    # 2. Standard Auth Flow
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', ['https://www.googleapis.com/auth/drive.file'])
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Refreshing expired token...")
            try:
                creds.refresh(Request())
                # Note: On Render, we can't easily save the refreshed token back to the Env Var.
                # Ideally, you generate a token with a long life or use a Service Account.
                # But for now, this session will work for the backup task.
            except Exception as e:
                print(f"❌ Token Refresh Failed: {e}")
                return None
        else:
            print("❌ Error: Valid credentials not found.")
            return None
            
    return build('drive', 'v3', credentials=creds)

def create_local_backup():
    """Creates a timestamped Zip of the remote PostgreSQL database"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"iQmath_DB_{timestamp}.zip"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    dump_file = "temp_dump.sql"

    print(f"📦 Creating backup snapshot from PostgreSQL...")

    # Get the Database URL from environment variables (Render provides this automatically)
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("❌ Error: DATABASE_URL not found in environment variables.")
        return None

    try:
        # 1. Run pg_dump to download the database to a temp SQL file
        # We use subprocess to run the command line tool
        command = f"pg_dump {db_url} -f {dump_file}"
        subprocess.run(command, shell=True, check=True)

        # 2. Zip the SQL file
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(dump_file, arcname="iQmath_Backup.sql")
        
        # 3. Cleanup temp file
        if os.path.exists(dump_file):
            os.remove(dump_file)
            
        print(f"✅ Database Zipped Successfully: {backup_path}")
        return backup_path

    except subprocess.CalledProcessError as e:
        print(f"❌ PostgreSQL Dump Failed: {e}")
        return None
    except Exception as e:
        print(f"❌ Backup Error: {e}")
        return None
    
    
def get_or_create_drive_folder(service, folder_name):
    """Finds the Backup folder in Drive or creates it if missing"""
    query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    items = results.get('files', [])

    if not items:
        print(f"📂 Creating new Drive folder: {folder_name}...")
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')
    else:
        return items[0]['id']

def upload_to_drive(file_path):
    """Uploads the zip file to Google Drive"""
    service = get_drive_service()
    if not service: return

    folder_id = get_or_create_drive_folder(service, DRIVE_FOLDER_NAME)
    file_name = os.path.basename(file_path)

    print(f"🚀 Uploading {file_name} to Google Drive...")
    
    file_metadata = {
        'name': file_name,
        'parents': [folder_id]
    }
    media = MediaFileUpload(file_path, mimetype='application/zip', resumable=True)
    
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"✅ Upload Complete! File ID: {file.get('id')}")

def cleanup_old_backups():
    """Deletes backups older than RETENTION_DAYS from Google Drive"""
    service = get_drive_service()
    if not service: return

    folder_id = get_or_create_drive_folder(service, DRIVE_FOLDER_NAME)
    
    # Calculate cutoff date
    cutoff_date = datetime.datetime.now() - datetime.timedelta(days=RETENTION_DAYS)
    
    # List files in the backup folder
    query = f"'{folder_id}' in parents and trashed=false"
    results = service.files().list(q=query, fields="files(id, name, createdTime)").execute()
    files = results.get('files', [])

    print(f"🧹 Checking {len(files)} files for cleanup (Retention: {RETENTION_DAYS} days)...")

    for file in files:
        # Drive time format: 2023-10-27T10:00:00.000Z
        created_time_str = file['createdTime']
        # Simple parse (stripping Z for simplicity)
        created_time = datetime.datetime.strptime(created_time_str.split('.')[0], "%Y-%m-%dT%H:%M:%S")

        if created_time < cutoff_date:
            print(f"🗑️ Deleting old backup: {file['name']} (Created: {created_time})")
            service.files().delete(fileId=file['id']).execute()

if __name__ == "__main__":
    print("--- 🛡️ STARTING MILITARY GRADE BACKUP ---")
    try:
        # 1. Create Local Zip
        zip_path = create_local_backup()
        
        if zip_path:
            # 2. Upload to Cloud
            upload_to_drive(zip_path)
            
            # 3. Clean Cloud Storage
            cleanup_old_backups()
            
            # 4. Clean Local Storage (Save space)
            os.remove(zip_path)
            print("--- ✅ BACKUP PROCESS COMPLETED SUCCESSFULLY ---")
    except Exception as e:
        print(f"--- ❌ BACKUP FAILED: {str(e)} ---")