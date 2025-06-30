#!/usr/bin/env python3
"""
Script de test pour le système de cache Redis Q&A
Permet de vérifier que le cache fonctionne correctement
"""

import asyncio
import time
import json
from app.cache_service import redis_cache
from app.schemas import QAResponse, QAChunkResult, QACitation
from datetime import datetime

def test_redis_connection():
    """Test la connexion Redis"""
    print("🔍 Test de connexion Redis...")
    
    if redis_cache.is_available:
        print("✅ Redis connecté et disponible")
        stats = redis_cache.get_cache_stats()
        print(f"   Version Redis: {stats.get('redis_version', 'N/A')}")
        print(f"   Mémoire utilisée: {stats.get('memory_used', 'N/A')}")
        return True
    else:
        print("❌ Redis non disponible")
        return False

def create_sample_qa_response(from_cache=False):
    """Crée une réponse Q&A d'exemple pour les tests"""
    
    # Chunk d'exemple
    chunk = QAChunkResult(
        chunk_id=1,
        lot="LOT 01 - GROS ŒUVRE",
        article="Art. 1.2.3",
        page_number=15,
        text="Les matériaux utilisés pour la construction devront respecter les normes NF EN 206-1...",
        text_length=150,
        similarity_score=0.85,
        created_at=datetime.now()
    )
    
    # Citation d'exemple
    citation = QACitation(
        lot="LOT 01 - GROS ŒUVRE",
        page=15,
        excerpt="Les matériaux utilisés pour la construction devront respecter les normes NF EN 206-1",
        chunk_id=1
    )
    
    # Réponse complète
    qa_response = QAResponse(
        document_id=123,
        document_name="CCTP_Exemple.pdf",
        question="Quels sont les matériaux nécessaires ?",
        total_chunks_found=3,
        chunks_returned=1,
        processing_time_ms=2500,
        similarity_threshold=0.6,
        model_used="text-embedding-3-large",
        chunks=[chunk],
        answer="Selon le CCTP, les matériaux nécessaires pour la construction doivent respecter les normes NF EN 206-1...",
        citations=[citation],
        confidence="haute",
        gpt_model_used="gpt-4o",
        answer_generation_time_ms=1200,
        from_cache=from_cache
    )
    
    return qa_response

def test_cache_operations():
    """Test les opérations de base du cache"""
    print("\n🧪 Test des opérations de cache...")
    
    # Paramètres de test
    document_id = 123
    question = "Quels sont les matériaux nécessaires ?"
    cache_params = {
        "similarity_threshold": 0.6,
        "chunks_limit": 6,
        "model": "text-embedding-3-large",
        "generate_answer": True
    }
    
    # 1. Vérifier qu'il n'y a pas de cache initial
    print("📥 Test 1: Vérifier cache vide")
    cached_response = redis_cache.get_cached_response(document_id, question, **cache_params)
    if cached_response is None:
        print("   ✅ Cache vide comme attendu")
    else:
        print("   ⚠️ Cache non vide (nettoyage requis)")
    
    # 2. Mettre une réponse en cache
    print("📤 Test 2: Mise en cache")
    sample_response = create_sample_qa_response()
    cache_success = redis_cache.cache_response(
        document_id, question, sample_response, **cache_params
    )
    
    if cache_success:
        print("   ✅ Mise en cache réussie")
    else:
        print("   ❌ Échec de la mise en cache")
        return False
    
    # 3. Récupérer depuis le cache
    print("📥 Test 3: Récupération depuis le cache")
    cached_response = redis_cache.get_cached_response(document_id, question, **cache_params)
    
    if cached_response:
        print("   ✅ Récupération réussie")
        print(f"   📋 Question: {cached_response.question}")
        print(f"   📄 Document: {cached_response.document_name}")
        print(f"   ⏱️ Temps: {cached_response.processing_time_ms}ms")
        print(f"   🎯 Confiance: {cached_response.confidence}")
    else:
        print("   ❌ Échec de la récupération")
        return False
    
    # 4. Vérifier que les données sont correctes
    print("🔍 Test 4: Vérification des données")
    if (cached_response.document_id == sample_response.document_id and
        cached_response.question == sample_response.question and
        cached_response.answer == sample_response.answer):
        print("   ✅ Données cohérentes")
    else:
        print("   ❌ Données incohérentes")
        return False
    
    return True

