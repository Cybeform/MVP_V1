"""
Service de cache Redis pour optimiser les réponses du système Q&A
Utilise Redis pour mettre en cache les réponses aux questions fréquemment posées
"""

import os
import json
import hashlib
from typing import Optional
from redis import Redis, RedisError
from .schemas import QAResponse
import logging

# Configuration du logger
logger = logging.getLogger(__name__)

class RedisCache:
    """Service de cache Redis pour les réponses Q&A"""
    
    def __init__(self):
        self.redis_client = None
        self.is_available = False
        self.default_ttl = 24 * 60 * 60  # 24 heures en secondes
        self.cache_prefix = "qa:cache:"
        
        # Initialiser la connexion Redis
        self._init_redis()
    
    def _init_redis(self):
        """Initialise la connexion Redis avec gestion d'erreur"""
        try:
            # Configuration Redis depuis les variables d'environnement
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", "6379"))
            redis_password = os.getenv("REDIS_PASSWORD", None)
            redis_db = int(os.getenv("REDIS_DB", "0"))
            
            self.redis_client = Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                db=redis_db,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            
            # Test de connexion
            self.redis_client.ping()
            self.is_available = True
            logger.info(f"✅ Redis connecté sur {redis_host}:{redis_port}")
            
        except (RedisError, Exception) as e:
            logger.warning(f"⚠️ Redis non disponible: {e}")
            self.is_available = False
            self.redis_client = None
    
    def _generate_cache_key(
        self, 
        document_id: int, 
        question: str, 
        similarity_threshold: float = 0.6,
        chunks_limit: int = 6,
        model: str = "text-embedding-3-large",
        generate_answer: bool = True
    ) -> str:
        """
        Génère une clé de cache unique basée sur les paramètres de la requête
        
        Args:
            document_id: ID du document
            question: Question posée
            similarity_threshold: Seuil de similarité
            chunks_limit: Limite de chunks
            model: Modèle d'embedding utilisé
            generate_answer: Génération de réponse GPT activée
            
        Returns:
            Clé de cache hashée
        """
        # Créer une chaîne unique avec tous les paramètres
        cache_params = f"{document_id}|{question.strip().lower()}|{similarity_threshold}|{chunks_limit}|{model}|{generate_answer}"
        
        # Hasher avec SHA256 pour une clé courte et unique
        hash_object = hashlib.sha256(cache_params.encode('utf-8'))
        cache_hash = hash_object.hexdigest()
        
        return f"{self.cache_prefix}{cache_hash}"
    
    def get_cached_response(
        self, 
        document_id: int, 
        question: str, 
        **kwargs
    ) -> Optional[QAResponse]:
        """
        Récupère une réponse depuis le cache Redis
        
        Args:
            document_id: ID du document
            question: Question posée
            **kwargs: Paramètres additionnels pour la clé de cache
            
        Returns:
            QAResponse si trouvée en cache, None sinon
        """
        if not self.is_available:
            return None
        
        try:
            cache_key = self._generate_cache_key(document_id, question, **kwargs)
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                # Désérialiser la réponse JSON
                response_dict = json.loads(cached_data)
                
                # Reconstruire l'objet QAResponse depuis le dict
                qa_response = QAResponse.model_validate(response_dict)
                
                logger.info(f"🎯 Cache HIT pour la question: {question[:50]}...")
                return qa_response
            
            logger.debug(f"❌ Cache MISS pour la question: {question[:50]}...")
            return None
            
        except (RedisError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"⚠️ Erreur lecture cache: {e}")
            return None
    
    def cache_response(
        self, 
        document_id: int, 
        question: str, 
        qa_response: QAResponse,
        ttl: Optional[int] = None,
        **kwargs
    ) -> bool:
        """
        Met en cache une réponse Q&A
        
        Args:
            document_id: ID du document
            question: Question posée
            qa_response: Réponse à mettre en cache
            ttl: Time To Live en secondes (défaut: 24h)
            **kwargs: Paramètres additionnels pour la clé de cache
            
        Returns:
            True si mise en cache réussie, False sinon
        """
        if not self.is_available:
            return False
        
        try:
            cache_key = self._generate_cache_key(document_id, question, **kwargs)
            
            # Sérialiser la réponse en JSON
            response_dict = qa_response.model_dump()
            cached_data = json.dumps(response_dict, default=str, ensure_ascii=False)
            
            # Définir le TTL
            ttl_seconds = ttl or self.default_ttl
            
            # Mettre en cache avec expiration
            result = self.redis_client.setex(
                name=cache_key,
                time=ttl_seconds,
                value=cached_data
            )
            
            if result:
                logger.info(f"💾 Réponse mise en cache (TTL: {ttl_seconds}s) pour: {question[:50]}...")
                return True
            
            return False
            
        except (RedisError, json.JSONEncodeError, Exception) as e:
            logger.warning(f"⚠️ Erreur mise en cache: {e}")
            return False
    
    def invalidate_document_cache(self, document_id: int) -> int:
        """
        Invalide toutes les entrées de cache pour un document spécifique
        Utile quand un document est modifié ou supprimé
        
        Args:
            document_id: ID du document
            
        Returns:
            Nombre de clés supprimées
        """
        if not self.is_available:
            return 0
        
        try:
            # Rechercher toutes les clés contenant le document_id
            pattern = f"{self.cache_prefix}*"
            keys = self.redis_client.keys(pattern)
            
            deleted_count = 0
            for key in keys:
                try:
                    # Récupérer les données pour vérifier le document_id
                    cached_data = self.redis_client.get(key)
                    if cached_data:
                        response_dict = json.loads(cached_data)
                        if response_dict.get("document_id") == document_id:
                            self.redis_client.delete(key)
                            deleted_count += 1
                except (json.JSONDecodeError, Exception):
                    # En cas d'erreur, supprimer la clé corrompue
                    self.redis_client.delete(key)
                    deleted_count += 1
            
            if deleted_count > 0:
                logger.info(f"🗑️ {deleted_count} entrées de cache supprimées pour le document {document_id}")
            
            return deleted_count
            
        except RedisError as e:
            logger.warning(f"⚠️ Erreur invalidation cache: {e}")
            return 0
    
    def get_cache_stats(self) -> dict:
        """
        Retourne les statistiques du cache Redis
        
        Returns:
            Dictionnaire avec les statistiques
        """
        if not self.is_available:
            return {
                "available": False,
                "error": "Redis non disponible"
            }
        
        try:
            # Compter les clés de cache Q&A
            pattern = f"{self.cache_prefix}*"
            cache_keys_count = len(self.redis_client.keys(pattern))
            
            # Infos Redis
            redis_info = self.redis_client.info()
            
            return {
                "available": True,
                "qa_cache_entries": cache_keys_count,
                "redis_version": redis_info.get("redis_version"),
                "memory_used": redis_info.get("used_memory_human"),
                "connected_clients": redis_info.get("connected_clients"),
                "keyspace_hits": redis_info.get("keyspace_hits", 0),
                "keyspace_misses": redis_info.get("keyspace_misses", 0),
                "hit_rate": round(
                    redis_info.get("keyspace_hits", 0) / 
                    max(redis_info.get("keyspace_hits", 0) + redis_info.get("keyspace_misses", 0), 1) * 100,
                    2
                )
            }
            
        except RedisError as e:
            return {
                "available": False,
                "error": str(e)
            }
    
    def clear_all_qa_cache(self) -> int:
        """
        Efface tout le cache Q&A (utile pour le debug)
        
        Returns:
            Nombre de clés supprimées
        """
        if not self.is_available:
            return 0
        
        try:
            pattern = f"{self.cache_prefix}*"
            keys = self.redis_client.keys(pattern)
            
            if keys:
                deleted_count = self.redis_client.delete(*keys)
                logger.info(f"🗑️ Cache Q&A entièrement vidé: {deleted_count} entrées supprimées")
                return deleted_count
            
            return 0
            
        except RedisError as e:
            logger.warning(f"⚠️ Erreur vidage cache: {e}")
            return 0

# Instance globale du cache
redis_cache = RedisCache() 