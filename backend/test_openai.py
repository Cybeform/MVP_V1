#!/usr/bin/env python3
"""
Script de test pour vérifier la configuration OpenAI
"""
import os
import sys
from dotenv import load_dotenv

def test_openai_connection():
    """Test de connexion à OpenAI"""
    print("🔍 Test de configuration OpenAI")
    print("=" * 50)
    
    # Charger les variables d'environnement
    load_dotenv()
    
    # Vérifier la clé API
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Clé API OpenAI non trouvée dans .env")
        return False
    
    print(f"✅ Clé API trouvée: {api_key[:20]}...")
    
    try:
        # Import OpenAI
        from openai import OpenAI
        print("✅ Module OpenAI importé avec succès")
        
        # Créer le client avec seulement la clé API
        client = OpenAI(api_key=api_key)
        print("✅ Client OpenAI créé avec succès")
        
        # Test de connexion
        print("🔍 Test de connexion à l'API...")
        models = client.models.list()
        print(f"✅ Connexion réussie! {len(models.data)} modèles disponibles")
        
        # Vérifier GPT-4o
        model_names = [model.id for model in models.data]
        if 'gpt-4o' in model_names:
            print("✅ Modèle GPT-4o disponible")
        else:
            print("⚠️  GPT-4o non disponible, modèles GPT disponibles:")
            gpt_models = [m for m in model_names if 'gpt' in m.lower()][:5]
            for model in gpt_models:
                print(f"   - {model}")
        
        # Test simple d'extraction
        print("\n🧪 Test d'extraction simple...")
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # Utiliser le modèle mini pour le test
                messages=[
                    {"role": "system", "content": "Tu es un assistant expert en construction."},
                    {"role": "user", "content": "Extrait les matériaux de ce texte: 'Pose de carrelage en grès cérame 30x30 cm, joint époxy.'"}
                ],
                max_tokens=100
            )
            print("✅ Test d'extraction réussi!")
            print(f"Réponse: {response.choices[0].message.content}")
            
        except Exception as e:
            print(f"⚠️  Erreur test extraction: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        print(f"Type d'erreur: {type(e).__name__}")
        return False

if __name__ == "__main__":
    success = test_openai_connection()
    sys.exit(0 if success else 1) 