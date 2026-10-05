import os
from google_auth_oauthlib.flow import InstalledAppFlow

# Scope for Drive File access
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def authenticate_google_drive():
    print("🚀 Starting Authentication...")
    
    # 1. Check for credentials.json
    if not os.path.exists('credentials.json'):
        print("❌ Error: 'credentials.json' is missing.")
        print("   Please ensure it is in the same folder as this script.")
        return

    # 2. Start the Flow
    try:
        flow = InstalledAppFlow.from_client_secrets_file(
            'credentials.json', SCOPES)
        
        print("🌐 Opening browser... Please log in.")
        # We force port 8080. If this fails, try 3000.
        # 'consent' forces a Refresh Token to be returned.
        creds = flow.run_local_server(port=8080, prompt='consent')
        
        # 3. Save the Token
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
            print("\n✅ SUCCESS! 'token.json' created successfully.")
            
    except OSError as e:
        print(f"\n❌ PORT ERROR: {e}")
        print("👉 Try changing 'port=8080' to 'port=0' or 'port=3000' in the script.")
    except Exception as e:
        print(f"\n❌ AUTH FAILED: {e}")

if __name__ == '__main__':
    authenticate_google_drive()