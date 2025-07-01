-- Migration pour ajouter le système de projets
-- Date: 2024-06-30

-- 1. Créer la table des projets
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    description TEXT,
    color VARCHAR DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    owner_id INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Créer un index sur owner_id pour les performances
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);

-- 3. Créer un projet par défaut pour chaque utilisateur existant
INSERT INTO projects (name, description, color, owner_id)
SELECT 
    'Projet par défaut' as name,
    'Projet créé automatiquement pour organiser vos documents existants' as description,
    '#10B981' as color,
    id as owner_id
FROM users
WHERE id NOT IN (SELECT DISTINCT owner_id FROM projects WHERE name = 'Projet par défaut');

-- 4. Ajouter la colonne project_id à la table documents
ALTER TABLE documents ADD COLUMN project_id INTEGER;

-- 5. Mettre à jour tous les documents existants pour les associer au projet par défaut de leur propriétaire
UPDATE documents 
SET project_id = (
    SELECT p.id 
    FROM projects p 
    WHERE p.owner_id = documents.owner_id 
    AND p.name = 'Projet par défaut'
    LIMIT 1
)
WHERE project_id IS NULL;

-- 6. Maintenant que tous les documents ont un project_id, rendre la colonne NOT NULL
-- Note: SQLite ne supporte pas ALTER TABLE ... ALTER COLUMN, donc on recrée la table

-- Créer une table temporaire avec la nouvelle structure
CREATE TABLE documents_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename VARCHAR NOT NULL,
    original_filename VARCHAR NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    owner_id INTEGER,
    project_id INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Copier les données existantes
INSERT INTO documents_new (id, filename, original_filename, file_size, file_type, file_path, upload_date, owner_id, project_id)
SELECT id, filename, original_filename, file_size, file_type, file_path, upload_date, owner_id, project_id
FROM documents;

-- Supprimer l'ancienne table et renommer la nouvelle
DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;

-- Recréer les index
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

-- 7. Vérification des données
-- Compter les projets créés
SELECT 'Projects created:' as info, COUNT(*) as count FROM projects;

-- Compter les documents avec project_id
SELECT 'Documents with project_id:' as info, COUNT(*) as count FROM documents WHERE project_id IS NOT NULL;

-- Afficher les projets par utilisateur
SELECT 
    u.username,
    p.name as project_name,
    COUNT(d.id) as documents_count
FROM users u
LEFT JOIN projects p ON u.id = p.owner_id
LEFT JOIN documents d ON p.id = d.project_id
GROUP BY u.id, p.id
ORDER BY u.username, p.name; 