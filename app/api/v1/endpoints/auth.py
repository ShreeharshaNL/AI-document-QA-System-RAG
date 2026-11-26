from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/token")
async def login(req: LoginRequest):
    return {
        "access_token": "mock-jwt-token-shreeharsha-rag-system",
        "token_type": "bearer",
        "user": {"email": req.email, "role": "USER"}
    }
