import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from openai import OpenAI
from .schemas import DCEExtractionFunction, Quantitatif
from .models import ExtractionStatus
from .database import get_db
from .models import Extraction
from sqlalchemy.orm import Session
from sqlalchemy import func
import re
from collections import defaultdict
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration OpenAI - initialisation conditionnelle
client = None

# Gestionnaire des connexions WebSocket
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, list] = {}
    
    async def connect(self, websocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_progress(self, user_id: str, data: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(data)
                except:
                    # Connexion fermée, on la supprime
                    self.active_connections[user_id].remove(connection)

# Instance globale du gestionnaire WebSocket
websocket_manager = WebSocketManager()

def get_openai_client():
    """Obtient le client OpenAI initialisé"""
    global client
    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                # Initialisation simple sans paramètres optionnels
                client = OpenAI(api_key=api_key)
                print(f"✅ Client OpenAI initialisé avec succès")
            except Exception as e:
                print(f"❌ Erreur lors de l'initialisation du client OpenAI: {e}")
                client = None
        else:
            print("❌ Clé API OpenAI non trouvée dans les variables d'environnement")
    return client

def chunk_text(text: str, max_tokens: int = 3000) -> List[str]:
    """
    Découpe le texte en chunks de taille appropriée pour l'API OpenAI
    """
    # Estimer approximativement 4 caractères par token
    max_chars = max_tokens * 4
    
    if len(text) <= max_chars:
        return [text]
    
    chunks = []
    current_chunk = ""
    
    # Diviser par paragraphes
    paragraphs = text.split('\n\n')
    
    for paragraph in paragraphs:
        if len(current_chunk + paragraph) <= max_chars:
            current_chunk += paragraph + '\n\n'
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = paragraph + '\n\n'
            else:
                # Si un paragraphe est trop long, le diviser par phrases
                sentences = paragraph.split('. ')
                for sentence in sentences:
                    if len(current_chunk + sentence) <= max_chars:
                        current_chunk += sentence + '. '
                    else:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence + '. '
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

def extract_dce_info_from_chunk(chunk: str) -> Optional[Dict[str, Any]]:
    """
    Extrait les informations DCE d'un chunk de texte en utilisant OpenAI GPT-4o
    """
    client = get_openai_client()
    if not client:
        print("Client OpenAI non disponible")
        return None
        
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """Tu es un expert en analyse de documents techniques de construction (DCE - Dossier de Consultation des Entreprises).
                    
                    Ton rôle est d'extraire les informations structurées suivantes du texte fourni :
                    - Nom du lot ou sous-lot
                    - Matériaux et équipements nécessaires
                    - Méthodes d'exécution recommandées
                    - Critères de performance
                    - Localisation (zones, niveaux, bâtiments...)
                    - Quantitatifs détectés (quantité, unité, objet)
                    
                    Règles importantes :
                    - Extrais uniquement les informations explicitement mentionnées
                    - Pour les quantitatifs, cherche des patterns comme "10 m²", "50 ml", "20 unités", etc.
                    - Si une information n'est pas présente, utilise une valeur par défaut appropriée
                    - Sois précis et concis dans tes extractions"""
                },
                {
                    "role": "user",
                    "content": f"Analyse ce texte DCE et extrais les informations structurées :\n\n{chunk}"
                }
            ],
            functions=[
                {
                    "name": "extract_dce_info",
                    "description": "Extrait les informations structurées d'un document DCE",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "lot": {
                                "type": "string",
                                "description": "Nom du lot principal"
                            },
                            "sous_lot": {
                                "type": "string", 
                                "description": "Nom du sous-lot ou spécialité"
                            },
                            "materiaux": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Liste des matériaux mentionnés"
                            },
                            "equipements": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Liste des équipements nécessaires"
                            },
                            "methodes_exec": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Méthodes d'exécution recommandées"
                            },
                            "criteres_perf": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Critères de performance exigés"
                            },
                            "localisation": {
                                "type": "string",
                                "description": "Localisation ou zone d'intervention"
                            },
                            "quantitatifs": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": {"type": "string", "description": "Description de l'élément"},
                                        "qty": {"type": "number", "description": "Quantité numérique"},
                                        "unite": {"type": "string", "description": "Unité de mesure"}
                                    },
                                    "required": ["label", "qty", "unite"]
                                },
                                "description": "Quantitatifs détectés dans le texte"
                            }
                        },
                        "required": ["lot", "sous_lot", "materiaux", "equipements", "methodes_exec", "criteres_perf", "localisation", "quantitatifs"]
                    }
                }
            ],
            function_call={"name": "extract_dce_info"},
            temperature=0.1
        )
        
        # Extraire les arguments de la fonction appelée
        function_call = response.choices[0].message.function_call
        if function_call and function_call.name == "extract_dce_info":
            extracted_data = json.loads(function_call.arguments)
            return extracted_data
        
        return None
        
    except Exception as e:
        print(f"Erreur lors de l'extraction DCE: {e}")
        return None

