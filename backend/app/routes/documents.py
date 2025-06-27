import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db
from ..text_extraction import extract_text_from_file, get_text_preview
from ..dce_extraction import extract_dce_info_from_text_async, validate_extraction, websocket_manager
from ..models import ExtractionStatus
from sqlalchemy import func

router = APIRouter(prefix="/documents", tags=["documents"])

# Dossier pour stocker les fichiers
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Types de fichiers autorisés
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx"
}

# Taille max: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024

async def process_dce_extraction_async(document_id: int, text: str, db: Session, user_id: str = None):
    """
    Traite l'extraction DCE en arrière-plan de manière asynchrone
    """
    extraction = None
    try:
        print(f"Début de l'extraction DCE pour le document {document_id}")
        
        # Créer une entrée d'extraction avec statut pending
        db_extraction = models.Extraction(
            document_id=document_id,
            status=ExtractionStatus.pending,
            progress=0
        )
        
        db.add(db_extraction)
        db.commit()
        db.refresh(db_extraction)
        extraction = db_extraction
        
        # Lancer l'extraction asynchrone
        extraction_data = await extract_dce_info_from_text_async(
            text, 
            db_extraction.id, 
            db,
            user_id
        )
        
        if extraction_data and validate_extraction(extraction_data):
            # Mettre à jour l'entrée avec les données extraites
            confidence_score = extraction_data.pop("confidence_score", 0.0)
            
            db_extraction.lot = extraction_data.get("lot")
            db_extraction.sous_lot = extraction_data.get("sous_lot")
            db_extraction.materiaux = extraction_data.get("materiaux", [])
            db_extraction.equipements = extraction_data.get("equipements", [])
            db_extraction.methodes_exec = extraction_data.get("methodes_exec", [])
            db_extraction.criteres_perf = extraction_data.get("criteres_perf", [])
            db_extraction.localisation = extraction_data.get("localisation")
            db_extraction.quantitatifs = [
                q.__dict__ if hasattr(q, '__dict__') else q 
                for q in extraction_data.get("quantitatifs", [])
            ]
            db_extraction.confidence_score = confidence_score
            db_extraction.status = ExtractionStatus.completed
            db_extraction.progress = 100
            db_extraction.completed_at = func.now()
            
            db.commit()
            print(f"Extraction DCE terminée avec succès pour le document {document_id}")
        else:
            # Marquer comme échoué si pas de données valides
            db_extraction.status = ExtractionStatus.failed
            db_extraction.error_message = "Aucune information DCE valide extraite"
            db_extraction.completed_at = func.now()
            db.commit()
            print(f"Aucune information DCE valide extraite pour le document {document_id}")
            
    except Exception as e:
        error_msg = f"Erreur lors de l'extraction DCE pour le document {document_id}: {e}"
        print(error_msg)
        
        if extraction:
            extraction.status = ExtractionStatus.failed
            extraction.error_message = str(e)
            extraction.completed_at = func.now()
            db.commit()
        
        # Notifier via WebSocket en cas d'erreur
        if user_id:
            await websocket_manager.send_progress(user_id, {
                "type": "extraction_error",
                "extraction_id": extraction.id if extraction else None,
                "error": str(e),
                "document_id": document_id
            })

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """Endpoint WebSocket pour les notifications en temps réel"""
    await websocket_manager.connect(websocket, user_id)
    try:
        while True:
            # Garder la connexion ouverte
            data = await websocket.receive_text()
            # Vous pouvez traiter les messages entrants ici si nécessaire
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, user_id)

@router.post("/upload", response_model=schemas.DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload un document, extrait le texte et lance l'extraction DCE en arrière-plan"""
    
    # Vérifier le type de fichier
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier non autorisé. Seuls PDF, DOCX et XLSX sont acceptés."
        )
    
    # Lire le fichier pour vérifier la taille
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Fichier trop volumineux. Taille maximale: 10MB"
        )
    
    # Générer un nom de fichier unique
    file_extension = ALLOWED_TYPES[file.content_type]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Sauvegarder le fichier
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de la sauvegarde du fichier"
        )
    
    # Créer l'entrée document en base de données
    db_document = models.Document(
        filename=unique_filename,
        original_filename=file.filename,
        file_size=len(content),
        file_type=file.content_type,
        file_path=file_path,
        owner_id=current_user.id
    )
    
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    # Extraire le texte du fichier
    text_extracted = False
    text_preview = None
    dce_extraction_started = False
    
    try:
        extracted_text = extract_text_from_file(file_path, file.content_type)
        
        if extracted_text:
            # Créer l'entrée dans document_texts
            db_text = models.DocumentText(
                filename=file.filename,
                text=extracted_text
            )
            
            db.add(db_text)
            db.commit()
            
            text_extracted = True
            text_preview = get_text_preview(extracted_text, 200)
            
            # Lancer l'extraction DCE en arrière-plan si la clé API OpenAI est disponible
            if os.getenv("OPENAI_API_KEY"):
                background_tasks.add_task(
                    process_dce_extraction_async, 
                    db_document.id, 
                    extracted_text, 
                    db,
                    str(current_user.id)
                )
                dce_extraction_started = True
            else:
                print("Clé API OpenAI non configurée - extraction DCE désactivée")
            
    except Exception as e:
        print(f"Erreur lors de l'extraction de texte: {e}")
        # L'extraction de texte échoue, mais on continue (le fichier est déjà sauvé)
    
    return schemas.DocumentResponse(
        id=db_document.id,
        original_filename=db_document.original_filename,
        file_type=db_document.file_type,
        file_size=db_document.file_size,
        upload_date=db_document.upload_date,
        message="Fichier uploadé avec succès",
        text_extracted=text_extracted,
        text_preview=text_preview,
        dce_extraction_started=dce_extraction_started
    )

