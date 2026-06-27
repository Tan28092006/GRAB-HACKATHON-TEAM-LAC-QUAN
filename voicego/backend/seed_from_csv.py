import csv
import os
import sys
from datetime import datetime

sys.path.append(os.path.dirname(__file__))
from db import get_db, point, utcnow

try:
    import bcrypt
except ImportError:
    bcrypt = None

MOCK_DATA_DIR = os.path.join(os.path.dirname(__file__), "mock_data")

def parse_bool(val):
    if not val:
        return False
    return str(val).lower() in ("true", "1", "yes", "y")

def parse_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def parse_int(val):
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0

def hash_password(raw_password):
    if bcrypt:
        return bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    return raw_password

def seed_users():
    db = get_db()
    now = utcnow()
    file_path = os.path.join(MOCK_DATA_DIR, "users.csv")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            user = {
                "_id": row["_id"],
                "full_name": row["full_name"],
                "email": row["email"],
                "phone": row["phone"],
                "password": hash_password(row["password"]),
                "role": row["role"],
                "total_reward_points": parse_int(row.get("total_reward_points", 0)),
                "created_at": now,
                "updated_at": now,
            }
            db.users.update_one({"_id": user["_id"]}, {"$setOnInsert": user}, upsert=True)
    print("Users seeded from CSV.")

def seed_profiles():
    db = get_db()
    now = utcnow()
    file_path = os.path.join(MOCK_DATA_DIR, "accessibility_profiles.csv")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            profile = {
                "_id": row["_id"],
                "user_id": row["user_id"],
                "disability_type": row["disability_type"],
                "needs_driver_assistance": parse_bool(row["needs_driver_assistance"]),
                "created_at": now,
                "updated_at": now,
            }
            db.accessibility_profiles.update_one({"user_id": profile["user_id"]}, {"$set": profile}, upsert=True)
    print("Accessibility profiles seeded from CSV.")

def seed_drivers():
    db = get_db()
    now = utcnow()
    file_path = os.path.join(MOCK_DATA_DIR, "drivers.csv")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            driver = {
                "_id": row["_id"],
                "user_id": row["user_id"],
                "vehicle_type": row["vehicle_type"],
                "vehicle_model": row["vehicle_model"],
                "license_plate": row["license_plate"],
                "has_low_step_vehicle": parse_bool(row["has_low_step_vehicle"]),
                "accessibility_training_completed": parse_bool(row["accessibility_training_completed"]),
                "rating": parse_float(row["rating"]),
                "created_at": now,
                "updated_at": now,
            }
            db.drivers.update_one({"_id": driver["_id"]}, {"$set": driver}, upsert=True)
    print("Drivers seeded from CSV.")

def seed_places():
    db = get_db()
    now = utcnow()
    file_path = os.path.join(MOCK_DATA_DIR, "places.csv")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            place = {
                "_id": row["_id"],
                "name": row["name"],
                "address": row["address"],
                "location": point(parse_float(row["lat"]), parse_float(row["lng"])),
                "created_at": now,
                "updated_at": now,
            }
            db.places.update_one({"_id": place["_id"]}, {"$set": place}, upsert=True)
    print("Places seeded from CSV.")

def seed_accessibility_places():
    db = get_db()
    now = utcnow()
    file_path = os.path.join(MOCK_DATA_DIR, "accessibility_places.csv")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            acc = {
                "_id": row["_id"],
                "place_id": row["place_id"],
                "disability_accessible_entrance": parse_bool(row["disability_accessible_entrance"]),
                "accessibility_score": parse_float(row["accessibility_score"]),
                "score_count": parse_int(row["score_count"]),
                "created_at": now,
                "updated_at": now,
            }
            db.accessibility_places.update_one({"place_id": acc["place_id"]}, {"$set": acc}, upsert=True)
    print("Accessibility places seeded from CSV.")

def run():
    print("Starting CSV data import...")
    seed_users()
    seed_profiles()
    seed_drivers()
    seed_places()
    seed_accessibility_places()
    print("Done importing mock data from CSVs!")

if __name__ == "__main__":
    run()
