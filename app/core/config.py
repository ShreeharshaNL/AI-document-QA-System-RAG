from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Document Q&A System (RAG)"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "default_secret_key_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5433/rag_db"
    EMBEDDING_DIMENSIONS: int = 384
    CHUNK_SIZE: int = 300
    CHUNK_OVERLAP: int = 50

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
