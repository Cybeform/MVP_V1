# Backend FastAPI - Système d'Authentification

API REST construite avec FastAPI pour gérer l'authentification utilisateur avec JWT.

## Technologies utilisées

- **FastAPI** - Framework web moderne et rapide
- **SQLAlchemy** - ORM pour Python
- **SQLite** - Base de données légère
- **Pydantic** - Validation des données
- **Python-Jose** - Gestion des tokens JWT
- **Passlib** - Hachage des mots de passe
- **Uvicorn** - Serveur ASGI

## Installation

1. Créer un environnement virtuel :
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate     # Windows
```

2. Installer les dépendances :
```bash
pip install -r requirements.txt
```

## Démarrage

```bash
uvicorn app.main:app --reload
```

L'API sera accessible sur `http://localhost:8000`

## Documentation

- **Swagger UI** : `http://localhost:8000/docs`
- **ReDoc** : `http://localhost:8000/redoc`

## Endpoints

### Authentification

- `POST /auth/register` - Créer un nouveau compte
- `POST /auth/login` - Se connecter
- `GET /auth/me` - Obtenir le profil utilisateur (protégé)

### Utilisateurs

- `GET /users/` - Liste des utilisateurs (protégé)

## Structure du projet

```
app/
├── __init__.py
├── main.py              # Point d'entrée FastAPI
├── database.py          # Configuration base de données
├── models.py            # Modèles SQLAlchemy
├── schemas.py           # Schémas Pydantic
├── auth.py              # Logique d'authentification
└── routes/
    ├── __init__.py
    ├── auth.py          # Routes d'authentification
    └── users.py         # Routes utilisateurs
```

## Configuration

### Variables d'environnement

Créez un fichier `.env` dans le répertoire backend :

```env
SECRET_KEY=your-secret-key-here-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Base de données

La base de données SQLite est créée automatiquement au premier démarrage.

## Sécurité

- Mots de passe hachés avec bcrypt
- Authentification JWT
- Validation des données avec Pydantic
- Protection CORS configurée

## Tests

```bash
# Installer les dépendances de test
pip install pytest pytest-asyncio httpx

# Lancer les tests
pytest
``` 