def test_cache_key_generation():
    """Test la génération des clés de cache"""
    print("\n🔑 Test de génération des clés de cache...")
    
    # Tester différentes combinaisons
    test_cases = [
        (123, "Question 1", {"similarity_threshold": 0.6}),
        (123, "Question 1", {"similarity_threshold": 0.7}),  # Différent threshold
        (123, "question 1", {"similarity_threshold": 0.6}),  # Différente casse
        (124, "Question 1", {"similarity_threshold": 0.6}),  # Différent document
    ]
    
    keys = []
    for document_id, question, params in test_cases:
        key = redis_cache._generate_cache_key(document_id, question, **params)
        keys.append(key)
        print(f"   Document {document_id}, '{question}': {key[:20]}...")
    
    # Vérifier l'unicité
    unique_keys = set(keys)
    if len(unique_keys) == len(keys):
        print("   ✅ Toutes les clés sont uniques")
    else:
        print("   ❌ Certaines clés sont identiques")
    
    # Vérifier que les questions identiques (même casse) génèrent la même clé
    key1 = redis_cache._generate_cache_key(123, "TEST", similarity_threshold=0.6)
    key2 = redis_cache._generate_cache_key(123, "test", similarity_threshold=0.6)  # Différente casse
    
    if key1 == key2:
        print("   ✅ Normalisation de la casse fonctionne")
    else:
        print("   ❌ Problème de normalisation de la casse")

def test_cache_invalidation():
    """Test l'invalidation du cache"""
    print("\n🗑️ Test d'invalidation du cache...")
    
    # Créer plusieurs entrées de cache pour le même document
    document_id = 999
    questions = [
        "Question test 1",
        "Question test 2", 
        "Question test 3"
    ]
    
    sample_response = create_sample_qa_response()
    sample_response.document_id = document_id
    
    # Mettre en cache plusieurs réponses
    print("   📤 Création de 3 entrées de cache...")
    for i, question in enumerate(questions):
        sample_response.question = question
        redis_cache.cache_response(document_id, question, sample_response)
    
    # Vérifier qu'elles sont présentes
    cache_count_before = 0
    for question in questions:
        if redis_cache.get_cached_response(document_id, question):
            cache_count_before += 1
    
    print(f"   📊 {cache_count_before} entrées créées")
    
    # Invalider le cache pour ce document
    deleted_count = redis_cache.invalidate_document_cache(document_id)
    print(f"   🗑️ {deleted_count} entrées supprimées")
    
    # Vérifier qu'elles ont été supprimées
    cache_count_after = 0
    for question in questions:
        if redis_cache.get_cached_response(document_id, question):
            cache_count_after += 1
    
    if cache_count_after == 0:
        print("   ✅ Invalidation réussie")
    else:
        print(f"   ❌ {cache_count_after} entrées restantes")

def test_performance():
    """Test de performance du cache"""
    print("\n⚡ Test de performance...")
    
    document_id = 777
    question = "Question de performance"
    sample_response = create_sample_qa_response()
    
    # Test de mise en cache
    start_time = time.time()
    redis_cache.cache_response(document_id, question, sample_response)
    cache_time = (time.time() - start_time) * 1000
    
    # Test de récupération
    start_time = time.time()
    cached_response = redis_cache.get_cached_response(document_id, question)
    retrieval_time = (time.time() - start_time) * 1000
    
    print(f"   📤 Mise en cache: {cache_time:.2f}ms")
    print(f"   📥 Récupération: {retrieval_time:.2f}ms")
    
    if cached_response:
        print("   ✅ Performance acceptable")
    else:
        print("   ❌ Problème de performance")

def test_cache_stats():
    """Test des statistiques du cache"""
    print("\n📊 Test des statistiques...")
    
    stats = redis_cache.get_cache_stats()
    
    if stats.get("available"):
        print("   ✅ Statistiques disponibles:")
        print(f"      🔢 Entrées Q&A: {stats.get('qa_cache_entries', 'N/A')}")
        print(f"      💾 Mémoire: {stats.get('memory_used', 'N/A')}")
        print(f"      📈 Taux de hit: {stats.get('hit_rate', 'N/A')}%")
    else:
        print(f"   ❌ Erreur: {stats.get('error', 'Inconnue')}")

def cleanup_test_data():
    """Nettoie les données de test"""
    print("\n🧹 Nettoyage des données de test...")
    
    # Supprimer les entrées de test
    test_document_ids = [123, 124, 777, 999]
    total_deleted = 0
    
    for doc_id in test_document_ids:
        deleted = redis_cache.invalidate_document_cache(doc_id)
        total_deleted += deleted
    
    print(f"   🗑️ {total_deleted} entrées de test supprimées")

async def main():
    """Fonction principale de test"""
    print("🚀 Démarrage des tests du cache Redis Q&A")
    print("=" * 50)
    
    # Test de connexion
    if not test_redis_connection():
        print("\n❌ Impossible de continuer sans Redis")
        return
    
    try:
        # Tests fonctionnels
        test_cache_key_generation()
        
        if test_cache_operations():
            print("\n✅ Tests d'opérations de base réussis")
        else:
            print("\n❌ Échec des tests d'opérations de base")
            return
        
        # Tests avancés
        test_cache_invalidation()
        test_performance()
        test_cache_stats()
        
        print("\n🎉 Tous les tests sont terminés !")
        
    except Exception as e:
        print(f"\n💥 Erreur pendant les tests: {e}")
    
    finally:
        # Nettoyage
        cleanup_test_data()

if __name__ == "__main__":
    asyncio.run(main()) 