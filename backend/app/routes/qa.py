"""
Routes pour le système de Question-Answering (Q&A)
Permet de poser des questions sur les documents et obtenir des réponses basées sur les embeddings
"""

import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db
from ..qa_system import ask_question, validate_qa_request, qa_engine
from ..embedding_jobs import check_embedding_requirements
from ..cache_service import redis_cache

router = APIRouter(prefix="/qa", tags=["Question-Answering"])

@router.get("/test")
async def test_qa_endpoint():
    """Endpoint de test pour vérifier que les routes Q&A fonctionnent"""
    return {"message": "✅ Les routes Q&A fonctionnent correctement", "status": "ok"}

def save_qa_to_history(
    db: Session,
    user_id: int,
    document_id: int,
    question: str,
    qa_response: schemas.QAResponse
):
    """Sauvegarde une question-réponse dans l'historique"""
    try:
        qa_history = models.QAHistory(
            user_id=user_id,
            document_id=document_id,
            question=question,
            answer=qa_response.answer,
            confidence=qa_response.confidence,
            processing_time_ms=qa_response.processing_time_ms,
            chunks_returned=qa_response.chunks_returned,
            similarity_threshold=qa_response.similarity_threshold,
            embedding_model=qa_response.embedding_model,
            from_cache=qa_response.from_cache
        )
        
        db.add(qa_history)
        db.commit()
        print(f"📝 Question sauvegardée dans l'historique: {question[:50]}...")
        
    except Exception as e:
        print(f"⚠️ Erreur sauvegarde historique: {e}")
        # On ne fait pas échouer la requête si la sauvegarde échoue
        db.rollback()

