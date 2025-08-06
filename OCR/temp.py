import json
from pymongo import MongoClient
from datetime import datetime

client = MongoClient("mongodb://localhost:27017/")  # adjust if using Atlas/cloud
db = client["ocr_db"]
ocr_collection = db["ocr_summary"]


# Load JSON file
with open('D:\\OCR\\output\\page_1_res.json', 'r', encoding='utf-8') as f:
    data = json.load(f)



text = data.get("rec_texts", None)
confidence = data.get("rec_scores", [])
avg_confidence = sum(confidence)/len(confidence)

# def save_ocr_to_mongodb(pdf_name, text, avg_conf):
#     document = {
#         "file_name": pdf_name,
#         "text": text,
#         "avg_conf": avg_conf,
#         "created_at": datetime.utcnow()
#     }
#
#     # Insert or update existing entry
#     ocr_collection.update_one(
#         {"pdf_name": pdf_name},
#         {"$set": document},
#         upsert=True
#     )
#
# save_ocr_to_mongodb("Candidate Task", text, confidence)