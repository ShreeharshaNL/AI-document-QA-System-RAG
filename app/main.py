from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import documents, qa, auth
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Production-grade AI Document Q&A System with RAG, pgvector, and FastAPI",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(qa.router, prefix="/api/v1/qa", tags=["Q&A"])

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "UP",
        "service": settings.PROJECT_NAME,
        "vector_db": "pgvector (PostgreSQL 16)",
        "embedding_dimensions": 384
    }
