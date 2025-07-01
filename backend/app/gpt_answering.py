"""
Module de génération de réponses intelligentes avec GPT-4o
Analyse les passages trouvés et génère des réponses avec citations
Spécialisé pour les documents CCTP et le domaine du BTP
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

def create_specialized_qa_prompt(question: str, chunks: List[QAChunkResult], document_name: str) -> str:
    """
    Crée un prompt spécialisé pour l'analyse de documents CCTP avec expertise BTP
    """
    
    # Contexte métier spécialisé
    context_intro = f"""Vous êtes un expert en analyse de documents techniques du BTP, spécialisé dans les CCTP (Cahier des Clauses Techniques Particulières).

CONTEXTE MÉTIER :
- Les CCTP définissent les spécifications techniques des travaux
- Ils contiennent des prescriptions sur les matériaux, méthodes, performances et contrôles
- Ils sont organisés par lots de travaux (gros œuvre, menuiserie, plomberie, etc.)
- Chaque prescription doit respecter les normes en vigueur (DTU, NF, Eurocodes)

DOCUMENT ANALYSÉ : {document_name}
QUESTION POSÉE : {question}

PASSAGES PERTINENTS EXTRAITS DU DOCUMENT :

"""
    
    # Analyser les chunks pour identifier les thèmes
    themes = analyze_content_themes(chunks)
    
    # Formater les passages avec enrichissement contextuel
    passages = []
    for i, chunk in enumerate(chunks, 1):
        passage = f"🔍 PASSAGE {i}:\n"
        
        # Métadonnées enrichies
        metadata = []
        if chunk.lot:
            metadata.append(f"📁 Lot: {chunk.lot}")
        if chunk.article:
            metadata.append(f"📋 Article: {chunk.article}")
        if chunk.page_number:
            metadata.append(f"📄 Page: {chunk.page_number}")
        
        if metadata:
            passage += f"[{' | '.join(metadata)}]\n"
        
        # Score de pertinence avec interprétation
        score_interpretation = get_score_interpretation(chunk.similarity_score)
        passage += f"📊 Pertinence: {chunk.similarity_score:.2%} ({score_interpretation})\n\n"
        
        passage += f"📝 CONTENU:\n{chunk.text}\n\n"
        passage += "─" * 80 + "\n\n"
        
        passages.append(passage)
    
    # Instructions spécialisées et contextuelles
    instructions = f"""
🎯 INSTRUCTIONS POUR LA RÉPONSE :

1. **ANALYSE TECHNIQUE** :
   - Analysez les passages en tant qu'expert BTP/CCTP
   - Identifiez les exigences techniques, normes et prescriptions
   - Relevez les performances, tolérances et méthodes de contrôle
   - Notez les matériaux spécifiés et leurs caractéristiques

2. **STRUCTURE DE RÉPONSE** :
   - Commencez par une réponse directe et synthétique
   - Développez avec les détails techniques pertinents
   - Citez précisément vos sources (ex: "Selon le PASSAGE 2, lot menuiserie...")
   - Mentionnez les normes, DTU ou références techniques quand pertinentes

3. **DOMAINES D'EXPERTISE À MOBILISER** :
   - Matériaux de construction et leurs propriétés
   - Techniques de mise en œuvre et contrôles qualité
   - Normes et réglementations du BTP (DTU, NF, RT, etc.)
   - Performances thermiques, acoustiques, mécaniques
   - Procédures d'essais et de réception

4. **THÈMES IDENTIFIÉS DANS LE DOCUMENT** :
{format_themes_for_prompt(themes)}

5. **CITATIONS ET TRAÇABILITÉ** :
   - Citez systématiquement vos sources avec le numéro de passage
   - Indiquez le lot et la page quand disponibles
   - Différenciez les exigences obligatoires des recommandations
   - Mentionnez les références normatives citées

6. **QUALITÉ DE RÉPONSE** :
   - Si l'information est incomplète, indiquez-le clairement
   - Distinguez les faits des interprétations
   - Signaler les contradictions ou ambiguïtés éventuelles
   - Proposez des précisions complémentaires si nécessaire