def merge_extractions(extractions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Fusionne plusieurs extractions avec dé-duplication
    """
    if not extractions:
        return {}
    
    # Initialiser le résultat
    merged = {
        "lot": "",
        "sous_lot": "",
        "materiaux": [],
        "equipements": [],
        "methodes_exec": [],
        "criteres_perf": [],
        "localisation": "",
        "quantitatifs": []
    }
    
    # Compteurs pour déterminer les valeurs les plus fréquentes
    lot_counts = defaultdict(int)
    sous_lot_counts = defaultdict(int)
    localisation_counts = defaultdict(int)
    
    # Listes pour dé-duplication
    all_materiaux = set()
    all_equipements = set()
    all_methodes = set()
    all_criteres = set()
    all_quantitatifs = []

    # Traiter chaque extraction
    for extraction in extractions:
        if not extraction:
            continue
            
        # Compter les occurrences
        if extraction.get("lot"):
            lot_counts[extraction["lot"]] += 1
        if extraction.get("sous_lot"):
            sous_lot_counts[extraction["sous_lot"]] += 1
        if extraction.get("localisation"):
            localisation_counts[extraction["localisation"]] += 1
        
        # Ajouter aux sets pour dé-duplication
        if extraction.get("materiaux"):
            all_materiaux.update(extraction["materiaux"])
        if extraction.get("equipements"):
            all_equipements.update(extraction["equipements"])
        if extraction.get("methodes_exec"):
            all_methodes.update(extraction["methodes_exec"])
        if extraction.get("criteres_perf"):
            all_criteres.update(extraction["criteres_perf"])
        if extraction.get("quantitatifs"):
            all_quantitatifs.extend(extraction["quantitatifs"])
    
    # Déterminer les valeurs les plus fréquentes
    if lot_counts:
        merged["lot"] = max(lot_counts, key=lot_counts.get)
    if sous_lot_counts:
        merged["sous_lot"] = max(sous_lot_counts, key=sous_lot_counts.get)
    if localisation_counts:
        merged["localisation"] = max(localisation_counts, key=localisation_counts.get)
    
    # Convertir les sets en listes
    merged["materiaux"] = list(all_materiaux)
    merged["equipements"] = list(all_equipements)
    merged["methodes_exec"] = list(all_methodes)
    merged["criteres_perf"] = list(all_criteres)
    
    # Dé-dupliquer les quantitatifs
    unique_quantitatifs = []
    seen_quantitatifs = set()
    
    for q in all_quantitatifs:
        if isinstance(q, dict) and "label" in q and "qty" in q and "unite" in q:
            key = (q["label"].lower(), q["qty"], q["unite"].lower())
            if key not in seen_quantitatifs:
                seen_quantitatifs.add(key)
                unique_quantitatifs.append(q)
    
    merged["quantitatifs"] = unique_quantitatifs
    
    return merged

def calculate_confidence_score(extraction: Dict[str, Any]) -> float:
    """
    Calcule un score de confiance basé sur la complétude et la cohérence des données
    """
    if not extraction:
        return 0.0
    
    score = 0.0
    max_score = 0.0
    
    # Vérifier la présence des champs importants
    if extraction.get("lot"):
        score += 0.2
    max_score += 0.2
    
    if extraction.get("sous_lot"):
        score += 0.15
    max_score += 0.15
    
    if extraction.get("materiaux") and len(extraction["materiaux"]) > 0:
        score += 0.2
    max_score += 0.2
    
    if extraction.get("equipements") and len(extraction["equipements"]) > 0:
        score += 0.15
    max_score += 0.15
    
    if extraction.get("quantitatifs") and len(extraction["quantitatifs"]) > 0:
        score += 0.2
    max_score += 0.2
    
    if extraction.get("localisation"):
        score += 0.1
    max_score += 0.1
    
    return score / max_score if max_score > 0 else 0.0

async def update_extraction_progress(
    db: Session, 
    extraction_id: int, 
    progress: int, 
    status: ExtractionStatus = None,
    user_id: str = None
):
    """Met à jour la progression d'une extraction et notifie via WebSocket"""
    extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()
    if extraction:
        extraction.progress = progress
        if status:
            extraction.status = status
        
        if status == ExtractionStatus.processing and not extraction.started_at:
            extraction.started_at = func.now()
        elif status == ExtractionStatus.completed:
            extraction.completed_at = func.now()
        
        db.commit()
        
        # Notifier via WebSocket
        if user_id:
            await websocket_manager.send_progress(user_id, {
                "type": "extraction_progress",
                "extraction_id": extraction_id,
                "progress": progress,
                "status": status.value if status else extraction.status.value,
                "document_id": extraction.document_id
            })

async def extract_dce_info_from_text_async(
    text: str, 
    extraction_id: int, 
    db: Session,
    user_id: str = None
) -> Optional[Dict[str, Any]]:
    """
    Version asynchrone de l'extraction avec gestion de la progression
    """
    try:
        # Marquer comme en cours
        await update_extraction_progress(
            db, extraction_id, 0, ExtractionStatus.processing, user_id
        )
        
        if not text or not text.strip():
            raise ValueError("Texte vide ou invalide")
        
        # Découper le texte en chunks
        chunks = chunk_text(text)
        await update_extraction_progress(db, extraction_id, 10, user_id=user_id)
        
        if not chunks:
            raise ValueError("Impossible de découper le texte")
        
        # Traiter chaque chunk
        extractions = []
        total_chunks = len(chunks)
        
        for i, chunk in enumerate(chunks):
            try:
                # Progression de 10% à 80% pour le traitement des chunks
                progress = 10 + int((i / total_chunks) * 70)
                await update_extraction_progress(db, extraction_id, progress, user_id=user_id)
                
                # Extraction du chunk
                extraction = extract_dce_info_from_chunk(chunk)
                if extraction:
                    extractions.append(extraction)
                
                # Petite pause pour éviter de surcharger l'API
                await asyncio.sleep(0.1)
                
            except Exception as e:
                print(f"Erreur lors du traitement du chunk {i}: {e}")
                continue
        
        # Fusionner les extractions
        await update_extraction_progress(db, extraction_id, 85, user_id=user_id)
        merged_extraction = merge_extractions(extractions)
        
        if not merged_extraction:
            raise ValueError("Aucune extraction valide trouvée")
        
        # Calculer le score de confiance
        await update_extraction_progress(db, extraction_id, 95, user_id=user_id)
        confidence_score = calculate_confidence_score(merged_extraction)
        merged_extraction["confidence_score"] = confidence_score
        
        # Marquer comme terminé
        await update_extraction_progress(
            db, extraction_id, 100, ExtractionStatus.completed, user_id
        )
        
        return merged_extraction
        
    except Exception as e:
        # Marquer comme échoué
        extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()
        if extraction:
            extraction.status = ExtractionStatus.failed
            extraction.error_message = str(e)
            extraction.completed_at = func.now()
            db.commit()
            
            if user_id:
                await websocket_manager.send_progress(user_id, {
                    "type": "extraction_error",
                    "extraction_id": extraction_id,
                    "error": str(e),
                    "document_id": extraction.document_id
                })
        
        print(f"Erreur lors de l'extraction DCE: {e}")
        return None

def extract_dce_info_from_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Version synchrone pour compatibilité avec l'ancien code
    """
    if not text or not text.strip():
        return None
    
    # Découper le texte en chunks
    chunks = chunk_text(text)
    
    if not chunks:
        return None
    
    # Traiter chaque chunk
    extractions = []
    for chunk in chunks:
        try:
            extraction = extract_dce_info_from_chunk(chunk)
            if extraction:
                extractions.append(extraction)
        except Exception as e:
            print(f"Erreur lors du traitement d'un chunk: {e}")
            continue
    
    # Fusionner les extractions
    merged_extraction = merge_extractions(extractions)
    
    if not merged_extraction:
        return None
    
    # Calculer le score de confiance
    confidence_score = calculate_confidence_score(merged_extraction)
    merged_extraction["confidence_score"] = confidence_score
    
    return merged_extraction

def validate_extraction(extraction: Dict[str, Any]) -> bool:
    """
    Valide la structure d'une extraction
    """
    if not extraction:
        return False
    
    required_fields = ["lot", "sous_lot", "materiaux", "equipements", 
                      "methodes_exec", "criteres_perf", "localisation", "quantitatifs"]
    
    for field in required_fields:
        if field not in extraction:
            return False
    
    # Vérifier les quantitatifs
    if extraction.get("quantitatifs"):
        for q in extraction["quantitatifs"]:
            if not isinstance(q, dict) or not all(k in q for k in ["label", "qty", "unite"]):
                return False
    
    return True 