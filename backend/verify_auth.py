import os
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

def test_google_auth():
    print("🔍 Checking 'token.json'...")

    if not os.path.exists('token.json'):
        print("❌ Error: 'token.json' file not found.")
        return

    try:
        # 1. Load Credentials
        creds = Credentials.from_authorized_user_file('token.json', ['https://www.googleapis.com/auth/drive.file'])
        
        # 2. Check Expiry & Refresh if needed
        if creds and creds.expired and creds.refresh_token:
            print("⏳ Token is expired. Attempting auto-refresh...")
            try:
                creds.refresh(Request())
                print("✅ Token refreshed successfully!")
            except Exception as e:
                print(f"❌ REFRESH FAILED: {str(e)}")
                print("💡 Solution: Delete 'token.json' and run 'python setup_local_auth.py' again.")
                return

        # 3. Test Actual API Call
        print("🚀 Testing connection to Google Drive...")
        service = build('drive', 'v3', credentials=creds)
        
        # Try to list 1 file to prove access works
        results = service.files().list(pageSize=1, fields="files(id, name)").execute()
        items = results.get('files', [])

        print("\n🎉 SUCCESS! Connected to Google Drive.")
        if not items:
            print("   (Your Drive folder is accessible, but currently empty or restricted).")
        else:
            print(f"   Found file: {items[0]['name']} (ID: {items[0]['id']})")
            
    except Exception as e:
        print(f"\n❌ AUTHENTICATION FAILED: {str(e)}")

if __name__ == "__main__":
    test_google_auth()