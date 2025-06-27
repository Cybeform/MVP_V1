import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routes import auth, users, documents

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# Créer les tables de la base de données
models.Base.metadata.create_all(bind=engine)

# Créer l'application FastAPI
app = FastAPI(
    title="API d'authentification et gestion de documents",
    description="Une API complète avec authentification JWT et upload de documents",
    version="1.0.0"
)

# Configuration CORS pour permettre les requêtes depuis le frontend
origins = [
    "http://localhost:3000",  # React
    "http://localhost:5173",  # Vite
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclure les routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(documents.router)

@app.get("/")
def read_root():
    """Route de base pour vérifier que l'API fonctionne"""
    openai_configured = "✅" if os.getenv("OPENAI_API_KEY") else "❌"
    return {
        "message": "Bienvenue sur l'API d'authentification et gestion de documents!",
        "openai_configured": openai_configured,
        "extraction_dce_available": bool(os.getenv("OPENAI_API_KEY"))
    } 