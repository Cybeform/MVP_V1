from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from ..database import get_db
from ..auth import get_current_user
from ..models import User, Project, Document, Extraction
from ..schemas import (
    ProjectCreate, 
    ProjectUpdate, 
    Project as ProjectSchema,
    ProjectWithStats
)

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Créer un nouveau projet"""
    db_project = Project(**project.dict(), owner_id=current_user.id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=List[ProjectWithStats])
def get_user_projects(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Obtenir tous les projets de l'utilisateur avec statistiques"""
    projects_query = db.query(
        Project,
        func.count(Document.id).label('documents_count'),
        func.count(Extraction.id).label('extractions_count'),
        func.max(Document.upload_date).label('last_activity')
    ).outerjoin(
        Document, Project.id == Document.project_id
    ).outerjoin(
        Extraction, Document.id == Extraction.document_id
    ).filter(
        Project.owner_id == current_user.id
    ).group_by(Project.id).all()
    
    # Convertir en schéma avec statistiques
    projects_with_stats = []
    for project, docs_count, extractions_count, last_activity in projects_query:
        project_dict = {
            **project.__dict__,
            'documents_count': docs_count or 0,
            'extractions_count': extractions_count or 0,
            'last_activity': last_activity
        }
        projects_with_stats.append(ProjectWithStats(**project_dict))
    
    return projects_with_stats

@router.get("/{project_id}", response_model=ProjectSchema)
def get_project(
    project_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Obtenir un projet spécifique"""
    project = db.query(Project).filter(
        Project.id == project_id, 
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet non trouvé"
        )
    
    return project

@router.put("/{project_id}", response_model=ProjectSchema)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Mettre à jour un projet"""
    project = db.query(Project).filter(
        Project.id == project_id, 
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet non trouvé"
        )
    
    # Mettre à jour les champs modifiés
    update_data = project_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    force: bool = False,  # Paramètre pour forcer la suppression
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Supprimer un projet et tous ses documents associés"""
    project = db.query(Project).filter(
        Project.id == project_id, 
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet non trouvé"
        )
    
    # Récupérer tous les documents du projet
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    
    if documents and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le projet contient {len(documents)} document(s). Utilisez force=true pour supprimer le projet et tous ses documents."
        )
    
    # Supprimer en cascade : extractions -> documents -> projet
    if documents:
        for document in documents:
            # Supprimer les extractions du document
            db.query(Extraction).filter(Extraction.document_id == document.id).delete()
            
            # Supprimer les chunks du document (si ils existent)
            from ..models import DocumentChunk
            db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
            
            # Supprimer l'historique Q&A du document (si il existe)  
            from ..models import QAHistory
            db.query(QAHistory).filter(QAHistory.document_id == document.id).delete()
            
            # Supprimer le texte extrait (si il existe)
            from ..models import DocumentText
            db.query(DocumentText).filter(DocumentText.filename == document.filename).delete()
        
        # Supprimer tous les documents du projet
        db.query(Document).filter(Document.project_id == project_id).delete()
    
    # Supprimer le projet
    db.delete(project)
    db.commit()
    
    return

@router.get("/{project_id}/stats")
def get_project_stats(
    project_id: int,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Obtenir les statistiques détaillées d'un projet"""
    project = db.query(Project).filter(
        Project.id == project_id, 
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet non trouvé"
        )
    
    # Statistiques des documents
    documents_count = db.query(Document).filter(Document.project_id == project_id).count()
    
    # Statistiques des extractions
    extractions_stats = db.query(
        Extraction.status,
        func.count(Extraction.id).label('count')
    ).join(Document).filter(
        Document.project_id == project_id
    ).group_by(Extraction.status).all()
    
    extractions_by_status = {status.value: 0 for status in Extraction.status.type}
    for status, count in extractions_stats:
        extractions_by_status[status.value] = count
    
    # Dernière activité
    last_upload = db.query(func.max(Document.upload_date)).filter(
        Document.project_id == project_id
    ).scalar()
    
    last_extraction = db.query(func.max(Extraction.created_at)).join(Document).filter(
        Document.project_id == project_id
    ).scalar()
    
    last_activity = max(filter(None, [last_upload, last_extraction]), default=None)
    
    return {
        "project_id": project_id,
        "project_name": project.name,
        "documents_count": documents_count,
        "extractions_by_status": extractions_by_status,
        "total_extractions": sum(extractions_by_status.values()),
        "last_activity": last_activity,
        "created_at": project.created_at
    } 