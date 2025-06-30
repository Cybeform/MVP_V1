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
    chunks_created: bool = False  # Nouveau champ pour indiquer si les chunks ont été créés

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

# Schémas pour les chunks de documents
class DocumentChunkBase(BaseModel):
    lot: Optional[str] = None
    article: Optional[str] = None
    text: str
    page_number: Optional[int] = None

class DocumentChunkCreate(DocumentChunkBase):
    document_id: int

class DocumentChunk(DocumentChunkBase):
    id: int
    document_id: int
    embedding_model: Optional[str] = None
    embedding_created_at: Optional[datetime] = None
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

# Schémas pour la recherche sémantique
class SemanticSearchResult(BaseModel):
    chunk_id: int
    document_id: int
    document_name: str
    lot: Optional[str] = None
    article: Optional[str] = None
    text: str
    text_length: int
    page_number: Optional[int] = None
    similarity_score: float
    created_at: datetime

class SemanticSearchResponse(BaseModel):
    query: str
    results_count: int
    parameters: dict
    results: List[SemanticSearchResult]

# Schémas pour les statistiques d'embedding
class EmbeddingStats(BaseModel):
    total_chunks: int
    with_embedding: int
    without_embedding: int
    completion_rate: float
    models_used: List[dict]

class EmbeddingRequirements(BaseModel):
    openai_api_key: bool
    openai_package: bool
    numpy_package: bool
    all_requirements_met: bool

class EmbeddingStatsResponse(BaseModel):
    requirements: EmbeddingRequirements
    stats: EmbeddingStats
    job_status: dict

# Schémas pour le système de Q&A
class QARequest(BaseModel):
    document_id: int
    question: str

class QAChunkResult(BaseModel):
    chunk_id: int
    lot: Optional[str] = None
    article: Optional[str] = None
    page_number: Optional[int] = None
    text: str
    text_length: int
    similarity_score: float
    created_at: datetime

class QACitation(BaseModel):
    lot: Optional[str] = None
    page: Optional[int] = None
    excerpt: str
    chunk_id: int

class QAResponse(BaseModel):
    document_id: int
    document_name: str
    question: str
    total_chunks_found: int
    chunks_returned: int
    processing_time_ms: int
    similarity_threshold: float
    embedding_model: str  # Renommé de model_used pour éviter le conflit Pydantic
    chunks: List[QAChunkResult]
    # Nouveaux champs pour la réponse GPT-4o
    answer: Optional[str] = None
    citations: Optional[List[QACitation]] = []
    confidence: Optional[str] = None  # "haute", "moyenne", "faible"
    gpt_model_used: Optional[str] = None
    answer_generation_time_ms: Optional[int] = None
    # Champ pour indiquer si la réponse vient du cache Redis
    from_cache: Optional[bool] = False

# Schémas pour l'historique Q&A
class QAHistoryBase(BaseModel):
    question: str
    answer: Optional[str] = None
    confidence: Optional[str] = None
    processing_time_ms: Optional[int] = None
    chunks_returned: Optional[int] = None
    similarity_threshold: Optional[float] = None
    embedding_model: Optional[str] = None  # Renommé de model_used
    from_cache: Optional[bool] = False

class QAHistoryCreate(QAHistoryBase):
    user_id: int
    document_id: int

class QAHistory(QAHistoryBase):
    id: int
    user_id: int
    document_id: int
    document_name: str  # Nom du document (jointure)
    created_at: datetime

    class Config:
        from_attributes = True

class QAHistoryResponse(BaseModel):
    total_entries: int
    page: int
    per_page: int
    total_pages: int
    history: List[QAHistory] 