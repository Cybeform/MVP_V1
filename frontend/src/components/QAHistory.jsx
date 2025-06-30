import React, { useState, useEffect } from 'react';
import { qaHistoryService, documentService } from '../utils/api';

const QAHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  
  // États pour les filtres et la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // États pour les actions
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Charger les données initiales
  useEffect(() => {
    loadHistory();
    loadStats();
    loadDocuments();
  }, [currentPage, perPage, searchTerm, selectedDocument]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        per_page: perPage
      };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      if (selectedDocument) {
        params.document_id = parseInt(selectedDocument);
      }

      const response = await qaHistoryService.getHistory(params);
      setHistory(response.history);
      setTotalPages(response.total_pages);
      setTotalEntries(response.total_entries);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement de l\'historique');
      console.error('Erreur chargement historique:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await qaHistoryService.getHistoryStats();
      setStats(statsData);
    } catch (err) {
      console.error('Erreur chargement statistiques:', err);
    }
  };

  const loadDocuments = async () => {
    try {
      const docsData = await documentService.getDocuments();
      setDocuments(docsData);
    } catch (err) {
      console.error('Erreur chargement documents:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadHistory();
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await qaHistoryService.deleteHistoryItem(itemId);
      loadHistory();
      loadStats();
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (err) {
      setError('Erreur lors de la suppression');
      console.error('Erreur suppression:', err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer tout l\'historique ? Cette action est irréversible.')) {
      return;
    }

    try {
      const documentId = selectedDocument ? parseInt(selectedDocument) : null;
      await qaHistoryService.clearHistory(documentId);
      loadHistory();
      loadStats();
    } catch (err) {
      setError('Erreur lors de la suppression de l\'historique');
      console.error('Erreur suppression historique:', err);
    }
  };

  const handleExportHistory = () => {
    if (history.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }
    qaHistoryService.exportHistoryToCSV(history);
  };

  const getConfidenceBadge = (confidence) => {
    const badges = {
      'haute': 'bg-green-100 text-green-800',
      'moyenne': 'bg-yellow-100 text-yellow-800',
      'faible': 'bg-red-100 text-red-800'
    };
    
    return badges[confidence] || 'bg-gray-100 text-gray-800';
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading && history.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📚 Historique Q&A
        </h1>
        <p className="text-gray-600">
          Consultez l'historique de vos questions et réponses sur les documents
        </p>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-blue-600">{stats.total_questions}</div>
            <div className="text-sm text-gray-600">Questions posées</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-green-600">{stats.answer_rate}%</div>
            <div className="text-sm text-gray-600">Taux de réponse</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-purple-600">{stats.cache_hit_rate}%</div>
            <div className="text-sm text-gray-600">Cache hit rate</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-2xl font-bold text-orange-600">
              {stats.most_questioned_documents?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Documents analysés</div>
          </div>
        </div>
      )}

      {/* Barre d'outils */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Recherche */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher dans les questions..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </form>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              🔍 Filtres
            </button>
            <button
              onClick={handleExportHistory}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              📊 Exporter CSV
            </button>
            <button
              onClick={handleClearHistory}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              🗑️ Vider l'historique
            </button>
          </div>
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document
                </label>
                <select
                  value={selectedDocument}
                  onChange={(e) => {
                    setSelectedDocument(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tous les documents</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.original_filename}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Résultats par page
                </label>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="text-red-600">
              ⚠️ {error}
            </div>
          </div>
        </div>
      )}

      {/* Liste de l'historique */}
      {history.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun historique</h3>
          <p className="text-gray-600">
            {searchTerm || selectedDocument 
              ? 'Aucun résultat pour ces critères de recherche'
              : 'Vous n\'avez pas encore posé de questions'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-500">
                      {qaHistoryService.formatDate(item.created_at)}
                    </span>
                    {item.from_cache && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Cache
                      </span>
                    )}
                    {item.confidence && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceBadge(item.confidence)}`}>
                        {item.confidence}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">
                    📄 {item.document_name}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setItemToDelete(item.id);
                    setShowDeleteConfirm(true);
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Supprimer cette entrée"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Question :</div>
                  <div className="text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {item.question}
                  </div>
                </div>

                {item.answer && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Réponse :</div>
                    <div className="text-gray-900 bg-blue-50 p-3 rounded-lg">
                      {truncateText(item.answer, 300)}
                      {item.answer.length > 300 && (
                        <button className="text-blue-600 hover:text-blue-800 ml-2 text-sm font-medium">
                          Voir plus
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  {item.processing_time_ms && (
                    <span>⏱️ {item.processing_time_ms}ms</span>
                  )}
                  {item.chunks_returned && (
                    <span>📊 {item.chunks_returned} passages</span>
                  )}
                  {item.similarity_threshold && (
                    <span>🎯 Seuil: {item.similarity_threshold}</span>
                  )}
                  {item.embedding_model && (
                    <span>🤖 {item.embedding_model}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                    pageNum === currentPage
                      ? 'text-white bg-blue-600'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </nav>
        </div>
      )}

      {/* Info pagination */}
      {totalEntries > 0 && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Affichage de {((currentPage - 1) * perPage) + 1} à {Math.min(currentPage * perPage, totalEntries)} sur {totalEntries} entrées
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer cette entrée de l'historique ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteItem(itemToDelete)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QAHistory; 