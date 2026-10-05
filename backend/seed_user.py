import requests

# ✅ POINT TO YOUR API
API_URL = "http://127.0.0.1:8000/api/v1/users"

def seed_users():
    # 1. Define Instructor Data (Added phone_number)
    instructor = {
        "email": "instructor@iqmath.com",
        "password": "password123",
        "name": "Master Instructor",
        "role": "instructor",
        "phone_number": "9876543210" # <--- REQUIRED NOW
    }

    # 2. Define Student Data (Added phone_number)
    student = {
        "email": "student@iqmath.com",
        "password": "password123",
        "name": "Test Student",
        "role": "student",
        "phone_number": "9123456789" # <--- REQUIRED NOW
    }

    # 3. Send Requests
    print("🌱 Seeding Database...")

    # Create Instructor
    try:
        res = requests.post(API_URL, json=instructor)
        if res.status_code == 201:
            print("✅ Instructor Created: instructor@iqmath.com / securepassword")
        elif res.status_code == 400:
            print("⚠️ Instructor already exists.")
        else:
            print(f"❌ Failed to create instructor: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")

    # Create Student
    try:
        res = requests.post(API_URL, json=student)
        if res.status_code == 201:
            print("✅ Student Created: student@iqmath.com / securepassword")
        elif res.status_code == 400:
            print("⚠️ Student already exists.")
        else:
            print(f"❌ Failed to create student: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    seed_users()