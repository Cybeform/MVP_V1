import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService, extractionService, documentService } from '../utils/api';
import ExtractionCard from '../components/ExtractionCard';
import ExtractionProgress from '../components/ExtractionProgress';

function ProjectExtractions() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [extractions, setExtractions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Récupérer les informations du projet
        const projectData = await projectService.getProject(projectId);
        setProject(projectData);
        
        // Récupérer tous les documents et extractions
        const [documentsData, extractionsData] = await Promise.all([
          documentService.getDocuments(),
          extractionService.getExtractions()
        ]);
        
        // Filtrer par projet
        const projectDocuments = documentsData.filter(doc => doc.project_id === parseInt(projectId));
        const projectDocumentIds = projectDocuments.map(doc => doc.id);
        const projectExtractions = extractionsData.filter(ext => projectDocumentIds.includes(ext.document_id));
        
        setDocuments(projectDocuments);
        setExtractions(projectExtractions);
        
        // Calculer les statistiques
        const statsData = calculateStats(projectExtractions);
        setStats(statsData);
        
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

  const calculateStats = (extractionsData) => {
    const stats = {
      total: extractionsData.length,
      completed: 0,
      processing: 0,
      pending: 0,
      failed: 0
    };

    extractionsData.forEach(extraction => {
      stats[extraction.status] = (stats[extraction.status] || 0) + 1;
    });

    return stats;
  };

  const handleExtractionUpdate = (updatedExtraction) => {
    setExtractions(prev => 
      prev.map(ext => ext.id === updatedExtraction.id ? updatedExtraction : ext)
    );
    
    // Recalculer les stats
    const newExtractions = extractions.map(ext => 
      ext.id === updatedExtraction.id ? updatedExtraction : ext
    );
    setStats(calculateStats(newExtractions));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-purple-500 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium text-lg">Chargement des extractions...</p>
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
              <span className="text-2xl">⚡</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Extractions DCE : {project.name}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Analysez automatiquement vos documents avec l'intelligence artificielle pour extraire les données DCE.
            </p>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600 mb-1">{stats.total}</div>
              <div className="text-blue-700 font-medium text-sm">Total</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600 mb-1">{stats.completed || 0}</div>
              <div className="text-green-700 font-medium text-sm">Terminées</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <div className="text-2xl font-bold text-orange-600 mb-1">{stats.processing || 0}</div>
              <div className="text-orange-700 font-medium text-sm">En cours</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-xl">
              <div className="text-2xl font-bold text-yellow-600 mb-1">{stats.pending || 0}</div>
              <div className="text-yellow-700 font-medium text-sm">En attente</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <div className="text-2xl font-bold text-red-600 mb-1">{stats.failed || 0}</div>
              <div className="text-red-700 font-medium text-sm">Échouées</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {documents.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <div 
                className="w-6 h-6 rounded-full mr-3"
                style={{ backgroundColor: project.color }}
              ></div>
              🚀 Actions rapides
            </h2>
            <div className="flex flex-wrap gap-4">
              <Link
                to={`/project/${projectId}/documents`}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                📄 Gérer les documents
              </Link>
              {extractions.length > 0 && (
                <button
                  onClick={() => extractionService.exportToCSV(extractions)}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
                >
                  📊 Exporter en CSV
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contenu principal */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {extractions.length > 0 ? (
            <div className="p-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: project.color }}
                  ></div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Extractions du projet ({extractions.length})
                  </h2>
                </div>
              </div>
              
              {/* Liste des extractions en cours */}
              {extractions.filter(ext => ext.status === 'processing').length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">⏳ Extractions en cours</h3>
                  <div className="space-y-4">
                    {extractions.filter(ext => ext.status === 'processing').map(extraction => (
                      <ExtractionProgress 
                        key={extraction.id} 
                        extraction={extraction}
                        onUpdate={handleExtractionUpdate}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Liste des extractions terminées */}
              <div className="space-y-6">
                {extractions
                  .filter(ext => ext.status !== 'processing')
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map(extraction => {
                    const document = documents.find(doc => doc.id === extraction.document_id);
                    return (
                      <ExtractionCard 
                        key={extraction.id} 
                        extraction={extraction}
                        document={document}
                        onUpdate={handleExtractionUpdate}
                      />
                    );
                  })}
              </div>
            </div>
          ) : documents.length > 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Aucune extraction</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Ce projet contient {documents.length} document{documents.length > 1 ? 's' : ''} mais aucune extraction DCE n'a encore été lancée.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to={`/project/${projectId}/documents`}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
                >
                  📄 Voir les documents
                </Link>
                <Link
                  to="/extractions"
                  className="px-8 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium"
                >
                  ⚡ Lancer une extraction
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">📄</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Aucun document</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Ce projet ne contient aucun document. Vous devez d'abord ajouter des documents avant de pouvoir lancer des extractions DCE.
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
    </div>
  );
}

export default ProjectExtractions; 