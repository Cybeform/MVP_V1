"""
Jobs batch pour la génération d'embeddings
Permet de lancer des tâches de traitement d'embeddings en arrière-plan
"""

import asyncio
import os
from typing import Optional
from sqlalchemy.orm import Session
from .database import get_db
from .embeddings import process_batch_embeddings, get_embedding_stats, DEFAULT_EMBEDDING_MODEL
from .models import DocumentChunk

class EmbeddingJobManager:
    """Gestionnaire des jobs d'embedding"""
    
    def __init__(self):
        self.current_job = None
        self.is_running = False
        self.job_stats = {}
    
    async def run_embedding_job(
        self,
        db: Session,
        model: str = DEFAULT_EMBEDDING_MODEL,
        batch_size: int = 5,  # Taille réduite pour éviter le rate limiting
        max_chunks: Optional[int] = None,
        force_reprocess: bool = False
    ) -> dict:
        """
        Lance un job de génération d'embeddings
        
        Args:
            db: Session de base de données
            model: Modèle OpenAI à utiliser
            batch_size: Nombre de chunks à traiter par batch
            max_chunks: Limite maximale de chunks à traiter
            force_reprocess: Force le retraitement des chunks existants
            
        Returns:
            Statistiques du job
        """
        if self.is_running:
            return {
                "error": "Un job d'embedding est déjà en cours",
                "current_job": self.current_job
            }
        
        self.is_running = True
        self.current_job = {
            "started_at": asyncio.get_event_loop().time(),
            "model": model,
            "batch_size": batch_size,
            "max_chunks": max_chunks,
            "force_reprocess": force_reprocess
        }
        
        try:
            print(f"🚀 Démarrage du job d'embedding (modèle: {model})")
            
            # Si force_reprocess, supprimer les embeddings existants
            if force_reprocess:
                print("🔄 Force reprocess: suppression des embeddings existants...")
                chunks_to_reset = db.query(DocumentChunk).filter(
                    DocumentChunk.embedding.isnot(None)
                ).all()
                
                for chunk in chunks_to_reset:
                    chunk.embedding = None
                    chunk.embedding_model = None
                    chunk.embedding_created_at = None
                
                db.commit()
                print(f"✅ {len(chunks_to_reset)} embeddings supprimés")
            
            # Lancer le traitement batch
            stats = await process_batch_embeddings(
                db=db,
                model=model,
                batch_size=batch_size,
                max_chunks=max_chunks
            )
            
            # Mettre à jour les statistiques du job
            self.current_job.update({
                "completed_at": asyncio.get_event_loop().time(),
                "status": "completed",
                "stats": stats
            })
            
            # Calculer la durée
            duration = self.current_job["completed_at"] - self.current_job["started_at"]
            self.current_job["duration_seconds"] = round(duration, 2)
            
            print(f"✅ Job d'embedding terminé en {duration:.2f}s")
            
            return self.current_job
            
        except Exception as e:
            error_msg = f"Erreur lors du job d'embedding: {e}"
            print(f"❌ {error_msg}")
            
            self.current_job.update({
                "completed_at": asyncio.get_event_loop().time(),
                "status": "failed",
                "error": str(e)
            })
            
            return self.current_job
            
        finally:
            self.is_running = False
            self.job_stats = self.current_job.copy()
    
    def get_job_status(self) -> dict:
        """Retourne le statut du job actuel"""
        if self.is_running:
            current_time = asyncio.get_event_loop().time()
            duration = current_time - self.current_job["started_at"]
            
            return {
                "status": "running",
                "duration_seconds": round(duration, 2),
                "job_details": self.current_job
            }
        elif self.job_stats:
            return {
                "status": "completed",
                "last_job": self.job_stats
            }
        else:
            return {
                "status": "idle",
                "message": "Aucun job d'embedding exécuté"
            }

# Instance globale du gestionnaire
embedding_job_manager = EmbeddingJobManager()

async def schedule_embedding_job(
    db: Session,
    model: str = DEFAULT_EMBEDDING_MODEL,
    batch_size: int = 5,
    max_chunks: Optional[int] = None,
    force_reprocess: bool = False
) -> dict:
    """
    Planifie un job d'embedding
    """
    return await embedding_job_manager.run_embedding_job(
        db=db,
        model=model,
        batch_size=batch_size,
        max_chunks=max_chunks,
        force_reprocess=force_reprocess
    )

def get_embedding_job_status() -> dict:
    """
    Retourne le statut des jobs d'embedding
    """
    return embedding_job_manager.get_job_status()

async def auto_generate_embeddings_for_new_chunks(db: Session, chunk_ids: list) -> dict:
    """
    Génère automatiquement les embeddings pour de nouveaux chunks
    """
    if not chunk_ids:
        return {"message": "Aucun chunk à traiter"}
    
    # Récupérer les chunks spécifiques
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.id.in_(chunk_ids),
        DocumentChunk.embedding.is_(None)
    ).all()
    
    if not chunks:
        return {"message": "Aucun chunk sans embedding trouvé"}
    
    from .embeddings import process_chunk_embedding
    
    stats = {
        "total_chunks": len(chunks),
        "processed": 0,
        "errors": 0
    }
    
    print(f"🔄 Génération automatique d'embeddings pour {len(chunks)} nouveaux chunks")
    
    for chunk in chunks:
        try:
            success = await process_chunk_embedding(chunk, db)
            if success:
                stats["processed"] += 1
            else:
                stats["errors"] += 1
                
            # Petite pause pour éviter le rate limiting
            await asyncio.sleep(0.2)
            
        except Exception as e:
            print(f"❌ Erreur chunk {chunk.id}: {e}")
            stats["errors"] += 1
    
    return stats

def check_embedding_requirements() -> dict:
    """
    Vérifie les prérequis pour les embeddings
    """
    requirements = {
        "openai_api_key": bool(os.getenv("OPENAI_API_KEY")),
        "openai_package": False,
        "numpy_package": False
    }
    
    try:
        import openai
        requirements["openai_package"] = True
    except ImportError:
        pass
    
    try:
        import numpy
        requirements["numpy_package"] = True
    except ImportError:
        pass
    
    requirements["all_requirements_met"] = all(requirements.values())
    
    return requirements 