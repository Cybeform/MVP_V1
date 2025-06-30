"""
Module de gestion des embeddings vectoriels avec OpenAI
Supporte les modèles d'embedding text-embedding-3-large et text-embedding-3-small
"""

import os
import json
import struct
import numpy as np
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import DocumentChunk
import asyncio
import time

# Configuration OpenAI
OPENAI_CLIENT = None

def get_openai_client():
    """Initialise et retourne le client OpenAI"""
    global OPENAI_CLIENT
    
    if OPENAI_CLIENT is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY non configurée")
        
        try:
            import openai
            OPENAI_CLIENT = openai.OpenAI(api_key=api_key)
        except ImportError:
            raise ImportError("Package 'openai' non installé")
    
    return OPENAI_CLIENT

# Configuration des modèles d'embedding
EMBEDDING_MODELS = {
    "text-embedding-3-large": {
        "dimensions": 1536,
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.00013
    },
    "text-embedding-3-small": {
        "dimensions": 512,
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.00002
    }
}

DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"

def prepare_text_for_embedding(text: str, max_tokens: int = 8000) -> str:
    """
    Prépare le texte pour l'embedding en le tronquant si nécessaire
    """
    # Estimation approximative: 1 token ≈ 4 caractères en français
    max_chars = max_tokens * 4
    
    if len(text) <= max_chars:
        return text
    
    # Tronquer en gardant le début et la fin
    half_chars = max_chars // 2
    truncated = text[:half_chars] + "..." + text[-half_chars:]
    
    return truncated

def embedding_to_binary(embedding: List[float]) -> bytes:
    """
    Convertit un vecteur d'embedding en format binaire
    """
    return struct.pack(f'{len(embedding)}f', *embedding)