7. **ADAPTATION AU CONTEXTE** :
   - Utilisez le vocabulaire technique approprié
   - Respectez la hiérarchie des exigences (obligatoire/recommandé)
   - Tenez compte du niveau de précision de la question

🚀 RÉPONDEZ MAINTENANT à la question en appliquant votre expertise BTP et en suivant ces instructions.
"""
    
    return context_intro + "".join(passages) + instructions

def analyze_content_themes(chunks: List[QAChunkResult]) -> Dict[str, int]:
    """
    Analyse les thèmes principaux dans les chunks pour enrichir le contexte
    """
    themes = {
        "matériaux": 0,
        "performances": 0,
        "contrôles": 0,
        "normes": 0,
        "mise_en_oeuvre": 0,
        "essais": 0,
        "réception": 0,
        "sécurité": 0
    }
    
    keywords = {
        "matériaux": ["matériau", "matériaux", "béton", "acier", "bois", "aluminium", "PVC"],
        "performances": ["performance", "résistance", "étanchéité", "isolation", "thermique", "acoustique"],
        "contrôles": ["contrôle", "vérification", "surveillance", "inspection", "validation"],
        "normes": ["DTU", "NF", "norme", "réglementation", "RT", "eurocode"],
        "mise_en_oeuvre": ["pose", "installation", "mise en œuvre", "montage", "assemblage"],
        "essais": ["essai", "test", "mesure", "caractérisation"],
        "réception": ["réception", "livraison", "conformité", "acceptation"],
        "sécurité": ["sécurité", "protection", "EPI", "prévention"]
    }
    
    for chunk in chunks:
        text_lower = chunk.text.lower()
        for theme, words in keywords.items():
            for word in words:
                if word in text_lower:
                    themes[theme] += 1
    
    return themes

def get_score_interpretation(score: float) -> str:
    """
    Interprète le score de similarité pour le contexte
    """
    if score >= 0.8:
        return "très pertinent"
    elif score >= 0.6:
        return "pertinent"
    elif score >= 0.4:
        return "moyennement pertinent"
    else:
        return "faiblement pertinent"

def format_themes_for_prompt(themes: Dict[str, int]) -> str:
    """
    Formate les thèmes identifiés pour le prompt
    """
    relevant_themes = [theme for theme, count in themes.items() if count > 0]
    if relevant_themes:
        return f"   - Thèmes détectés: {', '.join(relevant_themes)}"
    else:
        return "   - Aucun thème spécifique identifié"

async def generate_gpt_answer(
    question: str, 
    chunks: List[QAChunkResult], 
    document_name: str,
    model: str = "gpt-4o"
) -> Tuple[str, List[QACitation], str, int]:
    """
    Génère une réponse spécialisée avec GPT-4o pour le domaine BTP/CCTP
    
    Returns:
        (answer, citations, confidence, processing_time_ms)
    """
    start_time = time.time()
    
    if not chunks:
        return (
            "Aucune information pertinente trouvée dans le document pour répondre à cette question. "
            "Veuillez reformuler votre question ou vérifier si le sujet est traité dans ce document CCTP.",
            [],
            "faible",
            int((time.time() - start_time) * 1000)
        )
    
    try:
        client = get_openai_client()
        
        # Créer le prompt spécialisé
        prompt = create_specialized_qa_prompt(question, chunks, document_name)
        
        # Configuration optimisée pour les réponses techniques
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "Vous êtes un expert en BTP et documents techniques CCTP. Vos réponses sont précises, techniques et toujours sourcées. Vous maîtrisez les normes, DTU, matériaux et techniques de construction."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,  # Très faible pour plus de précision
            max_tokens=2000,  # Augmenté pour des réponses plus détaillées
            top_p=0.9,
            frequency_penalty=0.1,  # Éviter les répétitions
            presence_penalty=0.1    # Encourager la diversité
        )
        
        answer = response.choices[0].message.content
        processing_time = int((time.time() - start_time) * 1000)
        
        # Extraire les citations de la réponse avec amélioration
        citations = extract_enhanced_citations(answer, chunks)
        
        # Calculer la confiance améliorée
        confidence = calculate_enhanced_confidence(chunks, citations, answer)
        
        return answer, citations, confidence, processing_time
        
    except Exception as e:
        error_msg = f"Erreur lors de la génération de réponse: {str(e)}"
        print(f"❌ {error_msg}")
        
        # Réponse de fallback améliorée
        fallback_answer = generate_fallback_answer(chunks, question)
        
        return (
            fallback_answer,
            [],
            "faible",
            int((time.time() - start_time) * 1000)
        )

def generate_fallback_answer(chunks: List[QAChunkResult], question: str) -> str:
    """
    Génère une réponse de fallback structurée en cas d'erreur GPT
    """
    fallback = f"**Réponse automatique générée**\n\n"
    fallback += f"En réponse à votre question : '{question}'\n\n"
    fallback += f"Voici les informations les plus pertinentes trouvées dans le document :\n\n"
    
    for i, chunk in enumerate(chunks[:5], 1):  # Top 5 chunks
        fallback += f"**📋 Information {i}** "
        
        # Informations contextuelles
        context_info = []
        if chunk.lot:
            context_info.append(f"Lot {chunk.lot}")
        if chunk.page_number:
            context_info.append(f"Page {chunk.page_number}")
        if chunk.similarity_score:
            context_info.append(f"Pertinence {chunk.similarity_score:.0%}")
            
        if context_info:
            fallback += f"({', '.join(context_info)}):\n"
        else:
            fallback += ":\n"
        
        # Texte tronqué intelligemment
        text = chunk.text
        if len(text) > 300:
            # Trouver une phrase complète proche de 300 caractères
            sentences = re.split(r'[.!?]\s+', text)
            truncated = ""
            for sentence in sentences:
                if len(truncated + sentence) > 300:
                    break
                truncated += sentence + ". "
            text = truncated.strip() + "..."
        
        fallback += f"*{text}*\n\n"
    
    fallback += "---\n"
    fallback += "💡 **Conseil**: Pour une analyse plus précise, reformulez votre question ou contactez un expert BTP."
    
    return fallback

def extract_enhanced_citations(answer: str, chunks: List[QAChunkResult]) -> List[QACitation]:
    """
    Extrait les citations de la réponse GPT avec amélioration de la détection
    """
    citations = []
    
    # Patterns de citation améliorés
    patterns = [
        r"PASSAGE\s+(\d+)",  # PASSAGE 1, PASSAGE 2, etc.
        r"passage\s+(\d+)",  # passage 1, passage 2, etc.
        r"selon.*?passage\s+(\d+)",  # selon le passage 1
        r"d'après.*?passage\s+(\d+)",  # d'après le passage 1
        r"passage\s+n°?\s*(\d+)",  # passage n°1, passage n° 1
        r"extrait\s+(\d+)",  # extrait 1
        r"section\s+(\d+)",  # section 1
        r"information\s+(\d+)"  # information 1
    ]
    
    # Rechercher tous les patterns
    referenced_chunks = set()
    for pattern in patterns:
        matches = re.finditer(pattern, answer, re.IGNORECASE)
        for match in matches:
            try:
                chunk_number = int(match.group(1))
                if 1 <= chunk_number <= len(chunks):
                    referenced_chunks.add(chunk_number - 1)  # Index 0-based
            except (ValueError, IndexError):
                continue
    
    # Créer les citations pour les chunks référencés
    for chunk_index in sorted(referenced_chunks):
        chunk = chunks[chunk_index]
        
        # Extraire un extrait représentatif
        excerpt = extract_relevant_excerpt(chunk.text, answer)
        
        citation = QACitation(
            chunk_id=chunk.chunk_id,
            lot=chunk.lot,
            page=chunk.page_number,
            excerpt=excerpt
        )
        citations.append(citation)
    
    # Si aucune citation explicite trouvée, utiliser les meilleurs chunks
    if not citations and chunks:
        # Prendre les 3 chunks avec les meilleurs scores
        top_chunks = sorted(chunks, key=lambda x: x.similarity_score, reverse=True)[:3]
        for chunk in top_chunks:
            excerpt = extract_relevant_excerpt(chunk.text, answer)
            citation = QACitation(
                chunk_id=chunk.chunk_id,
                lot=chunk.lot,
                page=chunk.page_number,
                excerpt=excerpt
            )
            citations.append(citation)
    
    return citations

def extract_relevant_excerpt(chunk_text: str, answer: str) -> str:
    """
    Extrait l'extrait le plus pertinent d'un chunk par rapport à la réponse
    """
    # Limiter la longueur de l'extrait
    max_excerpt_length = 200
    
    if len(chunk_text) <= max_excerpt_length:
        return chunk_text
    
    # Essayer de trouver des phrases complètes qui correspondent à la réponse
    sentences = re.split(r'[.!?]\s+', chunk_text)
    
    # Chercher la phrase la plus pertinente basée sur les mots clés de la réponse
    answer_words = set(answer.lower().split())
    best_sentence = ""
    best_score = 0
    
    for sentence in sentences:
        if len(sentence.strip()) < 20:  # Ignorer les phrases trop courtes
            continue
            
        sentence_words = set(sentence.lower().split())
        overlap = len(answer_words.intersection(sentence_words))
        
        if overlap > best_score:
            best_score = overlap
            best_sentence = sentence.strip()
    
    # Si on a trouvé une bonne phrase
    if best_sentence and len(best_sentence) <= max_excerpt_length:
        return best_sentence
    
    # Sinon, prendre le début du chunk
    excerpt = chunk_text[:max_excerpt_length]
    # Trouver la dernière phrase complète
    last_sentence_end = max(
        excerpt.rfind('.'),
        excerpt.rfind('!'),
        excerpt.rfind('?')
    )
    
    if last_sentence_end > max_excerpt_length * 0.7:  # Au moins 70% du texte
        excerpt = excerpt[:last_sentence_end + 1]
    else:
        excerpt += "..."
    
    return excerpt

def calculate_enhanced_confidence(chunks: List[QAChunkResult], citations: List[QACitation], answer: str) -> str:
    """
    Calcule le niveau de confiance amélioré basé sur plusieurs facteurs
    """
    if not chunks:
        return "faible"
    
    # Facteur 1: Scores de similarité moyens
    avg_score = sum(chunk.similarity_score for chunk in chunks) / len(chunks)
    
    # Facteur 2: Nombre de chunks utilisés
    chunks_factor = min(len(chunks) / 5, 1.0)  # Normalisé sur 5 chunks
    
    # Facteur 3: Présence de citations explicites
    citation_factor = min(len(citations) / 3, 1.0) if citations else 0
    
    # Facteur 4: Longueur et détail de la réponse
    answer_length_factor = min(len(answer) / 1000, 1.0) if answer else 0
    
    # Facteur 5: Diversité des sources (différents lots/pages)
    unique_sources = set()
    for chunk in chunks:
        source_id = f"{chunk.lot or 'unknown'}_{chunk.page_number or 0}"
        unique_sources.add(source_id)
    diversity_factor = min(len(unique_sources) / 3, 1.0)
    
    # Facteur 6: Présence de termes techniques dans l'answer
    technical_terms = [
        "norme", "DTU", "performance", "contrôle", "essai", 
        "matériau", "prescription", "tolérance", "résistance"
    ]
    technical_count = sum(1 for term in technical_terms if term.lower() in answer.lower())
    technical_factor = min(technical_count / 3, 1.0)
    
    # Calcul de confiance pondéré
    confidence_score = (
        avg_score * 0.3 +                # 30% pour la similarité
        chunks_factor * 0.2 +            # 20% pour le nombre de chunks
        citation_factor * 0.2 +          # 20% pour les citations
        answer_length_factor * 0.1 +     # 10% pour la longueur
        diversity_factor * 0.1 +         # 10% pour la diversité
        technical_factor * 0.1           # 10% pour les termes techniques
    )
    
    # Classification finale
    if confidence_score >= 0.75:
        return "haute"
    elif confidence_score >= 0.5:
        return "moyenne"
    else:
        return "faible"

def calculate_confidence(chunks: List[QAChunkResult], citations: List[QACitation]) -> str:
    """
    Calcule le niveau de confiance basé sur les scores de similarité (version originale)
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