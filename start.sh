#!/bin/bash

# Script de démarrage pour le projet FastAPI + React

echo "🚀 Démarrage du projet d'authentification..."

# Vérifier si Python est installé
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 n'est pas installé. Veuillez l'installer avant de continuer."
    exit 1
fi

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer avant de continuer."
    exit 1
fi

# Fonction pour démarrer le backend
start_backend() {
    echo "🔧 Démarrage du backend FastAPI..."
    cd backend
    
    # Créer l'environnement virtuel s'il n'existe pas
    if [ ! -d "venv" ]; then
        echo "📦 Création de l'environnement virtuel..."
        python3 -m venv venv
    fi
    
    # Activer l'environnement virtuel
    source venv/bin/activate
    
    # Installer les dépendances si nécessaire
    pip install -r requirements.txt
    
    # Démarrer FastAPI
    echo "✅ Backend démarré sur http://localhost:8000"
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

# Fonction pour démarrer le frontend
start_frontend() {
    echo "🎨 Démarrage du frontend React..."
    cd frontend
    
    # Installer les dépendances si nécessaire
    if [ ! -d "node_modules" ]; then
        echo "📦 Installation des dépendances npm..."
        npm install
    fi
    
    # Démarrer Vite
    echo "✅ Frontend démarré sur http://localhost:5173"
    npm run dev
}

# Démarrer les deux services en parallèle
echo "🔄 Lancement des services..."

# Créer les logs
mkdir -p logs

# Démarrer le backend en arrière-plan
start_backend > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Attendre un peu pour que le backend démarre
sleep 3

# Démarrer le frontend en arrière-plan
start_frontend > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo "✅ Services démarrés !"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"

echo ""
echo "📋 Pour arrêter les services, appuyez sur Ctrl+C"
echo "📋 Les logs sont disponibles dans le dossier 'logs/'"

# Fonction pour arrêter les services proprement
cleanup() {
    echo ""
    echo "🛑 Arrêt des services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Services arrêtés"
    exit 0
}

# Intercepter Ctrl+C
trap cleanup SIGINT

# Attendre que les processus se terminent
wait 