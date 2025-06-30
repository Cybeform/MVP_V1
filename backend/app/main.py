import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routes import auth, users, documents, qa

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# Créer les tables de la base de données
models.Base.metadata.create_all(bind=engine)

# Créer l'application FastAPI
app = FastAPI(
    title="CYBEFORM - Analyse DCE",
    description="API pour l'analyse intelligente de documents DCE avec IA",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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
app.include_router(qa.router)

@app.get("/")
def read_root():
    """Route de base pour vérifier que l'API fonctionne"""
    openai_configured = "✅" if os.getenv("OPENAI_API_KEY") else "❌"
    return {
        "message": "CYBEFORM API - Analyse DCE",
        "version": "1.0.0",
        "features": [
            "Authentification JWT",
            "Upload de documents (PDF, DOCX, XLSX)",
            "Extraction intelligente DCE avec OpenAI",
            "Découpage hiérarchique CCTP",
            "Embeddings vectoriels",
            "Recherche sémantique",
            "Question-Answering intelligent"
        ],
        "docs": "/docs",
        "openai_configured": openai_configured,
        "extraction_dce_available": bool(os.getenv("OPENAI_API_KEY"))
    }

@app.get("/health")
def health_check():
    """Endpoint de vérification de santé"""
    return {
        "status": "healthy",
        "database": "connected",
        "openai_api": "configured" if os.getenv("OPENAI_API_KEY") else "not_configured"
    } 