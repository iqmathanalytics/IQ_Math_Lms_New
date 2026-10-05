import time
import os
import threading
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

class TokenManager:
    def __init__(self, token_path='token.json', interval_days=4):
        self.token_path = token_path
        self.interval_seconds = interval_days * 86400
        self.running = False
        self.thread = None

    def refresh_token(self):
        """Checks for token existence and refreshes it."""
        try:
            if os.path.exists(self.token_path):
                # Load credentials
                creds = Credentials.from_authorized_user_file(self.token_path, ['https://www.googleapis.com/auth/drive.file'])
                
                print("[TokenManager] Checking token status...")
                
                # Check if we SHOULD refresh. 
                # Note: 'creds.expired' verifies if access token is invalid.
                # If we want to proactively refresh before expiry, we can just call refresh()
                # provided we have a refresh token.
                
                if creds.refresh_token:
                    # 1. Force refresh to update Access Token
                    try:
                        creds.refresh(Request())
                        # 2. Save updated token (Access token + Refresh token typically persists)
                        with open(self.token_path, 'w') as token:
                            token.write(creds.to_json())
                        print("[TokenManager] Token refreshed and saved successfully.")
                        print(f"[TokenManager] New expiry: {creds.expiry}")
                    except Exception as e:
                        print(f"[TokenManager] Failed to refresh token: {e}")
                else:
                    print("[TokenManager] No refresh token found. Cannot auto-refresh.")
            else:
                print(f"[TokenManager] {self.token_path} not found. Skipping refresh.")
        except Exception as e:
            print(f"[TokenManager] Unexpected error: {e}")

    def loop(self):
        while self.running:
            # Refresh immediately on start (or check)
            self.refresh_token()
            # Wait for interval
            print(f"[TokenManager] Sleeping for {self.interval_seconds / 86400} days...")
            time.sleep(self.interval_seconds)

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self.loop, daemon=True)
            self.thread.start()
            print("[TokenManager] Background refresh service started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1)
