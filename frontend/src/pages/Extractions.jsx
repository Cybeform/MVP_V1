import { useState, useEffect } from 'react';
import { extractionService } from '../utils/api';
import ExtractionCard from '../components/ExtractionCard';

function Extractions() {
  const [extractions, setExtractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchExtractions();
  }, []);

  const fetchExtractions = async () => {
    try {
      setLoading(true);
      const data = await extractionService.getExtractions();
      setExtractions(data);
    } catch (error) {
      setError('Erreur lors du chargement des extractions');
      console.error('Error fetching extractions:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportAllToCSV = () => {
    if (filteredExtractions.length === 0) {
      alert('Aucune extraction à exporter');
      return;
    }
    extractionService.exportToCSV(filteredExtractions);
  };

  // Filtrer les extractions
  const filteredExtractions = extractions.filter(extraction => {
    // Filtre par score de confiance
    if (filter === 'high' && extraction.confidence_score < 0.8) return false;
    if (filter === 'medium' && (extraction.confidence_score < 0.6 || extraction.confidence_score >= 0.8)) return false;
    if (filter === 'low' && extraction.confidence_score >= 0.6) return false;

    // Recherche textuelle
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        extraction.lot?.toLowerCase().includes(search) ||
        extraction.sous_lot?.toLowerCase().includes(search) ||
        extraction.localisation?.toLowerCase().includes(search) ||
        extraction.materiaux?.some(m => m.toLowerCase().includes(search)) ||
        extraction.equipements?.some(e => e.toLowerCase().includes(search))
      );
    }

    return true;
  });

  const getStatsData = () => {
    return {
      total: extractions.length,
      high: extractions.filter(e => e.confidence_score >= 0.8).length,
      medium: extractions.filter(e => e.confidence_score >= 0.6 && e.confidence_score < 0.8).length,
      low: extractions.filter(e => e.confidence_score < 0.6).length,
    };
  };

  const stats = getStatsData();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des extractions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Extractions DCE</h1>
          <p className="mt-2 text-gray-600">
            Analyse intelligente de vos documents de consultation des entreprises.
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Total</h3>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Haute confiance</h3>
                <p className="text-2xl font-bold text-green-600">{stats.high}</p>
                <p className="text-sm text-gray-500">≥ 80%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Confiance moyenne</h3>
                <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
                <p className="text-sm text-gray-500">60-79%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Faible confiance</h3>
                <p className="text-2xl font-bold text-red-600">{stats.low}</p>
                <p className="text-sm text-gray-500">&lt; 60%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres et actions */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              {/* Recherche */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Rechercher dans les extractions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtre par confiance */}
              <select
                className="block w-full md:w-auto px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Toutes les extractions</option>
                <option value="high">Haute confiance (≥80%)</option>
                <option value="medium">Confiance moyenne (60-79%)</option>
                <option value="low">Faible confiance (&lt;60%)</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={fetchExtractions}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualiser
              </button>

              <button
                onClick={exportAllToCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
                disabled={filteredExtractions.length === 0}
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exporter CSV ({filteredExtractions.length})
              </button>
            </div>
          </div>
        </div>

        {/* Messages d'erreur */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError('')}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Liste des extractions */}
        {filteredExtractions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {extractions.length === 0 ? 'Aucune extraction' : 'Aucun résultat'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {extractions.length === 0 
                ? 'Commencez par uploader un document DCE pour voir les extractions.'
                : 'Aucune extraction ne correspond à vos critères de recherche.'
              }
            </p>
            {extractions.length === 0 && (
              <div className="mt-6">
                <a
                  href="/upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Uploader un document
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredExtractions.map((extraction) => (
              <ExtractionCard key={extraction.id} extraction={extraction} showDocument={true} />
            ))}
          </div>
        )}

        {/* Pagination info */}
        {filteredExtractions.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Affichage de {filteredExtractions.length} extraction{filteredExtractions.length > 1 ? 's' : ''} 
            {extractions.length !== filteredExtractions.length && ` sur ${extractions.length} au total`}
          </div>
        )}
      </div>
    </div>
  );
}

export default Extractions; 