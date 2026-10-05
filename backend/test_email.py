import smtplib
import os
from dotenv import load_dotenv

# Force load .env
load_dotenv()

sender = os.getenv("EMAIL_SENDER")
password = os.getenv("EMAIL_PASSWORD")

print(f"📧 Testing Email Credentials...")
print(f"User: {sender}")
print(f"Pass: {password[:4]}******** (Length: {len(password) if password else 0})")

try:
    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    print("✅ Connected to Gmail Server")
    
    server.login(sender, password)
    print("✅ Login Successful!")
    
    msg = f"Subject: Test Email\n\nIf you see this, the system is working."
    server.sendmail(sender, sender, msg)
    print("✅ Test Email Sent to yourself!")
    server.quit()
except Exception as e:
    print(f"\n❌ FATAL ERROR: {e}")