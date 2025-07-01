from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, JSON, Float, Enum, LargeBinary
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
    
    # Relations
    projects = relationship("Project", back_populates="owner")
    documents = relationship("Document", back_populates="owner")
    qa_history = relationship("QAHistory", back_populates="user")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, default="#3B82F6")  # Couleur pour l'UI (hex)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Clé étrangère vers l'utilisateur
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relations
    owner = relationship("User", back_populates="projects")
    documents = relationship("Document", back_populates="project")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    
    # Clés étrangères
    owner_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # Relations
    owner = relationship("User", back_populates="documents")
    project = relationship("Project", back_populates="documents")
    extractions = relationship("Extraction", back_populates="document")
    chunks = relationship("DocumentChunk", back_populates="document")
    qa_history = relationship("QAHistory", back_populates="document")

class DocumentText(Base):
    __tablename__ = "document_texts"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    lot = Column(String, nullable=True)  # Ex: "Lot 02 - Gros œuvre"
    article = Column(String, nullable=True)  # Ex: "Article 2.1"
    text = Column(Text, nullable=False)  # Contenu du chunk
    page_number = Column(Integer, nullable=True)  # Numéro de page
    embedding = Column(LargeBinary, nullable=True)  # Vecteur d'embedding (format binaire)
    embedding_model = Column(String, nullable=True)  # Modèle utilisé pour l'embedding
    embedding_created_at = Column(DateTime(timezone=True), nullable=True)  # Date de création de l'embedding
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relation avec le document
    document = relationship("Document", back_populates="chunks")

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

class QAHistory(Base):
    __tablename__ = "qa_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)  # Peut être null si pas de réponse générée
    confidence = Column(String, nullable=True)  # "haute", "moyenne", "faible"
    processing_time_ms = Column(Integer, nullable=True)
    chunks_returned = Column(Integer, nullable=True)
    similarity_threshold = Column(Float, nullable=True)
    embedding_model = Column(String, nullable=True)  # Renommé de model_used
    from_cache = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relations
    user = relationship("User", back_populates="qa_history")
    document = relationship("Document", back_populates="qa_history") 