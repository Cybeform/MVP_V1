import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService, documentService, qaService, qaHistoryService } from '../utils/api';
import QuickQA from '../components/QuickQA';

function ProjectQA() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [qaHistory, setQAHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('qa');

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Récupérer les informations du projet
        const projectData = await projectService.getProject(projectId);
        setProject(projectData);
        
        // Récupérer les documents du projet
        const documentsData = await documentService.getDocuments();
        const projectDocuments = documentsData.filter(doc => doc.project_id === parseInt(projectId));
        setDocuments(projectDocuments);
        
        // Sélectionner le premier document par défaut
        if (projectDocuments.length > 0) {
          setSelectedDocument(projectDocuments[0]);
        }
        
        // Récupérer l'historique Q&A filtré par projet
        if (projectDocuments.length > 0) {
          const documentIds = projectDocuments.map(doc => doc.id);
          const historyData = await qaHistoryService.getHistory({ per_page: 50 });
          const projectHistory = historyData.history.filter(item => 
            documentIds.includes(item.document_id)
          );
          setQAHistory(projectHistory);
        }
        
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

  const handleNewQA = (newQAItem) => {
    setQAHistory(prev => [newQAItem, ...prev]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-green-500 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium text-lg">Chargement de l'assistant IA...</p>
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
              <span className="text-2xl">💬</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Questions & Réponses : {project.name}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Posez des questions sur les documents de votre projet. L'assistant IA vous fournira des réponses précises et contextuelles.
            </p>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-3xl font-bold text-blue-600 mb-2">{documents.length}</div>
              <div className="text-blue-700 font-medium">Document{documents.length > 1 ? 's' : ''} disponible{documents.length > 1 ? 's' : ''}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-3xl font-bold text-green-600 mb-2">{qaHistory.length}</div>
              <div className="text-green-700 font-medium">Question{qaHistory.length > 1 ? 's' : ''} posée{qaHistory.length > 1 ? 's' : ''}</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-600 font-bold">Assistant IA</span>
              </div>
              <div className="text-purple-700 font-medium mt-1">Disponible</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {documents.filter(doc => doc.chunks_created).length}
              </div>
              <div className="text-orange-700 font-medium">Document{documents.filter(doc => doc.chunks_created).length > 1 ? 's' : ''} analysé{documents.filter(doc => doc.chunks_created).length > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

        {documents.length > 0 ? (
          <>
            {/* Sélecteur de document */}
            <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <div 
                  className="w-6 h-6 rounded-full mr-3"
                  style={{ backgroundColor: project.color }}
                ></div>
                📄 Sélectionner un document
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map(document => (
                  <button
                    key={document.id}
                    onClick={() => setSelectedDocument(document)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      selectedDocument?.id === document.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        selectedDocument?.id === document.id ? 'bg-green-600' : 'bg-gray-600'
                      }`}>
                        <span className="text-white text-lg">📄</span>
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${
                          selectedDocument?.id === document.id ? 'text-green-900' : 'text-gray-900'
                        }`}>
                          {document.original_filename}
                        </h3>
                        <p className={`text-sm ${
                          selectedDocument?.id === document.id ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {Math.round(document.file_size / 1024)} KB • {document.file_type}
                        </p>
                        {document.chunks_created && (
                          <div className="flex items-center space-x-1 mt-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-green-600">Analysé</span>
                          </div>
                        )}
                      </div>
                      {selectedDocument?.id === document.id && (
                        <div className="text-green-600">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interface Q&A */}
            {selectedDocument ? (
              <div className="mb-8">
                <QuickQA 
                  selectedDocument={selectedDocument}
                  onNewQA={handleNewQA}
                />
              </div>
            ) : (
              <div className="mb-8 bg-white rounded-2xl shadow-lg p-12 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">🤖</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Sélectionnez un document</h3>
                <p className="text-gray-600">
                  Choisissez un document ci-dessus pour commencer à poser des questions à l'assistant IA.
                </p>
              </div>
            )}

            {/* Historique Q&A */}
            {qaHistory.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-3">📚</span>
                  Historique des questions ({qaHistory.length})
                </h2>
                
                <div className="space-y-6">
                  {qaHistory.slice(0, 10).map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-bold">Q</span>
                        </div>
                        <div className="flex-1">
                          <div className="mb-4">
                            <p className="font-semibold text-gray-900 mb-2">{item.question}</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>📄 {item.document_name}</span>
                              <span>🕒 {qaHistoryService.formatDate(item.created_at)}</span>
                              {item.confidence && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  item.confidence === 'haute' ? 'bg-green-100 text-green-700' :
                                  item.confidence === 'moyenne' ? 'bg-orange-100 text-orange-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {qaService.formatConfidence(item.confidence).label}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {item.answer && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-green-600 font-bold text-sm">IA</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-gray-900 text-sm leading-relaxed">
                                    {item.answer.length > 300 
                                      ? item.answer.substring(0, 300) + '...' 
                                      : item.answer
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {qaHistory.length > 10 && (
                  <div className="text-center mt-6">
                    <Link 
                      to="/qa/history"
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                      Voir tout l'historique
                    </Link>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Message si aucun document */
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">📄</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Aucun document disponible</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Ce projet ne contient aucun document. Vous devez d'abord ajouter des documents avant de pouvoir utiliser l'assistant IA.
            </p>
            <Link
              to={`/project/${projectId}/documents`}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
            >
              📤 Ajouter des documents
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectQA; 