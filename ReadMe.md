# 📄 Document OCR System

This project is a document processing pipeline designed to perform Optical Character Recognition (OCR) on uploaded PDF or image files. The system uses a React-based frontend and a Python FastAPI backend. OCR results are stored in MongoDB and displayed to the user through the web interface.

---

## 🏗️ Architecture

The system is built with a **two-tier architecture**:

### 1. React Frontend
- Built with React.js
- Allows users to upload documents (`.pdf`, `.jpg`, `.jpeg`)
- Sends files to the backend via an API call
- Displays extracted text (OCR results) to the user

### 2. FastAPI Backend
- Built using FastAPI (Python)
- Handles file uploads and validates file types
- Performs OCR using [PaddleOCR]([https://github.com/PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR))
- Saves OCR output (including average confidence and page numbers) into MongoDB
- Returns the processed result to the frontend

---

## 🔍 Search Functionality

- Documents are retrieved from MongoDB using the **exact filename** including its extension.
  > For example: `invoice.pdf`, `receipt.jpg`, etc.
- This ensures reliable and efficient lookup for document records.

---

## 🚀 Technologies Used

| Component     | Technology               |
|---------------|---------------------------|
| Frontend      | React.js                  |
| Backend       | FastAPI (Python 3.10)     |
| OCR Engine    | PaddleOCR                 |
| Database      | MongoDB                   |
| Container     | Docker                    |
