"""
Module de génération de réponses intelligentes avec GPT-4o
Analyse les passages trouvés et génère des réponses avec citations
"""

import os
import time
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from .schemas import QAChunkResult, QACitation

def get_openai_client():
    """Initialise et retourne le client OpenAI"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY non configurée")
    
    try:
        import openai
        return openai.OpenAI(api_key=api_key)
    except ImportError:
        raise ImportError("Package 'openai' non installé")

def create_qa_prompt(question: str, chunks: List[QAChunkResult], document_name: str) -> str:
    """
    Crée un prompt structuré pour GPT-4o avec les passages trouvés
    """
    
    # Contexte du document
    context_intro = f"""Vous êtes un expert en analyse de documents techniques CCTP (Cahier des Clauses Techniques Particulières).

Document analysé : {document_name}
Question posée : {question}

Voici les passages les plus pertinents trouvés dans le document :

"""
    
    # Ajouter chaque passage avec ses métadonnées
    passages = []
    for i, chunk in enumerate(chunks, 1):
        passage = f"PASSAGE {i}:\n"
        
        # Métadonnées
        metadata = []
        if chunk.lot:
            metadata.append(f"Lot: {chunk.lot}")
        if chunk.article:
            metadata.append(f"Article: {chunk.article}")
        if chunk.page_number:
            metadata.append(f"Page: {chunk.page_number}")
        
        if metadata:
            passage += f"[{' | '.join(metadata)}]\n"
        
        passage += f"Contenu: {chunk.text}\n"
        passage += f"Score de pertinence: {chunk.similarity_score:.2%}\n\n"
        
        passages.append(passage)
    
    # Instructions pour la réponse
    instructions = """
INSTRUCTIONS IMPORTANTES :

1. Répondez à la question en français de manière claire et précise
2. Basez-vous UNIQUEMENT sur les passages fournis ci-dessus
3. Citez les passages pertinents avec leur numéro (ex: "Selon le PASSAGE 2...")
4. Si possible, mentionnez le lot et la page dans vos citations
5. Si vous ne trouvez pas d'information pertinente, dites-le clairement
6. Structurez votre réponse de manière logique et professionnelle
7. Utilisez un vocabulaire technique approprié au domaine du BTP

