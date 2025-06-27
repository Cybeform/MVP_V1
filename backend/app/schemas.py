from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from enum import Enum

# Enum pour les statuts d'extraction
class ExtractionStatusEnum(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"

# Schémas pour les utilisateurs
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Schémas pour l'authentification
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Schémas pour les documents
class DocumentBase(BaseModel):
    original_filename: str
    file_type: str
    file_size: int

class DocumentCreate(DocumentBase):
    filename: str
    file_path: str

class Document(DocumentBase):
    id: int
    filename: str
    upload_date: datetime
    owner_id: int

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: int
    original_filename: str
    file_type: str
    file_size: int
    upload_date: datetime
    message: str = "Fichier uploadé avec succès"
    text_extracted: bool = False
    text_preview: Optional[str] = None
    dce_extraction_started: bool = False

# Schémas pour les textes extraits
class DocumentTextBase(BaseModel):
    filename: str
    text: str

class DocumentTextCreate(DocumentTextBase):
    pass

class DocumentText(DocumentTextBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Schémas pour les quantitatifs
class Quantitatif(BaseModel):
    label: str
    qty: float
    unite: str

# Schémas pour les extractions DCE
class ExtractionBase(BaseModel):
    lot: Optional[str] = None
    sous_lot: Optional[str] = None
    materiaux: Optional[List[str]] = []
    equipements: Optional[List[str]] = []
    methodes_exec: Optional[List[str]] = []
    criteres_perf: Optional[List[str]] = []
    localisation: Optional[str] = None
    quantitatifs: Optional[List[Quantitatif]] = []

class ExtractionCreate(ExtractionBase):
    document_id: int
    confidence_score: Optional[float] = None
    status: ExtractionStatusEnum = ExtractionStatusEnum.pending
    progress: int = 0

class Extraction(ExtractionBase):
    id: int
    document_id: int
    confidence_score: Optional[float] = None
    status: ExtractionStatusEnum
    progress: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Schéma pour le statut d'extraction
class ExtractionStatus(BaseModel):
    document_id: int
    extraction_id: Optional[int] = None
    status: str
    progress: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    message: Optional[str] = None

# Schema pour la fonction OpenAI
class DCEExtractionFunction(BaseModel):
    lot: str
    sous_lot: str
    materiaux: List[str]
    equipements: List[str]
    methodes_exec: List[str]
    criteres_perf: List[str]
    localisation: str
    quantitatifs: List[Quantitatif] 