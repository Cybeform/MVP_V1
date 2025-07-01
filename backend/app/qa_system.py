"""
Système de Question-Answering pour documents CCTP
Utilise la recherche sémantique pour répondre aux questions sur les documents
"""

import time
import re
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from .models import Document, DocumentChunk
from .embeddings import search_similar_chunks, DEFAULT_EMBEDDING_MODEL
from .schemas import QAChunkResult, QAResponse
from .gpt_answering import generate_gpt_answer

class QAEngine:
    """Moteur de Questions-Réponses avec recherche sémantique améliorée"""
    
    def __init__(self):
        # Paramètres optimisés pour plus de précision
        self.default_similarity_threshold = 0.5  # Augmenté pour plus de précision
        self.default_chunks_limit = 10  # Augmenté pour plus de contexte
        self.max_text_length = 1500  # Augmenté pour plus d'informations
        self.gpt_model = "gpt-4o"  # Utiliser le modèle complet
        
        # Paramètres de recherche adaptative
        self.adaptive_search = True
        self.fallback_threshold = 0.3  # Seuil de fallback si peu de résultats
        self.min_chunks_for_quality = 3  # Minimum pour une réponse de qualité
    
    def preprocess_question(self, question: str) -> str:
        """
        Prétraite la question pour améliorer la recherche sémantique
        """
        # Nettoyer et normaliser la question
        question = question.strip()
        
        # Corrections orthographiques courantes
        corrections = {
            "menuise": "menuiserie",
            "menuiserie": "menuiseries",
            "vérifié": "vérifier",
            "essai": "essais",
            "travaux": "travaux",
            "d'air": "d'air",
            "performan": "performance"
        }
        
        for incorrect, correct in corrections.items():
            question = re.sub(r'\b' + re.escape(incorrect) + r'\b', correct, question, flags=re.IGNORECASE)
        
        # Ajouter des termes techniques pertinents pour améliorer la recherche
        technical_expansions = {
            "menuiserie": "menuiserie fenêtre porte",
            "performance": "performance test contrôle",
            "essai": "essai test vérification",
            "vérifier": "vérifier contrôler tester",
            "matériaux": "matériaux matériau produit"
        }
        
        expanded_question = question
        for term, expansion in technical_expansions.items():
            if term.lower() in question.lower():
                expanded_question += f" {expansion}"
        
        return expanded_question
    
    async def answer_question(
        self,
        document_id: int,
        question: str,
        db: Session,
        user_id: int,
        similarity_threshold: float = None,
        chunks_limit: int = None,
        model: str = DEFAULT_EMBEDDING_MODEL,
        generate_answer: bool = True
    ) -> QAResponse:
        """
        Répond à une question sur un document avec recherche adaptative
        """
        start_time = time.time()
        
        # Valeurs par défaut optimisées
        if similarity_threshold is None:
            similarity_threshold = self.default_similarity_threshold
        if chunks_limit is None:
            chunks_limit = self.default_chunks_limit
        
        # Vérifier que le document existe et appartient à l'utilisateur
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.owner_id == user_id
        ).first()
        
        if not document:
            raise ValueError("Document non trouvé ou accès non autorisé")
        
        # Vérifier qu'il y a des chunks avec embeddings pour ce document
        chunks_with_embeddings = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.embedding.isnot(None),
            DocumentChunk.embedding_model == model
        ).count()
        
        if chunks_with_embeddings == 0:
            raise ValueError(f"Aucun embedding trouvé pour ce document avec le modèle {model}")
        
        # Prétraiter la question pour améliorer la recherche
        processed_question = self.preprocess_question(question)
        print(f"🔄 Question prétraitée: {processed_question}")
        
        # Recherche adaptative
        similar_chunks = await self._adaptive_search(
            original_question=question,
            processed_question=processed_question,
            db=db,
            document_id=document_id,
            chunks_limit=chunks_limit,
            similarity_threshold=similarity_threshold,
            model=model
        )
        
        # Formater les résultats avec plus d'informations
        qa_chunks = []
        for chunk, similarity in similar_chunks:
            # Garder le texte complet mais limiter pour l'affichage
            display_text = chunk.text
            if len(display_text) > self.max_text_length:
                display_text = display_text[:self.max_text_length] + "..."
            
            qa_chunk = QAChunkResult(
                chunk_id=chunk.id,
                lot=chunk.lot,
                article=chunk.article,
                page_number=chunk.page_number,
                text=display_text,
                text_length=len(chunk.text),
                similarity_score=round(similarity, 4),
                created_at=chunk.created_at
            )
            qa_chunks.append(qa_chunk)
        
        # Calculer le temps de traitement initial
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Créer la réponse de base
        response = QAResponse(
            document_id=document_id,
            document_name=document.original_filename,
            question=question,
            total_chunks_found=len(similar_chunks),
            chunks_returned=len(qa_chunks),
            processing_time_ms=processing_time_ms,
            similarity_threshold=similarity_threshold,
            embedding_model=model,
            chunks=qa_chunks
        )
        
        # Générer la réponse GPT-4o si demandé et si des chunks ont été trouvés
        if generate_answer and qa_chunks:
            try:
                gpt_answer, citations, confidence, answer_time = await generate_gpt_answer(
                    question=question,
                    chunks=qa_chunks,
                    document_name=document.original_filename,
                    model=self.gpt_model
                )
                
                # Ajouter les informations GPT-4o à la réponse
                response.answer = gpt_answer
                response.citations = citations
                response.confidence = confidence
                response.gpt_model_used = self.gpt_model
                response.answer_generation_time_ms = answer_time
                
                print(f"✅ Réponse GPT-4o générée en {answer_time}ms (confiance: {confidence})")
                
            except Exception as e:
                print(f"❌ Erreur génération GPT-4o: {e}")
                # En cas d'erreur, on retourne la réponse sans GPT-4o
                response.answer = None
                response.confidence = "faible"
                response.gpt_model_used = None
                response.answer_generation_time_ms = 0
        
        return response
    
    async def _adaptive_search(
        self,
        original_question: str,
        processed_question: str,
        db: Session,
        document_id: int,
        chunks_limit: int,
        similarity_threshold: float,
        model: str
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Recherche adaptative qui ajuste les paramètres selon les résultats
        """
        # Première recherche avec la question prétraitée
        similar_chunks = await search_similar_chunks(
            query_text=processed_question,
            db=db,
            document_id=document_id,
            limit=chunks_limit,
            similarity_threshold=similarity_threshold,
            model=model
        )
        
        print(f"📊 Première recherche: {len(similar_chunks)} chunks trouvés")
        
        # Si peu de résultats, essayer avec un seuil plus bas
        if len(similar_chunks) < self.min_chunks_for_quality and similarity_threshold > self.fallback_threshold:
            print(f"🔄 Recherche avec seuil réduit: {self.fallback_threshold}")
            fallback_chunks = await search_similar_chunks(
                query_text=processed_question,
                db=db,
                document_id=document_id,
                limit=chunks_limit,
                similarity_threshold=self.fallback_threshold,
                model=model
            )
            
            if len(fallback_chunks) > len(similar_chunks):
                print(f"✅ Utilisation des résultats avec seuil réduit: {len(fallback_chunks)} chunks")
                similar_chunks = fallback_chunks
        
        # Si toujours peu de résultats, essayer avec la question originale
        if len(similar_chunks) < self.min_chunks_for_quality:
            print(f"🔄 Recherche avec question originale")
            original_chunks = await search_similar_chunks(
                query_text=original_question,
                db=db,
                document_id=document_id,
                limit=chunks_limit,
                similarity_threshold=self.fallback_threshold,
                model=model
            )
            
            if len(original_chunks) > len(similar_chunks):
                print(f"✅ Utilisation des résultats avec question originale: {len(original_chunks)} chunks")
                similar_chunks = original_chunks
        
        return similar_chunks
    
    def format_answer_summary(self, qa_response: QAResponse) -> str:
        """
        Formate un résumé textuel de la réponse pour l'affichage
        """
        if not qa_response.chunks:
            return f"Aucune information trouvée pour la question : '{qa_response.question}'"
        
        summary_parts = [
            f"Question : {qa_response.question}",
            f"Document : {qa_response.document_name}",
            f"Nombre de sections pertinentes trouvées : {qa_response.chunks_returned}",
            ""
        ]
        
        # Ajouter la réponse GPT-4o si disponible
        if qa_response.answer:
            summary_parts.extend([
                "=== RÉPONSE GÉNÉRÉE ===",
                qa_response.answer,
                f"Confiance : {qa_response.confidence}",
                ""
            ])
        
        # Ajouter les citations si disponibles
        if qa_response.citations:
            summary_parts.append("=== CITATIONS ===")
            for i, citation in enumerate(qa_response.citations, 1):
                citation_info = [f"Citation {i}"]
                
                if citation.lot:
                    citation_info.append(f"  Lot : {citation.lot}")
                if citation.page:
                    citation_info.append(f"  Page : {citation.page}")
                
                citation_info.append(f"  Extrait : {citation.excerpt}")
                citation_info.append("")
                
                summary_parts.extend(citation_info)
        else:
            # Fallback sur les chunks originaux
            for i, chunk in enumerate(qa_response.chunks, 1):
                chunk_info = [f"Section {i} (similarité: {chunk.similarity_score:.2%})"]
                
                if chunk.lot:
                    chunk_info.append(f"  Lot : {chunk.lot}")
                if chunk.article:
                    chunk_info.append(f"  Article : {chunk.article}")
                if chunk.page_number:
                    chunk_info.append(f"  Page : {chunk.page_number}")
                
                chunk_info.append(f"  Contenu : {chunk.text[:200]}...")
                chunk_info.append("")
                
                summary_parts.extend(chunk_info)
        
        return "\n".join(summary_parts)
    
    def get_best_matching_chunk(self, qa_response: QAResponse) -> Optional[QAChunkResult]:
        """
        Retourne le chunk avec le meilleur score de similarité
        """
        if not qa_response.chunks:
            return None
        
        return max(qa_response.chunks, key=lambda x: x.similarity_score)
    
    def filter_chunks_by_threshold(
        self, 
        qa_response: QAResponse, 
        min_threshold: float
    ) -> List[QAChunkResult]:
        """
        Filtre les chunks par seuil de similarité minimum
        """
        return [
            chunk for chunk in qa_response.chunks 
            if chunk.similarity_score >= min_threshold
        ]

# Instance globale du moteur Q&A
qa_engine = QAEngine()

async def ask_question(
    document_id: int,
    question: str,
    db: Session,
    user_id: int,
    **kwargs
) -> QAResponse:
    """
    Interface simplifiée pour poser une question
    """
    return await qa_engine.answer_question(
        document_id=document_id,
        question=question,
        db=db,
        user_id=user_id,
        **kwargs
    )

def validate_qa_request(document_id: int, question: str) -> List[str]:
    """
    Valide une requête Q&A et retourne la liste des erreurs
    """
    errors = []
    
    if not document_id or document_id <= 0:
        errors.append("document_id doit être un entier positif")
    
    if not question or not question.strip():
        errors.append("question ne peut pas être vide")
    
    if len(question.strip()) < 3:
        errors.append("question doit contenir au moins 3 caractères")
    
    if len(question.strip()) > 500:
        errors.append("question ne peut pas dépasser 500 caractères")
    
    return errors 