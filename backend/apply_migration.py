#!/usr/bin/env python3
"""
Script pour appliquer les migrations SQL
Usage: python apply_migration.py <migration_file.sql>
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

def apply_migration(migration_file):
    """Applique une migration SQL"""
    
    # Configuration de la base de données
    DATABASE_URL = os.getenv("DATABASE_URL")
    
    if not DATABASE_URL:
        print("❌ Variable DATABASE_URL non trouvée dans l'environnement")
        return False
    
    if not os.path.exists(migration_file):
        print(f"❌ Fichier de migration non trouvé: {migration_file}")
        return False
    
    try:
        # Lire le fichier de migration
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print(f"📂 Lecture du fichier: {migration_file}")
        
        # Se connecter à la base de données
        print("🔌 Connexion à la base de données...")
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Exécuter la migration
        print("⚡ Exécution de la migration...")
        cursor.execute(sql_content)
        
        # Valider les changements
        conn.commit()
        
        print("✅ Migration appliquée avec succès!")
        
        # Fermer la connexion
        cursor.close()
        conn.close()
        
        return True
        
    except psycopg2.Error as e:
        print(f"❌ Erreur PostgreSQL: {e}")
        return False
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def main():
    """Fonction principale"""
    if len(sys.argv) != 2:
        print("Usage: python apply_migration.py <migration_file.sql>")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    
    if apply_migration(migration_file):
        print("🎉 Migration terminée!")
        sys.exit(0)
    else:
        print("💥 Migration échouée!")
        sys.exit(1)

if __name__ == "__main__":
    main() 