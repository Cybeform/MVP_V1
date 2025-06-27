# Projet Full-Stack FastAPI + React

Un projet de base avec authentification utilisateur et gestion de documents comprenant :
- **Backend** : FastAPI avec authentification JWT et upload de fichiers
- **Frontend** : React avec Vite et Tailwind CSS
- **Base de données** : SQLite avec SQLAlchemy
- **Authentification** : Système complet de login/register
- **Upload de fichiers** : Interface drag-and-drop pour PDF, DOCX, XLSX
- **🆕 Extraction DCE** : Analyse intelligente avec OpenAI GPT-4o

## Structure du projet

```
├── backend/          # API FastAPI
│   ├── app/
│   │   ├── models.py         # Modèles User + Document + Extraction
│   │   ├── routes/
│   │   │   ├── auth.py       # Authentification
│   │   │   ├── users.py      # Gestion utilisateurs
│   │   │   └── documents.py  # Upload/download + extraction DCE
│   │   ├── text_extraction.py    # Extraction texte (PDF/DOCX/XLSX)
│   │   ├── dce_extraction.py     # Extraction DCE avec OpenAI
│   │   └── ...
│   └── uploads/      # Dossier de stockage des fichiers
└── frontend/         # Application React
    ├── src/
    │   ├── components/
    │   │   ├── FileUpload.jsx     # Upload drag-and-drop
    │   │   ├── DocumentsList.jsx  # Liste des documents
    │   │   └── ...
    │   ├── pages/
    │   │   ├── Upload.jsx          # Page de gestion documents
    │   │   └── ...
    │   └── ...
```

## Installation et démarrage

### Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Configuration OpenAI (optionnel)
export OPENAI_API_KEY="your-openai-api-key"

uvicorn app.main:app --reload
```

L'API sera accessible sur `http://localhost:8000`

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### Démarrage automatique

```bash
./start.sh
```

## Fonctionnalités

### Authentification
- ✅ Inscription utilisateur (Register/Login/Logout)
- ✅ Protection des routes
- ✅ Gestion des tokens JWT
- ✅ Validation des données

### Interface utilisateur
- ✅ Interface moderne avec Tailwind CSS
- ✅ Navigation responsive
- ✅ Pages d'accueil, login, register, dashboard
- ✅ Gestion d'état utilisateur

### Gestion de documents
- ✅ **Upload par drag-and-drop** avec barre de progression
- ✅ **Support des fichiers** : PDF, DOCX, XLSX (max 10MB)
- ✅ **Validation côté client et serveur**
- ✅ **Liste des documents** avec téléchargement
- ✅ **Suppression de documents**
- ✅ **Stockage sécurisé** par utilisateur

### 🆕 Extraction DCE (Nouveau !)
- ✅ **Extraction de texte** automatique (PDF/DOCX/XLSX)
- ✅ **Analyse intelligente** avec OpenAI GPT-4o
- ✅ **Traitement par chunks** pour gros documents
- ✅ **Function calling** pour extraction structurée
- ✅ **Fusion et dé-duplication** des résultats
- ✅ **Stockage en base** des informations extraites

#### Informations extraites automatiquement :
- 📋 **Nom du lot** et sous-lot
- 🔧 **Matériaux** et équipements nécessaires
- ⚙️ **Méthodes d'exécution** recommandées
- 📊 **Critères de performance**
- 📍 **Localisation** (zones, niveaux, bâtiments)
- 📏 **Quantitatifs** détectés (quantité + unité + description)

## API Endpoints

### Authentification
- `POST /auth/register` - Inscription
- `POST /auth/login` - Connexion
- `GET /auth/me` - Profil utilisateur

### Utilisateurs
- `GET /users/` - Liste des utilisateurs (protégé)

### Documents
- `POST /documents/upload` - **Upload de fichier + extraction DCE**
- `GET /documents/` - **Liste des documents utilisateur**
- `GET /documents/{id}/download` - **Téléchargement**
- `DELETE /documents/{id}` - **Suppression**

