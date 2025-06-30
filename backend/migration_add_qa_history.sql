-- Migration pour ajouter la table qa_history
-- Date: 2024-12-27
-- Description: Ajoute une table pour stocker l'historique des questions-réponses Q&A

CREATE TABLE IF NOT EXISTS qa_history (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    confidence VARCHAR(20),
    processing_time_ms INTEGER,
    chunks_returned INTEGER,
    similarity_threshold REAL,
    embedding_model VARCHAR(100),  -- Renommé de model_used
    from_cache BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Clés étrangères
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_qa_history_user_id ON qa_history(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_history_document_id ON qa_history(document_id);
CREATE INDEX IF NOT EXISTS idx_qa_history_created_at ON qa_history(created_at);
CREATE INDEX IF NOT EXISTS idx_qa_history_user_created ON qa_history(user_id, created_at DESC); 