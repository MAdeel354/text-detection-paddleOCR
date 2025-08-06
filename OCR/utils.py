import fitz  # PyMuPDF
from pathlib import Path
import os
from loguru import logger
from pymongo import MongoClient
from datetime import datetime

client = MongoClient("mongodb://localhost:27017/")  # adjust if using Atlas/cloud
db = client["ocr_db"]
ocr_collection = db["ocr_summary"]
# Configure upload and output folders
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "output_images"
ALLOWED_EXTENSIONS = {'pdf'}

# Ensure upload and output folders exist
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)
Path(OUTPUT_FOLDER).mkdir(parents=True, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def convert_pdf_to_images(pdf_path, output_folder, image_format='PNG', dpi=300):
    """
    Convert each page of a PDF to an image and save to output_folder using PyMuPDF.

    Args:
        pdf_path (str): Path to the input PDF file
        output_folder (str): Path to the folder where images will be saved
        image_format (str): Format of output images (default: PNG)
        dpi (int): Resolution of output images (default: 300)

    Returns:
        tuple: (bool, list) - Success status and list of saved image paths
    """
    try:
        # Validate PDF file
        if not os.path.exists(pdf_path):
            logger.error(f"PDF file not found: {pdf_path}")
            return False, []

        # Create output folder if it doesn't exist
        Path(output_folder).mkdir(parents=True, exist_ok=True)

        # Open PDF
        logger.info(f"Opening PDF: {pdf_path}")
        pdf_document = fitz.open(pdf_path)

        # Convert each page to an image
        pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
        image_paths = []
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))  # 300 DPI
            image_path = os.path.join("output_images", f'page_{page_num + 1}.jpg')
            pix.save(image_path)
            image_paths.append(image_path)

        # Close PDF
        pdf_document.close()
        # logger.info(f"Successfully converted {pdf_document.page_count} pages")
        return True, image_paths

    except Exception as e:
        logger.error(f"Error during conversion: {str(e)}")
        return False, []


def save_ocr_to_mongodb(pdf_name, text, avg_conf, page_num=None):
    try:
        page_entry = {
            "text": text,
            "avg_conf": avg_conf,
            "page_num": page_num
        }

        # Try to update the existing page
        result = ocr_collection.update_one(
            {
                "file_name": pdf_name,
                "pages.page_num": page_num
            },
            {
                "$set": {
                    "pages.$.text": text,
                    "pages.$.avg_conf": avg_conf,
                    "pages.$.page_num": page_num
                }
            }
        )

        # If the page doesn't exist, push it into the array
        if result.modified_count == 0:
            ocr_collection.update_one(
                {"file_name": pdf_name},
                {
                    "$push": {"pages": page_entry},
                    "$setOnInsert": {"created_at": datetime.utcnow()}
                },
                upsert=True
            )
    except Exception as e:
        logger.exception(f"Error saving OCR result to MongoDB: {str(e)}")


def search(file):
    try:
        # Find the document by file_name
        result = ocr_collection.find_one({"file_name": file})

        if result and "pages" in result:
            return result["pages"]
        else:
            logger.warning(f"No results found for file: {file}")
            return []

    except Exception as e:
        logger.exception(f"Error retrieving OCR result from MongoDB: {str(e)}")
        return []
