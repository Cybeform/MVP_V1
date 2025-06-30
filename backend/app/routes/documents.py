import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db
from ..text_extraction import extract_text_from_file, get_text_preview
from ..dce_extraction import extract_dce_info_from_text_async, validate_extraction, websocket_manager
from ..cctp_chunking import process_cctp_document, get_document_chunks, get_chunks_by_lot, search_chunks_by_content
from ..embeddings import get_embedding_stats, search_similar_chunks, process_batch_embeddings
from ..embedding_jobs import schedule_embedding_job, get_embedding_job_status, check_embedding_requirements
from ..models import ExtractionStatus
from ..cache_service import redis_cache
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

def process_cctp_chunks_background(document_id: int, text: str, db: Session):
    """
    Traite le découpage CCTP en arrière-plan
    """
    try:
        print(f"Début du découpage CCTP pour le document {document_id}")
        
        # Traiter le document pour créer les chunks
        chunks = process_cctp_document(text, document_id, db)
        
        print(f"Découpage CCTP terminé: {len(chunks)} chunks créés pour le document {document_id}")
        
    except Exception as e:
        error_msg = f"Erreur lors du découpage CCTP pour le document {document_id}: {e}"
        print(error_msg)

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
    """Upload un document, extrait le texte, lance l'extraction DCE et crée les chunks CCTP en arrière-plan"""
    
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
    chunks_created = False
    
    try:
        # Utiliser l'extraction avec pages pour les PDF, normale pour les autres
        include_pages = file.content_type == "application/pdf"
        extracted_text = extract_text_from_file(file_path, file.content_type, include_pages=include_pages)
        
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
            
            # Lancer le découpage CCTP en arrière-plan (toujours activé)
            background_tasks.add_task(
                process_cctp_chunks_background,
                db_document.id,
                extracted_text,
                db
            )
            chunks_created = True
            
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
        dce_extraction_started=dce_extraction_started,
        chunks_created=chunks_created
    )

