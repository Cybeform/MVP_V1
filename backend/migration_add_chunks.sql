-- Migration pour ajouter la table document_chunks
-- Date: 2024-01-19

CREATE TABLE document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    lot VARCHAR(255) NULL,
    article VARCHAR(255) NULL,
    text TEXT NOT NULL,
    page_number INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Créer des index pour optimiser les requêtes
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_lot ON document_chunks(lot);
CREATE INDEX idx_document_chunks_article ON document_chunks(article);
CREATE INDEX idx_document_chunks_page_number ON document_chunks(page_number);

-- Index pour recherche textuelle (utilise GIST pour PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_document_chunks_text_search ON document_chunks USING gin(to_tsvector('french', text));

-- Commentaires pour documentation
COMMENT ON TABLE document_chunks IS 'Chunks hiérarchiques des documents CCTP avec structure lot/article';
COMMENT ON COLUMN document_chunks.lot IS 'Titre du lot détecté (ex: "Lot 02 - Gros œuvre")';
COMMENT ON COLUMN document_chunks.article IS 'Numéro d''article détecté (ex: "Article 2.1")';
COMMENT ON COLUMN document_chunks.text IS 'Contenu textuel du chunk';
COMMENT ON COLUMN document_chunks.page_number IS 'Numéro de page dans le document source'; 