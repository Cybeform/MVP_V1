#!/usr/bin/env python3
import sqlite3
import os
import sys

def run_migration(migration_file):
    db_path = "sql_app.db"
    
    if not os.path.exists(migration_file):
        print(f"❌ Fichier de migration non trouvé: {migration_file}")
        return False
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"🔄 Exécution de la migration: {migration_file}")
        cursor.executescript(migration_sql)
        
        # Vérifier le succès de la migration en fonction du nom du fichier
        if 'projects' in migration_file:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
            result = cursor.fetchone()
            table_name = 'projects'
        elif 'qa_history' in migration_file:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='qa_history'")
            result = cursor.fetchone()
            table_name = 'qa_history'
        else:
            print(f"✅ Migration SQL exécutée")
            conn.commit()
            return True
        
        if result:
            print(f"✅ Table '{table_name}' créée avec succès")
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            print(f"\n📋 Structure de la table {table_name}:")
            for col in columns:
                print(f"   - {col[1]} ({col[2]})")
        else:
            print(f"❌ Erreur: Table '{table_name}' non créée")
            return False
        
        conn.commit()
        print(f"\n🎉 Migration terminée avec succès!")
        return True
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("❌ Usage: python run_migration.py <fichier_migration.sql>")
        print("📝 Exemple: python run_migration.py migration_add_projects.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    
    print(f"🚀 Script de migration - {migration_file}")
    print("=" * 50)
    
    response = input("Voulez-vous exécuter la migration ? (y/N): ")
    
    if response.lower() in ['y', 'yes', 'oui']:
        success = run_migration(migration_file)
        if success:
            print(f"\n✅ Migration terminée avec succès!")
        else:
            print(f"\n❌ Échec de la migration")
    else:
        print(f"\n⏹️ Migration annulée")