### 🆕 Extraction DCE
- `GET /documents/{id}/extraction` - **Récupérer l'extraction DCE**
- `GET /documents/extractions/` - **Liste des extractions utilisateur**
- `POST /documents/{id}/extract-dce` - **Lancer extraction manuelle**

### Texte brut
- `GET /documents/texts/` - Liste des textes extraits
- `GET /documents/texts/{filename}` - Texte par nom de fichier

## Technologies utilisées

### Backend
- FastAPI
- SQLAlchemy + SQLite
- Pydantic
- Python-Jose (JWT)
- Passlib (hashing)
- **Python-multipart** (upload fichiers)
- **PyMuPDF** (extraction PDF)
- **python-docx** (extraction Word)
- **pandas + openpyxl** (extraction Excel)
- **🆕 OpenAI** (extraction DCE intelligente)

### Frontend
- React 18
- Vite
- Tailwind CSS
- Axios
- React Router
- **Drag-and-drop natif**

## 🚀 Fonctionnement de l'extraction DCE

### 1. **Upload et extraction de texte**
```
Document (PDF/DOCX/XLSX) → Extraction texte → Stockage en base
```

### 2. **Analyse intelligente automatique**
```
Texte → Découpage en chunks → Envoi à GPT-4o → Fusion des résultats
```

### 3. **Structure de données extraite**
```json
{
  "lot": "Lot 02 - Gros œuvre",
  "sous_lot": "Maçonnerie",
  "materiaux": ["Béton C25/30", "Acier FeE500", "Coffrage"],
  "equipements": ["Grue à tour", "Bétonnière", "Vibreur"],
  "methodes_exec": ["Coulage en place", "Vibration mécanique"],
  "criteres_perf": ["Résistance 25 MPa", "Étanchéité classe 2"],
  "localisation": "Bâtiment A - Niveaux R+1 à R+3",
  "quantitatifs": [
    {"label": "Volume béton", "qty": 150, "unite": "m³"},
    {"label": "Surface coffrage", "qty": 800, "unite": "m²"}
  ],
  "confidence_score": 0.85
}
```

### 4. **Avantages**
- ⚡ **Automatique** dès l'upload
- 🧠 **Intelligent** avec GPT-4o
- 📊 **Structuré** et exploitable
- 🔄 **Scalable** avec chunks
- 💾 **Persistant** en base de données

## Configuration

### Variables d'environnement

Créez un fichier `.env` dans `/backend/` :

```bash
# Obligatoire pour l'extraction DCE
OPENAI_API_KEY=your-openai-api-key-here

# Optionnel
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DATABASE_URL=sqlite:///./app.db
```

### Obtenir une clé OpenAI

1. Créez un compte sur [OpenAI Platform](https://platform.openai.com)
2. Générez une clé API
3. Ajoutez-la à votre fichier `.env`

## Sécurité

- Mots de passe hachés avec bcrypt
- Authentification JWT avec expiration
- Validation des types de fichiers
- Stockage sécurisé des documents
- Protection CORS configurée
- Routes protégées côté frontend et backend
- **🆕 Clé API OpenAI sécurisée** (variable d'environnement)

## Tests et utilisation

1. **Démarrer** le projet avec `./start.sh`
2. **S'inscrire** ou se connecter
3. **Naviguer** vers "Documents"
4. **Glisser-déposer** un fichier PDF, DOCX ou XLSX de DCE
5. **Voir la progression** en temps réel
6. **⚡ L'extraction DCE** se lance automatiquement
7. **Consulter les résultats** structurés via l'API

### 🧪 Exemple d'usage de l'extraction

```bash
# 1. Upload d'un document DCE
curl -X POST "http://localhost:8000/documents/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@dce_lot_maconnerie.pdf"

# 2. Consulter l'extraction (après traitement)
curl "http://localhost:8000/documents/1/extraction" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Lancer extraction manuelle si besoin
curl -X POST "http://localhost:8000/documents/1/extract-dce" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Le système est maintenant **ultra-complet** avec extraction intelligente ! 🎉 