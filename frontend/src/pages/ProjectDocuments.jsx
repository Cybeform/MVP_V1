import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService, documentService } from '../utils/api';
import FileUpload from '../components/FileUpload';
import DocumentsList from '../components/DocumentsList';

function ProjectDocuments() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('documents');

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Récupérer les informations du projet
        const projectData = await projectService.getProject(projectId);
        setProject(projectData);
        
        // Récupérer les documents du projet
        // Note: Il faudra modifier l'API pour filtrer par projet
        const documentsData = await documentService.getDocuments();
        // Filtrer les documents par project_id côté client pour l'instant
        const projectDocuments = documentsData.filter(doc => doc.project_id === parseInt(projectId));
        setDocuments(projectDocuments);
        
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setError('Erreur lors du chargement des données du projet');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-500 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium text-lg">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">❌</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">Erreur</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link to="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">❓</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">Projet non trouvé</h3>
          <p className="text-gray-600 mb-6">Le projet demandé n'existe pas ou vous n'y avez pas accès.</p>
          <Link to="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête avec navigation */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <Link 
              to="/dashboard" 
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Retour au tableau de bord
            </Link>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4"
                 style={{ background: `linear-gradient(135deg, ${project.color}, ${project.color}dd)` }}>
              <span className="text-2xl">📄</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Documents du projet : {project.name}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Gérez les documents de votre projet. Uploadez de nouveaux fichiers ou consultez les documents existants.
            </p>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-3xl font-bold text-blue-600 mb-2">{documents.length}</div>
              <div className="text-blue-700 font-medium">Document{documents.length > 1 ? 's' : ''}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {documents.reduce((total, doc) => total + (doc.file_size || 0), 0) / (1024 * 1024) < 1 
                  ? Math.round(documents.reduce((total, doc) => total + (doc.file_size || 0), 0) / 1024) + ' KB'
                  : Math.round(documents.reduce((total, doc) => total + (doc.file_size || 0), 0) / (1024 * 1024)) + ' MB'
                }
              </div>
              <div className="text-green-700 font-medium">Taille totale</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {new Set(documents.map(doc => doc.file_type)).size}
              </div>
              <div className="text-purple-700 font-medium">Type{new Set(documents.map(doc => doc.file_type)).size > 1 ? 's' : ''} de fichier</div>
            </div>
          </div>
        </div>
        
        {/* Onglets */}
        <div className="mb-8">
          <nav className="flex space-x-8 bg-white rounded-xl p-2 shadow-md" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 py-3 px-6 font-semibold text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'documents'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              📋 Mes documents ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-3 px-6 font-semibold text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              📤 Upload de fichiers
            </button>
          </nav>
        </div>

        {/* Contenu des onglets */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {activeTab === 'documents' && (
            <div className="p-8">
              <div className="mb-6 flex items-center space-x-3">
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: project.color }}
                ></div>
                <h2 className="text-xl font-bold text-gray-900">
                  Documents du projet
                </h2>
              </div>
              
              {documents.length > 0 ? (
                <DocumentsList documents={documents} />
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">📄</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Aucun document</h3>
                  <p className="text-gray-600 mb-6">
                    Ce projet ne contient aucun document pour le moment.
                  </p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
                  >
                    Ajouter le premier document
                  </button>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'upload' && (
            <div className="p-8">
              <div className="mb-6 flex items-center space-x-3">
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: project.color }}
                ></div>
                <h2 className="text-xl font-bold text-gray-900">
                  Upload dans le projet : {project.name}
                </h2>
              </div>
              <FileUpload selectedProject={project} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectDocuments; 