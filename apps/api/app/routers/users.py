from fastapi import APIRouter, Depends

from app.models.core import User
from app.schemas.user import UserRead
from app.security import get_current_user

router = APIRouter(tags=["users"])


@router.get("/users/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
