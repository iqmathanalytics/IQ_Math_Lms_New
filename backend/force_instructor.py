from database import SessionLocal
import models

# 1. Connect to Database
db = SessionLocal()

# 2. Find your user (Using the email from your screenshot)
email = "sadhanashreya28@gmail.com" 
user = db.query(models.User).filter(models.User.email == email).first()

# 3. Force change the role
if user:
    print(f"🧐 Current Role: {user.role}")
    user.role = "instructor"
    db.commit()
    print(f"✅ SUCCESS: {user.email} has been forcefully promoted to INSTRUCTOR.")
else:
    print(f"❌ Error: User {email} not found. Did you delete the db again?")

db.close()