@router.post("/ask", response_model=schemas.QAResponse)
async def ask_document_question(
    qa_request: schemas.QARequest,
    similarity_threshold: Optional[float] = Query(
        default=0.5,  # Augmenté pour plus de précision 
        ge=0.0, 
        le=1.0, 
        description="Seuil de similarité minimum (0.0 à 1.0) - Recommandé: 0.5 pour documents CCTP"
    ),
    chunks_limit: Optional[int] = Query(
        default=10,  # Augmenté pour plus de contexte
        ge=1, 
        le=25,  # Augmenté la limite maximale
        description="Nombre maximum de chunks à retourner (recommandé: 10 pour analyse approfondie)"
    ),
    model: str = Query(
        default="text-embedding-3-large", 
        description="Modèle d'embedding à utiliser"
    ),
    generate_answer: bool = Query(
        default=True,
        description="Génère une réponse intelligente avec GPT-4o basée sur les passages trouvés"
    ),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Pose une question sur un document spécifique et retourne les sections les plus pertinentes.
    
    **🚀 SYSTÈME OPTIMISÉ pour documents CCTP:**
    - Recherche sémantique améliorée avec préprocessing des questions
    - Paramètres par défaut optimisés pour le domaine BTP
    - Réponses GPT-4o spécialisées avec expertise technique
    - Recherche adaptative qui ajuste automatiquement les paramètres
    
    **💾 Système de cache activé:**
    - Les réponses sont mises en cache pendant 24h
    - Clé de cache basée sur: document_id + question + paramètres
    - Améliore considérablement les performances pour les questions répétées
    
    **📊 Historique automatique:**
    - Toutes les questions et réponses sont automatiquement sauvegardées
    - Accessible via l'endpoint `/qa/history`
    
    **⚙️ Paramètres optimisés:**
    - `document_id`: ID du document à analyser
    - `question`: Question à poser sur le document
    - `similarity_threshold`: Seuil de précision (défaut: 0.5 - optimisé pour CCTP)
    - `chunks_limit`: Nombre de passages analysés (défaut: 10 - pour analyse approfondie)
    - `model`: Modèle d'embedding à utiliser (text-embedding-3-large)
    - `generate_answer`: Active la génération de réponse intelligente GPT-4o (défaut: True)
    
    **📋 Retour enrichi:**
    - Liste des chunks les plus pertinents avec métadonnées techniques
    - Scores de similarité interprétés
    - Réponse générée par GPT-4o avec expertise BTP et citations précises
    - Niveau de confiance calculé sur plusieurs facteurs
    - Temps de traitement et statistiques détaillées
    - Flag `from_cache` pour indiquer si la réponse provient du cache
    
    **🎯 Spécialisations BTP:**
    - Préprocessing des questions pour corriger l'orthographe et enrichir le vocabulaire technique
    - Prompts GPT spécialisés pour les documents CCTP avec connaissance des normes DTU, NF
    - Détection automatique des thèmes (matériaux, performances, contrôles, normes...)
    - Citations enrichies avec extraction intelligente des passages pertinents
    """
    
    try:
        # Paramètres pour le cache
        cache_params = {
            "similarity_threshold": similarity_threshold,
            "chunks_limit": chunks_limit,
            "model": model,
            "generate_answer": generate_answer
        }
        
        # 🎯 ÉTAPE 1: Vérifier le cache Redis
        cached_response = redis_cache.get_cached_response(
            document_id=qa_request.document_id,
            question=qa_request.question,
            **cache_params
        )
        
        if cached_response:
            # Ajouter un flag pour indiquer que la réponse vient du cache
            cached_response.from_cache = True
            print(f"🎯 Réponse servie depuis le cache pour: {qa_request.question[:50]}...")
            
            # 📝 Sauvegarder dans l'historique même si c'est du cache
            save_qa_to_history(db, current_user.id, qa_request.document_id, qa_request.question, cached_response)
            
            return cached_response
        
        # 🔍 ÉTAPE 2: Traitement normal si pas en cache
        print(f"💻 Traitement de la question (pas en cache): {qa_request.question[:50]}...")
        
        # Vérifier les prérequis
        requirements = check_embedding_requirements()
        if not requirements["all_requirements_met"]:
            missing = [k for k, v in requirements.items() if not v and k != "all_requirements_met"]
            raise HTTPException(
                status_code=503,
                detail=f"Service de Q&A non disponible. Prérequis manquants: {', '.join(missing)}"
            )
        
        # Valider la requête
        validation_errors = validate_qa_request(qa_request.document_id, qa_request.question)
        if validation_errors:
            raise HTTPException(
                status_code=400,
                detail=f"Erreurs de validation: {'; '.join(validation_errors)}"
            )
        
        # Exécuter la recherche Q&A
        qa_response = await ask_question(
            document_id=qa_request.document_id,
            question=qa_request.question,
            db=db,
            user_id=current_user.id,
            similarity_threshold=similarity_threshold,
            chunks_limit=chunks_limit,
            model=model,
            generate_answer=generate_answer
        )
        
        # 💾 ÉTAPE 3: Mettre en cache la réponse
        qa_response.from_cache = False  # Réponse fraîchement calculée
        
        cache_success = redis_cache.cache_response(
            document_id=qa_request.document_id,
            question=qa_request.question,
            qa_response=qa_response,
            **cache_params
        )
        
        if cache_success:
            print(f"💾 Réponse mise en cache pour: {qa_request.question[:50]}...")
        else:
            print(f"⚠️ Impossible de mettre en cache la réponse")
        
        # 📝 ÉTAPE 4: Sauvegarder dans l'historique
        save_qa_to_history(db, current_user.id, qa_request.document_id, qa_request.question, qa_response)
        
        return qa_response
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Erreur dans ask_document_question: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du traitement de la question: {str(e)}"
        )

@router.get("/summary/{document_id}")
async def get_qa_summary(
    document_id: int,
    question: str = Query(..., description="Question à poser"),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retourne un résumé textuel formaté de la réponse à une question.
    Utile pour l'affichage ou l'export de réponses.
    """
    
    try:
        # Créer la requête Q&A
        qa_request = schemas.QARequest(document_id=document_id, question=question)
        
        # Exécuter la recherche
        qa_response = await ask_question(
            document_id=document_id,
            question=question,
            db=db,
            user_id=current_user.id
        )
        
        # Formater le résumé
        summary = qa_engine.format_answer_summary(qa_response)
        
        return {
            "document_id": document_id,
            "question": question,
            "chunks_found": qa_response.chunks_returned,
            "processing_time_ms": qa_response.processing_time_ms,
            "summary": summary
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Erreur dans get_qa_summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la génération du résumé: {str(e)}"
        )

@router.get("/best-match/{document_id}")
async def get_best_matching_chunk(
    document_id: int,
    question: str = Query(..., description="Question à poser"),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retourne uniquement le chunk avec le meilleur score de similarité.
    Idéal pour obtenir la réponse la plus pertinente à une question.
    """
    
    try:
        # Exécuter la recherche (limite à 1 chunk pour optimiser)
        qa_response = await ask_question(
            document_id=document_id,
            question=question,
            db=db,
            user_id=current_user.id,
            chunks_limit=1
        )
        
        if not qa_response.chunks:
            raise HTTPException(
                status_code=404,
                detail="Aucune section pertinente trouvée pour cette question"
            )
        
        best_chunk = qa_response.chunks[0]  # Premier chunk = meilleur score
        
        return {
            "document_id": document_id,
            "document_name": qa_response.document_name,
            "question": question,
            "best_match": best_chunk,
            "processing_time_ms": qa_response.processing_time_ms,
            "confidence": "haute" if best_chunk.similarity_score >= 0.8 else 
                         "moyenne" if best_chunk.similarity_score >= 0.6 else "faible"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"❌ Erreur dans get_best_matching_chunk: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la recherche du meilleur match: {str(e)}"
        )

@router.get("/stats")
def get_qa_stats(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retourne les statistiques du système Q&A pour l'utilisateur.
    Inclut maintenant les statistiques du cache Redis.
    """
    
    # Compter les documents de l'utilisateur
    total_documents = db.query(models.Document).filter(
        models.Document.owner_id == current_user.id
    ).count()
    
    # Compter les chunks avec embeddings
    documents_with_chunks = db.query(models.Document).join(
        models.DocumentChunk
    ).filter(
        models.Document.owner_id == current_user.id,
        models.DocumentChunk.embedding.isnot(None)
    ).distinct().count()
    
    # Compter le total de chunks avec embeddings
    total_chunks_with_embeddings = db.query(models.DocumentChunk).join(
        models.Document
    ).filter(
        models.Document.owner_id == current_user.id,
        models.DocumentChunk.embedding.isnot(None)
    ).count()
    
    # Vérifier les prérequis
    requirements = check_embedding_requirements()
    
    # Statistiques du cache Redis
    cache_stats = redis_cache.get_cache_stats()
    
    return {
        "user_documents": total_documents,
        "documents_ready_for_qa": documents_with_chunks,
        "total_searchable_chunks": total_chunks_with_embeddings,
        "qa_ready_percentage": round(
            (documents_with_chunks / total_documents * 100) if total_documents > 0 else 0, 
            1
        ),
        "system_requirements": requirements,
        "cache_system": cache_stats,
        "default_settings": {
            "similarity_threshold": qa_engine.default_similarity_threshold,
            "chunks_limit": qa_engine.default_chunks_limit,
            "max_text_length": qa_engine.max_text_length,
            "cache_ttl_hours": 24
        }
    }

# ============ NOUVEAUX ENDPOINTS POUR LA GESTION DU CACHE ============

@router.get("/cache/stats")
def get_cache_stats(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Retourne les statistiques détaillées du cache Redis Q&A
    """
    return redis_cache.get_cache_stats()

@router.delete("/cache/document/{document_id}")
def invalidate_document_cache(
    document_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Invalide toutes les entrées de cache pour un document spécifique
    Utile après modification ou mise à jour d'un document
    """
    
    # Vérifier que l'utilisateur possède le document
    document = db.query(models.Document).filter(
        models.Document.id == document_id,
        models.Document.owner_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    
    deleted_count = redis_cache.invalidate_document_cache(document_id)
    
    return {
        "message": f"Cache invalidé pour le document {document_id}",
        "document_name": document.original_filename,
        "entries_deleted": deleted_count
    }

@router.delete("/cache/clear")
def clear_qa_cache(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Efface tout le cache Q&A (utile pour le debug ou maintenance)
    ⚠️ Attention: cette action est irréversible
    """
    deleted_count = redis_cache.clear_all_qa_cache()
    
    return {
        "message": "Cache Q&A entièrement vidé",
        "entries_deleted": deleted_count,
        "warning": "Toutes les réponses en cache ont été supprimées"
    }

# ============ NOUVEAUX ENDPOINTS POUR L'HISTORIQUE Q&A ============

@router.get("/history", response_model=schemas.QAHistoryResponse)
def get_qa_history(
    page: int = Query(default=1, ge=1, description="Numéro de page"),
    per_page: int = Query(default=20, ge=1, le=100, description="Nombre d'entrées par page"),
    document_id: Optional[int] = Query(default=None, description="Filtrer par document"),
    search: Optional[str] = Query(default=None, description="Rechercher dans les questions"),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupère l'historique des questions-réponses de l'utilisateur avec pagination
    
    **Paramètres:**
    - `page`: Numéro de page (défaut: 1)
    - `per_page`: Nombre d'entrées par page (défaut: 20, max: 100)
    - `document_id`: Filtrer par document spécifique (optionnel)
    - `search`: Rechercher dans les questions (optionnel)
    
    **Retour:**
    - Liste paginée de l'historique Q&A avec métadonnées de pagination
    """
    
    # Construction de la requête de base
    query = db.query(
        models.QAHistory,
        models.Document.original_filename.label('document_name')
    ).join(
        models.Document
    ).filter(
        models.QAHistory.user_id == current_user.id
    )
    
    # Filtrage par document
    if document_id:
        # Vérifier que l'utilisateur possède le document
        document = db.query(models.Document).filter(
            models.Document.id == document_id,
            models.Document.owner_id == current_user.id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document non trouvé")
        
        query = query.filter(models.QAHistory.document_id == document_id)
    
    # Recherche dans les questions
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(models.QAHistory.question.ilike(search_term))
    
    # Compter le total d'entrées
    total_entries = query.count()
    
    # Calculer la pagination
    total_pages = (total_entries + per_page - 1) // per_page
    offset = (page - 1) * per_page
    
    # Récupérer les résultats paginés
    results = query.order_by(
        models.QAHistory.created_at.desc()
    ).offset(offset).limit(per_page).all()
    
    # Formater les résultats
    history_items = []
    for qa_history, document_name in results:
        history_item = schemas.QAHistory(
            id=qa_history.id,
            user_id=qa_history.user_id,
            document_id=qa_history.document_id,
            document_name=document_name,
            question=qa_history.question,
            answer=qa_history.answer,
            confidence=qa_history.confidence,
            processing_time_ms=qa_history.processing_time_ms,
            chunks_returned=qa_history.chunks_returned,
            similarity_threshold=qa_history.similarity_threshold,
            embedding_model=qa_history.embedding_model,
            from_cache=qa_history.from_cache,
            created_at=qa_history.created_at
        )
        history_items.append(history_item)
    
    return schemas.QAHistoryResponse(
        total_entries=total_entries,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        history=history_items
    )

@router.get("/history/{history_id}", response_model=schemas.QAHistory)
def get_qa_history_item(
    history_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupère une entrée spécifique de l'historique Q&A
    """
    
    result = db.query(
        models.QAHistory,
        models.Document.original_filename.label('document_name')
    ).join(
        models.Document
    ).filter(
        models.QAHistory.id == history_id,
        models.QAHistory.user_id == current_user.id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Entrée d'historique non trouvée")
    
    qa_history, document_name = result
    
    return schemas.QAHistory(
        id=qa_history.id,
        user_id=qa_history.user_id,
        document_id=qa_history.document_id,
        document_name=document_name,
        question=qa_history.question,
        answer=qa_history.answer,
        confidence=qa_history.confidence,
        processing_time_ms=qa_history.processing_time_ms,
        chunks_returned=qa_history.chunks_returned,
        similarity_threshold=qa_history.similarity_threshold,
        embedding_model=qa_history.embedding_model,
        from_cache=qa_history.from_cache,
        created_at=qa_history.created_at
    )

@router.delete("/history/{history_id}")
def delete_qa_history_item(
    history_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Supprime une entrée spécifique de l'historique Q&A
    """
    
    qa_history = db.query(models.QAHistory).filter(
        models.QAHistory.id == history_id,
        models.QAHistory.user_id == current_user.id
    ).first()
    
    if not qa_history:
        raise HTTPException(status_code=404, detail="Entrée d'historique non trouvée")
    
    db.delete(qa_history)
    db.commit()
    
    return {"message": "Entrée d'historique supprimée avec succès"}

@router.delete("/history")
def clear_qa_history(
    document_id: Optional[int] = Query(default=None, description="Supprimer seulement pour ce document"),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Supprime l'historique Q&A de l'utilisateur
    
    **Paramètres:**
    - `document_id`: Si spécifié, supprime seulement l'historique pour ce document
    
    ⚠️ Attention: cette action est irréversible
    """
    
    query = db.query(models.QAHistory).filter(
        models.QAHistory.user_id == current_user.id
    )
    
    if document_id:
        # Vérifier que l'utilisateur possède le document
        document = db.query(models.Document).filter(
            models.Document.id == document_id,
            models.Document.owner_id == current_user.id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document non trouvé")
        
        query = query.filter(models.QAHistory.document_id == document_id)
    
    deleted_count = query.count()
    query.delete()
    db.commit()
    
    message = f"Historique Q&A supprimé"
    if document_id:
        message += f" pour le document {document_id}"
    
    return {
        "message": message,
        "entries_deleted": deleted_count,
        "warning": "Cette action est irréversible"
    }

@router.get("/history/stats")
def get_qa_history_stats(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retourne les statistiques de l'historique Q&A de l'utilisateur
    """
    
    # Statistiques générales
    total_questions = db.query(models.QAHistory).filter(
        models.QAHistory.user_id == current_user.id
    ).count()
    
    questions_with_answers = db.query(models.QAHistory).filter(
        models.QAHistory.user_id == current_user.id,
        models.QAHistory.answer.isnot(None)
    ).count()
    
    questions_from_cache = db.query(models.QAHistory).filter(
        models.QAHistory.user_id == current_user.id,
        models.QAHistory.from_cache == True
    ).count()
    
    # Répartition par confiance
    confidence_stats = db.query(
        models.QAHistory.confidence,
        db.func.count(models.QAHistory.id).label('count')
    ).filter(
        models.QAHistory.user_id == current_user.id,
        models.QAHistory.confidence.isnot(None)
    ).group_by(models.QAHistory.confidence).all()
    
    # Questions par document
    documents_stats = db.query(
        models.Document.original_filename,
        models.Document.id,
        db.func.count(models.QAHistory.id).label('question_count')
    ).join(
        models.QAHistory
    ).filter(
        models.QAHistory.user_id == current_user.id
    ).group_by(
        models.Document.id, models.Document.original_filename
    ).order_by(db.func.count(models.QAHistory.id).desc()).all()
    
    return {
        "total_questions": total_questions,
        "questions_with_answers": questions_with_answers,
        "questions_from_cache": questions_from_cache,
        "cache_hit_rate": round((questions_from_cache / total_questions * 100) if total_questions > 0 else 0, 1),
        "answer_rate": round((questions_with_answers / total_questions * 100) if total_questions > 0 else 0, 1),
        "confidence_distribution": [
            {"confidence": conf, "count": count} 
            for conf, count in confidence_stats
        ],
        "most_questioned_documents": [
            {
                "document_id": doc_id,
                "document_name": doc_name,
                "question_count": count
            }
            for doc_name, doc_id, count in documents_stats[:10]  # Top 10
        ]
    } 