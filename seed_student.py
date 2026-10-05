import requests
import sys
import os
# ⚙️ CONFIGURATION
BASE_URL = os.getenv("API_URL", "http://127.0.0.1:8000/api/v1")

def create_student():
    print("🚀 Creating Student User...")
    
    payload = {
        "email": "student@iqmath.com",
        "password": "pass123",  
        "name": "Test Student",
        "role": "student",
        "phone_number": "1122334455"
    }
    
    try:
        # ADDED TIMEOUT: This stops the script from hanging forever
        response = requests.post(f"{BASE_URL}/users", json=payload, timeout=5)
        
        if response.status_code == 201:
            print("✅ SUCCESS! Student created.")
            print("📧 Email: student@iqmath.com")
            print("🔑 Password: pass123")
        elif response.status_code == 400:
            print("⚠️ User already exists. You can login with these credentials.")
        else:
            print(f"❌ Failed to create user: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ CONNECTION REFUSED")
        print("---------------------------------------------------")
        print("1. Is your backend running? (uvicorn main:app)")
        print("2. Is it running on port 8000?")
        print("---------------------------------------------------")
    except requests.exceptions.ReadTimeout:
        print("\n❌ TIMEOUT ERROR")
        print("---------------------------------------------------")
        print("The server received the request but took too long.")
        print("1. Check your backend terminal for errors.")
        print("2. Your database connection might be failing (Check Port 5432 vs 5433).")
        print("---------------------------------------------------")
    except Exception as e:
        print(f"🔥 Error: {e}")

if __name__ == "__main__":
    create_student() 