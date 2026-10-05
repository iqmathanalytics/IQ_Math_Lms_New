from google_auth_oauthlib.flow import InstalledAppFlow
import os

# Define the permission we need (must match your main.py)
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def main():
    # Check if credentials.json exists
    if not os.path.exists('credentials.json'):
        print("❌ Error: credentials.json is missing!")
        return

    print("🚀 Starting Google Login...")
    
    # Create the flow
    flow = InstalledAppFlow.from_client_secrets_file(
        'credentials.json', SCOPES)
    
    # Run the local server to open the browser
    creds = flow.run_local_server(port=0)

    # Save the result to token.json
    with open('token.json', 'w') as token:
        token.write(creds.to_json())
        
    print("✅ SUCCESS! token.json has been created.")
    print("👉 You can now copy the content of 'token.json' to Render.")

if __name__ == '__main__':
    main()