@router.get("/", response_model=List[schemas.Document])
def get_documents(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer la liste des documents de l'utilisateur"""
    documents = db.query(models.Document).filter(
        models.Document.owner_id == current_user.id
    ).order_by(models.Document.upload_date.desc()).all()
    
    return documents

@router.get("/{document_id}/status")
def get_document_extraction_status(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer le statut de l'extraction d'un document"""
    
    # Vérifier que le document existe et appartient à l'utilisateur
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document non trouvé"
        )
    
    # Récupérer la dernière extraction pour ce document
    extraction = db.query(models.Extraction).filter(
        models.Extraction.document_id == document_id
    ).order_by(models.Extraction.created_at.desc()).first()
    
    if not extraction:
        return {
            "document_id": document_id,
            "status": "no_extraction",
            "progress": 0,
            "message": "Aucune extraction en cours ou terminée"
        }
    
    return {
        "document_id": document_id,
        "extraction_id": extraction.id,
        "status": extraction.status.value,
        "progress": extraction.progress,
        "error_message": extraction.error_message,
        "started_at": extraction.started_at,
        "completed_at": extraction.completed_at,
        "created_at": extraction.created_at
    }

@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Télécharger un document"""
    
    # Vérifier que le document existe et appartient à l'utilisateur
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document non trouvé"
        )
    
    # Vérifier que le fichier existe sur le disque
    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=404,
            detail="Fichier non trouvé sur le serveur"
        )
    
    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type=document.file_type
    )

@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Supprimer un document et son fichier associé"""
    
    # Vérifier que le document existe et appartient à l'utilisateur
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document non trouvé"
        )
    
    # Supprimer le fichier physique
    try:
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
    except Exception as e:
        print(f"Erreur lors de la suppression du fichier: {e}")
        # On continue même si la suppression du fichier échoue
    
    # Supprimer les extractions associées
    db.query(models.Extraction).filter(
        models.Extraction.document_id == document_id
    ).delete()
    
    # Supprimer l'entrée en base de données
    db.delete(document)
    db.commit()
    
    return {"message": "Document supprimé avec succès"}

@router.get("/texts/", response_model=List[schemas.DocumentText])
def get_document_texts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Récupérer tous les textes extraits des documents"""
    texts = db.query(models.DocumentText).all()
    return texts

@router.get("/texts/{filename}")
def get_document_text_by_filename(
    filename: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Récupérer le texte extrait d'un document par nom de fichier"""
    
    text_doc = db.query(models.DocumentText).filter(
        models.DocumentText.filename == filename
    ).first()
    
    if not text_doc:
        raise HTTPException(
            status_code=404,
            detail="Texte de document non trouvé"
        )
    
    return {
        "filename": text_doc.filename,
        "text": text_doc.text,
        "created_at": text_doc.created_at,
        "text_length": len(text_doc.text),
        "preview": get_text_preview(text_doc.text, 200)
    }

@router.get("/{document_id}/extraction", response_model=schemas.Extraction)
def get_document_extraction(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer l'extraction DCE d'un document"""
    
    # Vérifier que le document existe et appartient à l'utilisateur
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document non trouvé"
        )
    
    # Récupérer l'extraction la plus récente pour ce document
    extraction = db.query(models.Extraction).filter(
        models.Extraction.document_id == document_id,
        models.Extraction.status == ExtractionStatus.completed
    ).order_by(models.Extraction.created_at.desc()).first()
    
    if not extraction:
        raise HTTPException(
            status_code=404,
            detail="Aucune extraction DCE terminée trouvée pour ce document"
        )
    
    return extraction

@router.get("/extractions/", response_model=List[schemas.Extraction])
def get_all_extractions(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupérer toutes les extractions DCE de l'utilisateur"""
    
    # Récupérer toutes les extractions terminées des documents de l'utilisateur  
    extractions = db.query(models.Extraction).join(
        models.Document
    ).filter(
        models.Document.owner_id == current_user.id,
        models.Extraction.status == ExtractionStatus.completed
    ).order_by(models.Extraction.created_at.desc()).all()
    
    return extractions

@router.post("/{document_id}/extract-dce")
async def manual_dce_extraction(
    document_id: int,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Lancer manuellement une extraction DCE pour un document"""
    
    # Vérifier que le document existe et appartient à l'utilisateur
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document non trouvé"
        )
    
    # Vérifier qu'il n'y a pas déjà une extraction en cours
    existing_extraction = db.query(models.Extraction).filter(
        models.Extraction.document_id == document_id,
        models.Extraction.status.in_([ExtractionStatus.pending, ExtractionStatus.processing])
    ).first()
    
    if existing_extraction:
        raise HTTPException(
            status_code=400,
            detail="Une extraction est déjà en cours pour ce document"
        )
    
    # Récupérer le texte du document
    text_doc = db.query(models.DocumentText).filter(
        models.DocumentText.filename == document.original_filename
    ).first()
    
    if not text_doc:
        raise HTTPException(
            status_code=400,
            detail="Texte du document non trouvé. Veuillez d'abord uploader le document."
        )
    
    # Vérifier que l'API OpenAI est configurée
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Service d'extraction DCE non disponible. Clé API OpenAI non configurée."
        )
    
    # Lancer l'extraction en arrière-plan
    background_tasks.add_task(
        process_dce_extraction_async, 
        document_id, 
        text_doc.text, 
        db,
        str(current_user.id)
    )
    
    return {
        "message": "Extraction DCE lancée en arrière-plan",
        "document_id": document_id,
        "status": "pending"
    } 