Répondez maintenant à la question en suivant ces instructions.
"""
    
    return context_intro + "".join(passages) + instructions

async def generate_gpt_answer(
    question: str, 
    chunks: List[QAChunkResult], 
    document_name: str,
    model: str = "gpt-4o"
) -> Tuple[str, List[QACitation], str, int]:
    """
    Génère une réponse avec GPT-4o basée sur les chunks trouvés
    
    Returns:
        (answer, citations, confidence, processing_time_ms)
    """
    start_time = time.time()
    
    if not chunks:
        return (
            "Aucune information pertinente trouvée dans le document pour répondre à cette question.",
            [],
            "faible",
            int((time.time() - start_time) * 1000)
        )
    
    try:
        client = get_openai_client()
        
        # Créer le prompt
        prompt = create_qa_prompt(question, chunks, document_name)
        
        # Appel à GPT-4o
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "Vous êtes un expert en analyse de documents techniques CCTP. Répondez de manière précise et professionnelle en citant vos sources."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,  # Réponse plus déterministe
            max_tokens=1500,
            top_p=0.9
        )
        
        answer = response.choices[0].message.content
        processing_time = int((time.time() - start_time) * 1000)
        
        # Extraire les citations de la réponse
        citations = extract_citations_from_answer(answer, chunks)
        
        # Calculer la confiance basée sur les scores de similarité
        confidence = calculate_confidence(chunks, citations)
        
        return answer, citations, confidence, processing_time
        
    except Exception as e:
        error_msg = f"Erreur lors de la génération de réponse: {str(e)}"
        print(f"❌ {error_msg}")
        
        # Réponse de fallback
        fallback_answer = f"Désolé, je n'ai pas pu générer une réponse automatique. Voici les passages les plus pertinents trouvés :\n\n"
        
        for i, chunk in enumerate(chunks[:3], 1):  # Top 3 chunks
            fallback_answer += f"**Passage {i}** "
            if chunk.lot:
                fallback_answer += f"({chunk.lot}"
                if chunk.page_number:
                    fallback_answer += f", page {chunk.page_number}"
                fallback_answer += "): "
            elif chunk.page_number:
                fallback_answer += f"(page {chunk.page_number}): "
            
            fallback_answer += f"{chunk.text[:200]}...\n\n"
        
        return (
            fallback_answer,
            [],
            "faible",
            int((time.time() - start_time) * 1000)
        )

def extract_citations_from_answer(answer: str, chunks: List[QAChunkResult]) -> List[QACitation]:
    """
    Extrait les citations de la réponse GPT-4o
    """
    citations = []
    
    # Patterns pour détecter les références aux passages
    patterns = [
        r'PASSAGE\s+(\d+)',
        r'passage\s+(\d+)',
        r'Passage\s+(\d+)',
        r'selon\s+le\s+passage\s+(\d+)',
        r'dans\s+le\s+passage\s+(\d+)',
        r'cf\.\s+passage\s+(\d+)',
        r'voir\s+passage\s+(\d+)'
    ]
    
    referenced_passages = set()
    
    # Chercher toutes les références
    for pattern in patterns:
        matches = re.findall(pattern, answer, re.IGNORECASE)
        for match in matches:
            try:
                passage_num = int(match)
                if 1 <= passage_num <= len(chunks):
                    referenced_passages.add(passage_num - 1)  # Index 0-based
            except ValueError:
                continue
    
    # Si aucune référence explicite, utiliser les 3 premiers chunks
    if not referenced_passages:
        referenced_passages = set(range(min(3, len(chunks))))
    
    # Créer les citations
    for chunk_idx in referenced_passages:
        chunk = chunks[chunk_idx]
        
        # Extraire un extrait pertinent (premiers 150 caractères)
        excerpt = chunk.text[:150]
        if len(chunk.text) > 150:
            excerpt += "..."
        
        citation = QACitation(
            lot=chunk.lot,
            page=chunk.page_number,
            excerpt=excerpt,
            chunk_id=chunk.chunk_id
        )
        citations.append(citation)
    
    return citations

def calculate_confidence(chunks: List[QAChunkResult], citations: List[QACitation]) -> str:
    """
    Calcule le niveau de confiance basé sur les scores de similarité
    """
    if not chunks:
        return "faible"
    
    # Score moyen des chunks utilisés
    if citations:
        # Utiliser les chunks référencés
        referenced_chunk_ids = {c.chunk_id for c in citations}
        relevant_chunks = [c for c in chunks if c.chunk_id in referenced_chunk_ids]
    else:
        # Utiliser les 3 premiers chunks
        relevant_chunks = chunks[:3]
    
    if not relevant_chunks:
        return "faible"
    
    avg_score = sum(chunk.similarity_score for chunk in relevant_chunks) / len(relevant_chunks)
    
    if avg_score >= 0.8:
        return "haute"
    elif avg_score >= 0.6:
        return "moyenne"
    else:
        return "faible"

def format_citations_for_display(citations: List[QACitation]) -> str:
    """
    Formate les citations pour l'affichage
    """
    if not citations:
        return "Aucune citation disponible"
    
    formatted = []
    for i, citation in enumerate(citations, 1):
        citation_text = f"**Citation {i}**"
        
        metadata = []
        if citation.lot:
            metadata.append(f"Lot: {citation.lot}")
        if citation.page:
            metadata.append(f"Page: {citation.page}")
        
        if metadata:
            citation_text += f" ({', '.join(metadata)})"
        
        citation_text += f"\n{citation.excerpt}\n"
        formatted.append(citation_text)
    
    return "\n".join(formatted)

def validate_gpt_response(answer: str, question: str) -> bool:
    """
    Valide que la réponse GPT-4o est pertinente
    """
    if not answer or len(answer.strip()) < 10:
        return False
    
    # Vérifier que la réponse ne contient pas trop d'erreurs standard
    error_phrases = [
        "je ne peux pas répondre",
        "information non disponible",
        "impossible de répondre",
        "données insuffisantes"
    ]
    
    answer_lower = answer.lower()
    error_count = sum(1 for phrase in error_phrases if phrase in answer_lower)
    
    return error_count < 2  # Tolérer quelques phrases d'erreur 