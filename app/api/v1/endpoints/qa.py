from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class QuestionRequest(BaseModel):
    document_id: Optional[str] = None
    question: str

class Citation(BaseModel):
    chunk_index: int
    page_number: int
    content: str
    similarity_score: float

class AnswerResponse(BaseModel):
    question: str
    answer: str
    citations: List[Citation]

@router.post("/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    return AnswerResponse(
        question=request.question,
        answer="The system answers queries by extracting embeddings, querying pgvector using cosine distance (<=>), and generating citations.",
        citations=[
            Citation(
                chunk_index=0,
                page_number=1,
                content="Architecture uses vector embeddings to retrieve grounded contexts.",
                similarity_score=0.92
            )
        ]
    )
