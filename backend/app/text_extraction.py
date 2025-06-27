import fitz  # PyMuPDF
from docx import Document as DocxDocument
import pandas as pd
import io
from typing import Optional

def extract_text_from_pdf(file_path: str) -> str:
    """Extrait le texte d'un fichier PDF en utilisant PyMuPDF"""
    try:
        doc = fitz.open(file_path)
        text = ""
        
        for page_num in range(doc.page_count):
            page = doc[page_num]
            text += page.get_text()
            text += "\n\n"  # Séparateur entre pages
        
        doc.close()
        return text.strip()
    
    except Exception as e:
        raise Exception(f"Erreur lors de l'extraction du PDF: {str(e)}")

def extract_text_from_docx(file_path: str) -> str:
    """Extrait le texte d'un fichier Word (.docx)"""
    try:
        doc = DocxDocument(file_path)
        text = ""
        
        # Extraire le texte des paragraphes
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        
        # Extraire le texte des tableaux
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    text += cell.text + "\t"
                text += "\n"
        
        return text.strip()
    
    except Exception as e:
        raise Exception(f"Erreur lors de l'extraction du DOCX: {str(e)}")

def extract_text_from_xlsx(file_path: str) -> str:
    """Extrait le texte d'un fichier Excel (.xlsx) - convertit chaque feuille en texte"""
    try:
        # Lire toutes les feuilles du fichier Excel
        excel_file = pd.ExcelFile(file_path)
        text = ""
        
        for sheet_name in excel_file.sheet_names:
            text += f"=== Feuille: {sheet_name} ===\n"
            
            # Lire la feuille
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            
            # Convertir le DataFrame en texte
            # Remplacer les NaN par des chaînes vides
            df = df.fillna('')
            
            # Convertir en texte tabulé
            text += df.to_string(index=False)
            text += "\n\n"
        
        return text.strip()
    
    except Exception as e:
        raise Exception(f"Erreur lors de l'extraction du XLSX: {str(e)}")

def extract_text_from_file(file_path: str, file_type: str) -> Optional[str]:
    """
    Extrait le texte d'un fichier selon son type
    
    Args:
        file_path: Chemin vers le fichier
        file_type: Type MIME du fichier
    
    Returns:
        Le texte extrait ou None si le type n'est pas supporté
    """
    try:
        if file_type == "application/pdf":
            return extract_text_from_pdf(file_path)
        
        elif file_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return extract_text_from_docx(file_path)
        
        elif file_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return extract_text_from_xlsx(file_path)
        
        else:
            return None
    
    except Exception as e:
        print(f"Erreur lors de l'extraction de texte: {e}")
        return None

def get_text_preview(text: str, max_length: int = 200) -> str:
    """Retourne un aperçu du texte extrait"""
    if len(text) <= max_length:
        return text
    
    return text[:max_length] + "..." 