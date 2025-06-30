"""
Module de découpage hiérarchique pour documents CCTP
Détecte la structure des documents de type Cahier des Clauses Techniques Particulières
"""

import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from .models import DocumentChunk
from sqlalchemy.orm import Session

@dataclass
class CCTPChunk:
    """Représente un chunk de document CCTP avec ses métadonnées"""
    text: str
    lot: Optional[str] = None
    article: Optional[str] = None
    page_number: Optional[int] = None

class CCTPParser:
    """Parser spécialisé pour les documents CCTP"""
    
    def __init__(self):
        # Patterns regex pour détecter la structure hiérarchique
        self.lot_pattern = re.compile(
            r'(lot\s*n?°?\s*\d+.*?(?:[-–—].*?)?)\s*\n',
            re.IGNORECASE | re.MULTILINE
        )
        
        self.article_pattern = re.compile(
            r'(article\s*\d+(?:\.\d+)*(?:[-–—].*?)?)\s*\n',
            re.IGNORECASE | re.MULTILINE
        )
        
        self.paragraph_pattern = re.compile(
            r'(\d+(?:\.\d+)*\s*[-–—].*?)\s*\n',
            re.IGNORECASE | re.MULTILINE
        )
        
        # Patterns pour détecter les numéros de page
        self.page_pattern = re.compile(
            r'(?:page\s*)?(\d+)\s*(?:/\s*\d+)?\s*$',
            re.IGNORECASE | re.MULTILINE
        )
        
        # Patterns pour sections courantes dans un CCTP
        self.section_patterns = {
            'generalites': re.compile(r'généralités|dispositions générales', re.IGNORECASE),
            'description': re.compile(r'description\s+des\s+travaux', re.IGNORECASE),
            'materiaux': re.compile(r'matériaux|fournitures', re.IGNORECASE),
            'execution': re.compile(r'exécution|mise\s+en\s+œuvre', re.IGNORECASE),
            'controle': re.compile(r'contrôle|vérification', re.IGNORECASE),
        }

    def extract_page_number(self, text: str) -> Optional[int]:
        """Extrait le numéro de page du texte"""
        lines = text.split('\n')
        for line in reversed(lines[-5:]):  # Chercher dans les 5 dernières lignes
            match = self.page_pattern.search(line.strip())
            if match:
                try:
                    return int(match.group(1))
                except ValueError:
                    continue
        return None

    def detect_structure_elements(self, text: str) -> Dict[str, List[Tuple[int, str]]]:
        """Détecte les éléments de structure dans le texte"""
        elements = {
            'lots': [],
            'articles': [],
            'paragraphs': []
        }
        
        # Détecter les lots
        for match in self.lot_pattern.finditer(text):
            elements['lots'].append((match.start(), match.group(1).strip()))
        
        # Détecter les articles
        for match in self.article_pattern.finditer(text):
            elements['articles'].append((match.start(), match.group(1).strip()))
        
        # Détecter les paragraphes numérotés
        for match in self.paragraph_pattern.finditer(text):
            elements['paragraphs'].append((match.start(), match.group(1).strip()))
        
        return elements

    def chunk_by_hierarchy(self, text: str) -> List[CCTPChunk]:
        """Découpe le texte selon la hiérarchie CCTP détectée"""
        chunks = []
        
        # Détecter les éléments de structure
        structure = self.detect_structure_elements(text)
        
        # Créer une liste de tous les points de division avec leur type
        division_points = []
        
        for pos, lot_title in structure['lots']:
            division_points.append((pos, 'lot', lot_title))
        
        for pos, article_title in structure['articles']:
            division_points.append((pos, 'article', article_title))
        
        # Trier par position dans le texte
        division_points.sort(key=lambda x: x[0])
        
        if not division_points:
            # Pas de structure détectée, créer un chunk unique
            page_num = self.extract_page_number(text)
            return [CCTPChunk(text=text.strip(), page_number=page_num)]
        
        # Découper selon les points de division
        current_lot = None
        current_article = None
        
        for i, (pos, div_type, title) in enumerate(division_points):
            # Déterminer le début et la fin du chunk
            start_pos = pos
            end_pos = division_points[i + 1][0] if i + 1 < len(division_points) else len(text)
            
            # Extraire le texte du chunk
            chunk_text = text[start_pos:end_pos].strip()
            
            if not chunk_text:
                continue
            
            # Mettre à jour le contexte hiérarchique
            if div_type == 'lot':
                current_lot = title
                current_article = None
            elif div_type == 'article':
                current_article = title
            
            # Extraire le numéro de page
            page_num = self.extract_page_number(chunk_text)
            
            # Créer le chunk
            chunk = CCTPChunk(
                text=chunk_text,
                lot=current_lot,
                article=current_article,
                page_number=page_num
            )
            
            chunks.append(chunk)
        
        # Si il y a du texte avant le premier point de division
        if division_points[0][0] > 0:
            intro_text = text[:division_points[0][0]].strip()
            if intro_text:
                page_num = self.extract_page_number(intro_text)
                intro_chunk = CCTPChunk(
                    text=intro_text,
                    page_number=page_num
                )
                chunks.insert(0, intro_chunk)
        
        return chunks

    def clean_text_chunk(self, text: str) -> str:
        """Nettoie le texte d'un chunk"""
        # Supprimer les espaces multiples
        text = re.sub(r'\s+', ' ', text)
        
        # Supprimer les lignes vides multiples
        text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
        
        # Nettoyer les caractères spéciaux indésirables (corriger l'expression régulière)
        text = re.sub(r'[^\w\s\n\.,;:!?\-–—()\[\]{}""''«»%°/\\\\]', ' ', text)
        
        return text.strip()

def process_cctp_document(text: str, document_id: int, db: Session) -> List[DocumentChunk]:
    """
    Traite un document CCTP et crée les chunks hiérarchiques
    
    Args:
        text: Texte du document
        document_id: ID du document en base
        db: Session de base de données
        
    Returns:
        Liste des chunks créés
    """
    parser = CCTPParser()
    
    # Découper le document
    cctp_chunks = parser.chunk_by_hierarchy(text)
    
    # Créer les entrées en base de données
    db_chunks = []
    
    for chunk in cctp_chunks:
        # Nettoyer le texte
        clean_text = parser.clean_text_chunk(chunk.text)
        
        # Créer l'entrée en base
        db_chunk = DocumentChunk(
            document_id=document_id,
            lot=chunk.lot,
            article=chunk.article,
            text=clean_text,
            page_number=chunk.page_number
        )
        
        db.add(db_chunk)
        db_chunks.append(db_chunk)
    
    # Sauvegarder en base
    db.commit()
    
    # Rafraîchir les objets pour obtenir les IDs
    for chunk in db_chunks:
        db.refresh(chunk)
    
    return db_chunks

def get_document_chunks(document_id: int, db: Session) -> List[DocumentChunk]:
    """Récupère tous les chunks d'un document"""
    return db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.id).all()

def get_chunks_by_lot(document_id: int, lot: str, db: Session) -> List[DocumentChunk]:
    """Récupère les chunks d'un lot spécifique"""
    return db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id,
        DocumentChunk.lot.ilike(f'%{lot}%')
    ).order_by(DocumentChunk.id).all()

def search_chunks_by_content(document_id: int, search_term: str, db: Session) -> List[DocumentChunk]:
    """Recherche dans le contenu des chunks"""
    return db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id,
        DocumentChunk.text.ilike(f'%{search_term}%')
    ).order_by(DocumentChunk.id).all() 