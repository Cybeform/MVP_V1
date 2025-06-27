from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/users", tags=["utilisateurs"])

@router.get("/", response_model=List[schemas.User])
def read_users(
    skip: int = 0, 
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Obtenir la liste des utilisateurs (route protégée)"""
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users 