@router.get("/", response_model=List[schemas.Document])
def get_documents(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Obtenir la liste des documents de l'utilisateur"""
    documents = db.query(models.Document).filter(
        models.Document.owner_id == current_user.id
    ).order_by(models.Document.upload_date.desc()).all()
    
    return documents

@router.get("/{document_id}", response_model=schemas.Document)
def get_document_by_id(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Obtenir un document spécifique par son ID"""
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document non trouvé"
        )
    
    return document

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
    
    # 🗑️ Invalider le cache Q&A pour ce document
    try:
        deleted_cache_entries = redis_cache.invalidate_document_cache(document_id)
        if deleted_cache_entries > 0:
            print(f"🗑️ {deleted_cache_entries} entrées de cache Q&A supprimées pour le document {document_id}")
    except Exception as e:
        print(f"⚠️ Erreur lors de l'invalidation du cache: {e}")
        # On continue même si l'invalidation du cache échoue
    
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

@router.get("/{document_id}/chunks", response_model=List[schemas.DocumentChunk])
def get_document_chunks_endpoint(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupère tous les chunks d'un document"""
    
    # Vérifier que l'utilisateur est propriétaire du document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Récupérer les chunks
    chunks = get_document_chunks(document_id, db)
    
    return chunks

@router.get("/{document_id}/chunks/lot/{lot_name}", response_model=List[schemas.DocumentChunk])
def get_chunks_by_lot_endpoint(
    document_id: int,
    lot_name: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupère les chunks d'un lot spécifique"""
    
    # Vérifier que l'utilisateur est propriétaire du document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Récupérer les chunks du lot
    chunks = get_chunks_by_lot(document_id, lot_name, db)
    
    return chunks

@router.get("/{document_id}/chunks/search/{search_term}", response_model=List[schemas.DocumentChunk])
def search_chunks_endpoint(
    document_id: int,
    search_term: str,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Recherche dans le contenu des chunks d'un document"""
    
    # Vérifier que l'utilisateur est propriétaire du document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    # Rechercher dans les chunks
    chunks = search_chunks_by_content(document_id, search_term, db)
    
    return chunks

@router.get("/chunks/stats")
def get_chunks_stats(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupère les statistiques des chunks pour l'utilisateur"""
    
    # Récupérer tous les documents de l'utilisateur
    user_documents = db.query(models.Document).filter(
        models.Document.owner_id == current_user.id
    ).all()
    
    if not user_documents:
        return {
            "total_documents": 0,
            "total_chunks": 0,
            "chunks_by_document": [],
            "lots_detected": []
        }
    
    document_ids = [doc.id for doc in user_documents]
    
    # Statistiques globales
    total_chunks = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.document_id.in_(document_ids)
    ).count()
    
    # Chunks par document
    chunks_by_doc = db.query(
        models.Document.original_filename,
        func.count(models.DocumentChunk.id).label('chunk_count')
    ).join(
        models.DocumentChunk, models.Document.id == models.DocumentChunk.document_id
    ).filter(
        models.Document.owner_id == current_user.id
    ).group_by(
        models.Document.id, models.Document.original_filename
    ).all()
    
    # Lots détectés
    lots_detected = db.query(
        models.DocumentChunk.lot,
        func.count(models.DocumentChunk.id).label('chunk_count')
    ).filter(
        models.DocumentChunk.document_id.in_(document_ids),
        models.DocumentChunk.lot.isnot(None)
    ).group_by(
        models.DocumentChunk.lot
    ).all()
    
    return {
        "total_documents": len(user_documents),
        "total_chunks": total_chunks,
        "chunks_by_document": [
            {"filename": filename, "chunk_count": count}
            for filename, count in chunks_by_doc
        ],
        "lots_detected": [
            {"lot": lot, "chunk_count": count}
            for lot, count in lots_detected
        ]
    }

# ============ NOUVEAUX ENDPOINTS EMBEDDINGS ============

@router.get("/embeddings/stats")
def get_embeddings_stats(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Récupère les statistiques des embeddings"""
    
    # Vérifier les prérequis
    requirements = check_embedding_requirements()
    
    # Récupérer les statistiques
    stats = get_embedding_stats(db)
    
    return {
        "requirements": requirements,
        "stats": stats,
        "job_status": get_embedding_job_status()
    }

@router.post("/embeddings/generate")
async def generate_embeddings_job(
    background_tasks: BackgroundTasks,
    model: str = Query(default="text-embedding-3-large", description="Modèle OpenAI à utiliser"),
    batch_size: int = Query(default=5, ge=1, le=20, description="Taille des batches"),
    max_chunks: int = Query(default=None, ge=1, description="Limite maximale de chunks"),
    force_reprocess: bool = Query(default=False, description="Force le retraitement"),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Lance un job de génération d'embeddings en arrière-plan"""
    
    # Vérifier les prérequis
    requirements = check_embedding_requirements()
    if not requirements["all_requirements_met"]:
        missing = [k for k, v in requirements.items() if not v and k != "all_requirements_met"]
        raise HTTPException(
            status_code=503,
            detail=f"Prérequis manquants pour les embeddings: {', '.join(missing)}"
        )
    
    # Lancer le job en arrière-plan
    async def run_embedding_job():
        try:
            result = await schedule_embedding_job(
                db=db,
                model=model,
                batch_size=batch_size,
                max_chunks=max_chunks,
                force_reprocess=force_reprocess
            )
            print(f"✅ Job d'embedding terminé: {result}")
        except Exception as e:
            print(f"❌ Erreur job d'embedding: {e}")
    
    background_tasks.add_task(run_embedding_job)
    
    return {
        "message": "Job de génération d'embeddings lancé en arrière-plan",
        "parameters": {
            "model": model,
            "batch_size": batch_size,
            "max_chunks": max_chunks,
            "force_reprocess": force_reprocess
        }
    }

@router.get("/embeddings/job-status")
def get_embeddings_job_status(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Récupère le statut du job d'embeddings en cours"""
    return get_embedding_job_status()

@router.post("/chunks/search-semantic")
async def semantic_search_chunks(
    query: str = Query(..., description="Texte de recherche"),
    document_id: int = Query(default=None, description="ID du document (optionnel)"),
    limit: int = Query(default=10, ge=1, le=50, description="Nombre de résultats"),
    similarity_threshold: float = Query(default=0.7, ge=0.0, le=1.0, description="Seuil de similarité"),
    model: str = Query(default="text-embedding-3-large", description="Modèle d'embedding"),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Recherche sémantique dans les chunks"""
    
    # Vérifier les prérequis
    requirements = check_embedding_requirements()
    if not requirements["all_requirements_met"]:
        raise HTTPException(
            status_code=503,
            detail="Service de recherche sémantique non disponible"
        )
    
    # Si un document spécifique est demandé, vérifier les permissions
    if document_id:
        document = db.query(models.Document).filter(
            models.Document.id == document_id,
            models.Document.owner_id == current_user.id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document non trouvé")
    
    try:
        # Effectuer la recherche sémantique
        results = await search_similar_chunks(
            query_text=query,
            db=db,
            document_id=document_id,
            limit=limit,
            similarity_threshold=similarity_threshold,
            model=model
        )
        
        # Formater les résultats
        formatted_results = []
        for chunk, similarity in results:
            # Vérifier que l'utilisateur a accès au document du chunk
            if chunk.document.owner_id != current_user.id:
                continue
            
            formatted_results.append({
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "document_name": chunk.document.original_filename,
                "lot": chunk.lot,
                "article": chunk.article,
                "text": chunk.text[:500] + "..." if len(chunk.text) > 500 else chunk.text,
                "text_length": len(chunk.text),
                "page_number": chunk.page_number,
                "similarity_score": round(similarity, 4),
                "created_at": chunk.created_at
            })
        
        return {
            "query": query,
            "results_count": len(formatted_results),
            "parameters": {
                "document_id": document_id,
                "limit": limit,
                "similarity_threshold": similarity_threshold,
                "model": model
            },
            "results": formatted_results
        }
        
    except Exception as e:
        print(f"❌ Erreur recherche sémantique: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la recherche sémantique: {str(e)}"
        )

@router.post("/regenerate-embeddings/{document_id}")
async def regenerate_document_embeddings(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint temporaire pour régénérer les embeddings d'un document
    """
    # Vérifier que le document appartient à l'utilisateur
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    try:
        # Supprimer les anciens embeddings
        chunks = db.query(models.DocumentChunk).filter(
            models.DocumentChunk.document_id == document_id
        ).all()
        
        for chunk in chunks:
            chunk.embedding = None
            chunk.embedding_model = None
            chunk.embedding_created_at = None
        
        db.commit()
        
        # Régénérer les embeddings
        stats = await process_batch_embeddings(
            db=db,
            model='text-embedding-3-large',
            batch_size=5,
            max_chunks=None  # Traiter tous les chunks
        )
        
        return {
            "success": True,
            "message": f"Embeddings régénérés pour le document {document.original_filename}",
            "stats": stats
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Erreur lors de la régénération: {str(e)}"
        } 