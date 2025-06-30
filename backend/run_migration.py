#!/usr/bin/env python3
import sqlite3
import os

def run_migration():
    db_path = "sql_app.db"
    migration_file = "migration_add_qa_history.sql"
    
    if not os.path.exists(migration_file):
        print(f"❌ Fichier de migration non trouvé: {migration_file}")
        return False
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"🔄 Exécution de la migration...")
        cursor.executescript(migration_sql)
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='qa_history'")
        result = cursor.fetchone()
        
        if result:
            print(f"✅ Table 'qa_history' créée avec succès")
            cursor.execute("PRAGMA table_info(qa_history)")
            columns = cursor.fetchall()
            print(f"\n📋 Structure de la table qa_history:")
            for col in columns:
                print(f"   - {col[1]} ({col[2]})")
        else:
            print(f"❌ Erreur: Table 'qa_history' non créée")
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
    print("🚀 Script de migration - Table qa_history")
    print("=" * 50)
    
    response = input("Voulez-vous exécuter la migration ? (y/N): ")
    
    if response.lower() in ['y', 'yes', 'oui']:
        success = run_migration()
        if success:
            print(f"\n✅ Migration terminée avec succès!")
        else:
            print(f"\n❌ Échec de la migration")
    else:
        print(f"\n⏹️ Migration annulée")