def binary_to_embedding(binary_data: bytes) -> List[float]:
    """
    Convertit des données binaires en vecteur d'embedding
    """
    num_floats = len(binary_data) // 4
    return list(struct.unpack(f'{num_floats}f', binary_data))

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calcule la similarité cosinus entre deux vecteurs
    """
    vec1_np = np.array(vec1)
    vec2_np = np.array(vec2)
    
    dot_product = np.dot(vec1_np, vec2_np)
    norm1 = np.linalg.norm(vec1_np)
    norm2 = np.linalg.norm(vec2_np)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot_product / (norm1 * norm2)

async def generate_embedding(text: str, model: str = DEFAULT_EMBEDDING_MODEL) -> List[float]:
    """
    Génère un embedding pour un texte donné
    """
    if model not in EMBEDDING_MODELS:
        raise ValueError(f"Modèle {model} non supporté")
    
    client = get_openai_client()
    
    # Préparer le texte
    prepared_text = prepare_text_for_embedding(
        text, 
        EMBEDDING_MODELS[model]["max_tokens"]
    )
    
    try:
        # Spécifier explicitement les dimensions pour maintenir la compatibilité
        response = client.embeddings.create(
            model=model,
            input=prepared_text,
            dimensions=EMBEDDING_MODELS[model]["dimensions"]  # Ajout du paramètre dimensions
        )
        
        embedding = response.data[0].embedding
        
        # Vérifier la dimension
        expected_dim = EMBEDDING_MODELS[model]["dimensions"]
        if len(embedding) != expected_dim:
            raise ValueError(f"Dimension incorrecte: {len(embedding)}, attendu: {expected_dim}")
        
        return embedding
        
    except Exception as e:
        print(f"Erreur lors de la génération d'embedding: {e}")
        raise

async def process_chunk_embedding(chunk: DocumentChunk, db: Session, model: str = DEFAULT_EMBEDDING_MODEL) -> bool:
    """
    Traite l'embedding d'un chunk spécifique
    """
    try:
        print(f"Génération embedding pour chunk {chunk.id} (modèle: {model})")
        
        # Générer l'embedding
        embedding = await generate_embedding(chunk.text, model)
        
        # Convertir en binaire
        binary_embedding = embedding_to_binary(embedding)
        
        # Mettre à jour le chunk
        chunk.embedding = binary_embedding
        chunk.embedding_model = model
        chunk.embedding_created_at = func.now()
        
        db.commit()
        
        print(f"✅ Embedding généré pour chunk {chunk.id}")
        return True
        
    except Exception as e:
        print(f"❌ Erreur embedding chunk {chunk.id}: {e}")
        db.rollback()
        return False

async def process_batch_embeddings(
    db: Session, 
    model: str = DEFAULT_EMBEDDING_MODEL,
    batch_size: int = 10,
    max_chunks: Optional[int] = None
) -> dict:
    """
    Traite les embeddings par batch pour tous les chunks sans embedding
    """
    stats = {
        "total_chunks": 0,
        "processed": 0,
        "errors": 0,
        "skipped": 0,
        "model_used": model
    }
    
    try:
        # Récupérer les chunks sans embedding
        query = db.query(DocumentChunk).filter(
            DocumentChunk.embedding.is_(None)
        ).order_by(DocumentChunk.id)
        
        if max_chunks:
            query = query.limit(max_chunks)
        
        chunks = query.all()
        stats["total_chunks"] = len(chunks)
        
        if not chunks:
            print("✅ Aucun chunk à traiter")
            return stats
        
        print(f"🔄 Traitement de {len(chunks)} chunks par batch de {batch_size}")
        
        # Traiter par batch
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            
            print(f"📦 Batch {i//batch_size + 1}: chunks {i+1} à {min(i+batch_size, len(chunks))}")
            
            # Traiter chaque chunk du batch
            batch_tasks = []
            for chunk in batch:
                # Vérifier si le chunk a déjà un embedding (double vérification)
                if chunk.embedding is not None:
                    stats["skipped"] += 1
                    continue
                
                batch_tasks.append(process_chunk_embedding(chunk, db, model))
            
            # Exécuter les tâches du batch
            if batch_tasks:
                results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, Exception):
                        stats["errors"] += 1
                    elif result:
                        stats["processed"] += 1
                    else:
                        stats["errors"] += 1
            
            # Pause entre les batches pour éviter le rate limiting
            if i + batch_size < len(chunks):
                await asyncio.sleep(1)
        
        print(f"✅ Traitement terminé: {stats['processed']} succès, {stats['errors']} erreurs, {stats['skipped']} ignorés")
        
    except Exception as e:
        print(f"❌ Erreur lors du traitement batch: {e}")
        stats["errors"] += 1
    
    return stats

def get_embedding_stats(db: Session) -> dict:
    """
    Récupère les statistiques des embeddings
    """
    total_chunks = db.query(DocumentChunk).count()
    
    chunks_with_embedding = db.query(DocumentChunk).filter(
        DocumentChunk.embedding.isnot(None)
    ).count()
    
    chunks_without_embedding = total_chunks - chunks_with_embedding
    
    # Statistiques par modèle
    model_stats = db.query(
        DocumentChunk.embedding_model,
        func.count(DocumentChunk.id).label('count')
    ).filter(
        DocumentChunk.embedding_model.isnot(None)
    ).group_by(DocumentChunk.embedding_model).all()
    
    return {
        "total_chunks": total_chunks,
        "with_embedding": chunks_with_embedding,
        "without_embedding": chunks_without_embedding,
        "completion_rate": (chunks_with_embedding / total_chunks * 100) if total_chunks > 0 else 0,
        "models_used": [
            {"model": model, "count": count}
            for model, count in model_stats
        ]
    }

async def search_similar_chunks(
    query_text: str,
    db: Session,
    document_id: Optional[int] = None,
    limit: int = 10,
    similarity_threshold: float = 0.7,
    model: str = DEFAULT_EMBEDDING_MODEL
) -> List[Tuple[DocumentChunk, float]]:
    """
    Recherche les chunks similaires à un texte de requête
    """
    try:
        print(f"🔍 Recherche similarité: seuil={similarity_threshold}, modèle={model}")
        
        # Générer l'embedding de la requête
        print(f"📝 Génération embedding pour: {query_text[:100]}...")
        query_embedding = await generate_embedding(query_text, model)
        print(f"✅ Embedding généré: {len(query_embedding)} dimensions")
        
        # Récupérer les chunks avec embeddings
        query = db.query(DocumentChunk).filter(
            DocumentChunk.embedding.isnot(None),
            DocumentChunk.embedding_model == model
        )
        
        if document_id:
            query = query.filter(DocumentChunk.document_id == document_id)
        
        chunks = query.all()
        print(f"📊 Chunks disponibles: {len(chunks)}")
        
        if not chunks:
            print("⚠️ Aucun chunk avec embedding trouvé")
            return []
        
        # Calculer les similarités
        similarities = []
        for chunk in chunks:
            try:
                chunk_embedding = binary_to_embedding(chunk.embedding)
                similarity = cosine_similarity(query_embedding, chunk_embedding)
                
                if similarity >= similarity_threshold:
                    similarities.append((chunk, similarity))
                    print(f"✅ Chunk {chunk.id}: similarité={similarity:.3f}")
                else:
                    print(f"⚪ Chunk {chunk.id}: similarité={similarity:.3f} (< {similarity_threshold})")
                    
            except Exception as e:
                print(f"❌ Erreur traitement chunk {chunk.id}: {e}")
                continue
        
        # Trier par similarité décroissante
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        result = similarities[:limit]
        print(f"🎯 Résultats finaux: {len(result)} chunks trouvés")
        
        return result
        
    except Exception as e:
        print(f"❌ Erreur dans search_similar_chunks: {e}")
        import traceback
        traceback.print_exc()
        return []

def cleanup_embeddings(db: Session, model: Optional[str] = None) -> int:
    """
    Nettoie les embeddings obsolètes
    """
    query = db.query(DocumentChunk).filter(
        DocumentChunk.embedding.isnot(None)
    )
    
    if model:
        query = query.filter(DocumentChunk.embedding_model == model)
    
    chunks = query.all()
    cleaned = 0
    
    for chunk in chunks:
        chunk.embedding = None
        chunk.embedding_model = None
        chunk.embedding_created_at = None
        cleaned += 1
    
    db.commit()
    
    return cleaned 