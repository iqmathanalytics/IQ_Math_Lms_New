import base64
import os

# Check if file exists first
if not os.path.exists("token.json"):
    print("❌ Error: token.json not found in this folder.")
    print("   Run 'python backup_manager.py' first to generate it.")
else:
    with open("token.json", "rb") as f:
        # Read the file and encode it to base64
        encoded = base64.b64encode(f.read()).decode("utf-8")
        
    print("\n✅ COPY THE STRING BELOW (Everything between the lines):\n")
    print("-" * 20)
    print(encoded)
    print("-" * 20)
    print("\n👉 Go to Render Dashboard -> Settings -> Environment Variables")
    print("👉 Add Key: GOOGLE_TOKEN_BASE64")
    print("👉 Paste the string above as the Value.")