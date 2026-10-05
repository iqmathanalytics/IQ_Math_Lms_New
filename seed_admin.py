import requests
import os
# ⚙️ CONFIGURATION
BASE_URL = os.getenv("API_URL", "http://127.0.0.1:8000/api/v1")

def create_instructor():
    print("Creating Admin/Instructor user...")
    
    payload = {
        "email": "admin@iqmath.com",
        "password": "admin123",  # You will use this to login
        "name": "Chief Instructor",
        "role": "instructor",
        "phone_number": "9876543210"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/users", json=payload)
        
        if response.status_code == 201:
            print("SUCCESS: User created.")
            print("Email: admin@iqmath.com")
            print("Password: admin123")
        elif response.status_code == 400:
            print("User already exists. You can login now.")
        else:
            print(f"Failed: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
        print("Is the backend server running?")

if __name__ == "__main__":
    create_instructor()