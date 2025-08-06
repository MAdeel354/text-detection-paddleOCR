import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from loguru import logger
from paddleocr import PaddleOCR

from utils import allowed_file, convert_pdf_to_images, save_ocr_to_mongodb, search

# Setup FastAPI
app = FastAPI()

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust if you want to restrict
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "output_images"
ALLOWED_EXTENSIONS = {'pdf'}

# Create necessary directories
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)
Path(OUTPUT_FOLDER).mkdir(parents=True, exist_ok=True)


def run_ocr(pdf_name: str, image_paths: list):
    """
    Run OCR on a list of image paths and save results.
    """
    ocr_instance = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        cpu_threads=3
    )

    results = []

    for image_path in image_paths:
        if not os.path.exists(image_path):
            logger.error(f"Image not found: {image_path}")
            continue

        logger.info(f"Processing image: {image_path}")
        result = ocr_instance.predict(input=image_path)

        if result:
            for res in result:
                text = res.get("rec_texts", [])
                confidence = res.get("rec_scores", [])
                avg_confidence = sum(confidence) / len(confidence) if confidence else 0.0
                page_num = res.get("input_path", "").split("\\")[-1] or ""

                save_ocr_to_mongodb(
                    pdf_name=pdf_name,
                    text=text,
                    avg_conf=avg_confidence,
                    page_num=page_num
                )

                out = {
                    "text": text,
                    "confidence": avg_confidence,
                    "page_num": page_num,
                    "pdf": pdf_name
                }
                results.append(out)
                return results
        else:
            logger.warning(f"No OCR results for {image_path}")

    return results


@app.post("/receiver")
async def receiver(file: UploadFile = File(...)):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No selected file")

        ext = file.filename.rsplit('.', 1)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid file type, only PDF and JPG allowed")

        if ext in ['jpg', 'jpeg']:
            # Save jpg file directly into OUTPUT_FOLDER
            unique_filename = f"{uuid.uuid4()}_{file.filename}"
            save_path = os.path.join(OUTPUT_FOLDER, unique_filename)

            # Read and write the file directly
            with open(save_path, "wb") as f:
                f.write(await file.read())

            # Run OCR directly on the saved jpg image (assuming run_ocr supports that)
            out = run_ocr(file.filename, [save_path])

            return {"flag": "True", "output": out}

        else:
            # For PDFs: save in UPLOAD_FOLDER and convert to images
            unique_filename = f"{uuid.uuid4()}_{file.filename}"
            pdf_path = os.path.join(UPLOAD_FOLDER, unique_filename)

            with open(pdf_path, "wb") as f:
                f.write(await file.read())

            success, image_paths = convert_pdf_to_images(pdf_path, OUTPUT_FOLDER)
            if not success or not image_paths:
                raise Exception("Failed to convert PDF to images")

            out = run_ocr(file.filename, image_paths)

            # Clean up PDF file
            try:
                os.remove(pdf_path)
            except Exception as e:
                logger.warning(f"Failed to delete temporary PDF: {str(e)}")

            return {"flag": "True", "output": out}

    except Exception as e:
        logger.exception(f"Error in convert_pdf endpoint")
        return JSONResponse(
            status_code=500,
            content={"flag": "False", "output": [], "error": str(e)}
        )

@app.get("/search_pdf")
def search_pdf(filename: str = Query(..., description="Name of the PDF to search")):
    try:
        logger.info(f"Searching for PDF: {filename}")
        results = search(filename)
        return {"flag": "True", "output": results}
    except Exception as e:
        logger.exception("Search failed")
        return JSONResponse(
            status_code=500,
            content={"flag": "False", "output": [], "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)