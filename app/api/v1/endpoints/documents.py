from fastapi import APIRouter, UploadFile, File
from typing import List

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    contents = await file.read()
    return {
        "filename": file.filename,
        "size_bytes": len(contents),
        "status": "PROCESSED",
        "chunks_extracted": 5
    }

@router.get("/")
async def list_documents():
    return {
        "documents": [
            {"id": "doc-1", "title": "System Architecture Handbook", "chunks": 3},
            {"id": "doc-2", "title": "LegalLens Knowledge Base", "chunks": 3}
        ]
    }
