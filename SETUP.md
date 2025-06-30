# 🚀 CYBEFORM Analysis - Instructions de Configuration

## 📋 Prérequis
- Python 3.8+
- Node.js 16+
- npm ou yarn

## ⚡ Installation Rapide

### 1. Cloner le projet
```bash
git clone <url-du-repo>
cd CYBEFORM_ANALYSIS
```

### 2. Configuration Backend
```bash
cd backend

# Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp env_example.txt .env
# Éditez le fichier .env et ajoutez votre clé API OpenAI :
# OPENAI_API_KEY=votre-clé-api-openai-ici
```

### 3. Configuration Frontend
```bash
cd frontend

# Installer les dépendances
npm install
```

## 🔐 Configuration OpenAI

1. Obtenez votre clé API sur [OpenAI Platform](https://platform.openai.com/api-keys)
2. Éditez le fichier `backend/.env` et remplacez :
   ```
   OPENAI_API_KEY=votre-clé-api-openai-ici
   ```

## 🚀 Lancement de l'application

### Démarrage automatique
```bash
chmod +x start.sh
./start.sh
```

### Démarrage manuel
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 🌐 Accès à l'application
- Frontend : http://localhost:5173
- Backend API : http://localhost:8000
- Documentation API : http://localhost:8000/docs

## 📝 Comptes de test
Créez un compte via l'interface ou utilisez l'API d'inscription.

## 🔧 Fonctionnalités
- ✅ Authentification JWT
- ✅ Upload de documents (PDF, DOCX, XLSX)
- ✅ Extraction de texte automatique
- ✅ Analyse DCE intelligente avec OpenAI GPT-4o
- ✅ Progression temps réel via WebSocket
- ✅ Interface moderne avec Tailwind CSS
- ✅ Export CSV des résultats

## 🛠️ Dépannage
- Assurez-vous que Python 3.8+ est installé
- Vérifiez que votre clé API OpenAI est valide
- Port 8000 et 5173 doivent être disponibles

## 📚 Documentation
- API Documentation : Accessible via `/docs` une fois le serveur lancé
- Architecture : Voir `backend/EXTRACTION_REALTIME_README.md` 