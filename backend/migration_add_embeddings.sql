-- Migration pour ajouter les colonnes embedding aux document_chunks
-- Date: 2024-01-19

-- Ajouter les colonnes pour les embeddings
ALTER TABLE document_chunks ADD COLUMN embedding BLOB NULL;
ALTER TABLE document_chunks ADD COLUMN embedding_model VARCHAR(100) NULL;
ALTER TABLE document_chunks ADD COLUMN embedding_created_at DATETIME NULL;

-- Créer un index pour optimiser les requêtes sur embedding_model
CREATE INDEX idx_document_chunks_embedding_model ON document_chunks(embedding_model);
CREATE INDEX idx_document_chunks_embedding_created_at ON document_chunks(embedding_created_at);

-- Commentaires pour documentation
-- COMMENT ON COLUMN document_chunks.embedding IS 'Vecteur embedding binaire (1536 dimensions pour text-embedding-3-large)';
-- COMMENT ON COLUMN document_chunks.embedding_model IS 'Modèle OpenAI utilisé pour générer l''embedding';
-- COMMENT ON COLUMN document_chunks.embedding_created_at IS 'Date de création de l''embedding'; 