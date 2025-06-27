from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, JSON, Float, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum

class ExtractionStatus(enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relation avec les documents
    documents = relationship("Document", back_populates="owner")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    
    # Clé étrangère vers l'utilisateur
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="documents")
    
    # Relation avec les extractions
    extractions = relationship("Extraction", back_populates="document")

class DocumentText(Base):
    __tablename__ = "document_texts"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    lot = Column(String, nullable=True)
    sous_lot = Column(String, nullable=True)
    materiaux = Column(JSON, nullable=True)  # Liste de strings
    equipements = Column(JSON, nullable=True)  # Liste de strings
    methodes_exec = Column(JSON, nullable=True)  # Liste de strings
    criteres_perf = Column(JSON, nullable=True)  # Liste de strings
    localisation = Column(String, nullable=True)
    quantitatifs = Column(JSON, nullable=True)  # Liste d'objets {label, qty, unite}
    confidence_score = Column(Float, nullable=True)  # Score de confiance de l'extraction
    status = Column(Enum(ExtractionStatus), default=ExtractionStatus.pending, nullable=False)
    progress = Column(Integer, default=0, nullable=False)  # Progression en pourcentage (0-100)
    error_message = Column(Text, nullable=True)  # Message d'erreur en cas d'échec
    started_at = Column(DateTime(timezone=True), nullable=True)  # Début du traitement
    completed_at = Column(DateTime(timezone=True), nullable=True)  # Fin du traitement
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relation avec le document
    document = relationship("Document", back_populates="extractions") 