import { useState } from 'react';
import { extractionService } from '../utils/api';

const ExtractionCard = ({ extraction, showDocument = false }) => {
  const [expanded, setExpanded] = useState(false);

  const formatConfidenceScore = (score) => {
    if (!score) return 'N/A';
    return `${Math.round(score * 100)}%`;
  };

  const getConfidenceColor = (score) => {
    if (!score) return 'text-gray-500';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const exportQuantitatifs = () => {
    extractionService.exportExtractionToCSV(extraction);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* En-tête de la carte */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {extraction.lot || 'Lot non spécifié'}
            </h3>
            {extraction.sous_lot && (
              <p className="text-blue-100 mt-1">{extraction.sous_lot}</p>
            )}
          </div>
          <div className="text-right">
            <div className={`text-sm font-medium ${getConfidenceColor(extraction.confidence_score)}`}>
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                Confiance: {formatConfidenceScore(extraction.confidence_score)}
              </span>
            </div>
            {showDocument && extraction.document && (
              <p className="text-blue-100 text-sm mt-1">
                Doc #{extraction.document_id}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="p-4">
        {/* Localisation */}
        {extraction.localisation && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center mb-2">
              <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h4 className="font-medium text-gray-900">Localisation</h4>
            </div>
            <p className="text-gray-700">{extraction.localisation}</p>
          </div>
        )}

        {/* Matériaux et Équipements en grille */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Matériaux */}
          {extraction.materiaux && extraction.materiaux.length > 0 && (
            <div className="bg-green-50 p-3 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Matériaux ({extraction.materiaux.length})
              </h4>
              <ul className="space-y-1">
                {extraction.materiaux.slice(0, expanded ? undefined : 3).map((materiau, index) => (
                  <li key={index} className="text-sm text-green-700 flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2 flex-shrink-0"></span>
                    {materiau}
                  </li>
                ))}
              </ul>
              {extraction.materiaux.length > 3 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-sm text-green-600 hover:text-green-800 mt-2"
                >
                  +{extraction.materiaux.length - 3} autres...
                </button>
              )}
            </div>
          )}

          {/* Équipements */}
          {extraction.equipements && extraction.equipements.length > 0 && (
            <div className="bg-orange-50 p-3 rounded-lg">
              <h4 className="font-medium text-orange-800 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Équipements ({extraction.equipements.length})
              </h4>
              <ul className="space-y-1">
                {extraction.equipements.slice(0, expanded ? undefined : 3).map((equipement, index) => (
                  <li key={index} className="text-sm text-orange-700 flex items-center">
                    <span className="w-2 h-2 bg-orange-400 rounded-full mr-2 flex-shrink-0"></span>
                    {equipement}
                  </li>
                ))}
              </ul>
              {extraction.equipements.length > 3 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-sm text-orange-600 hover:text-orange-800 mt-2"
                >
                  +{extraction.equipements.length - 3} autres...
                </button>
              )}
            </div>
          )}
        </div>

        {/* Méthodes et Critères */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Méthodes d'exécution */}
          {extraction.methodes_exec && extraction.methodes_exec.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Méthodes d'exécution
              </h4>
              <ul className="space-y-1">
                {extraction.methodes_exec.slice(0, expanded ? undefined : 2).map((methode, index) => (
                  <li key={index} className="text-sm text-blue-700">
                    • {methode}
                  </li>
                ))}
              </ul>
              {extraction.methodes_exec.length > 2 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 mt-2"
                >
                  +{extraction.methodes_exec.length - 2} autres...
                </button>
              )}
            </div>
          )}

          {/* Critères de performance */}
          {extraction.criteres_perf && extraction.criteres_perf.length > 0 && (
            <div className="bg-purple-50 p-3 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Critères de performance
              </h4>
              <ul className="space-y-1">
                {extraction.criteres_perf.slice(0, expanded ? undefined : 2).map((critere, index) => (
                  <li key={index} className="text-sm text-purple-700">
                    • {critere}
                  </li>
                ))}
              </ul>
              {extraction.criteres_perf.length > 2 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-sm text-purple-600 hover:text-purple-800 mt-2"
                >
                  +{extraction.criteres_perf.length - 2} autres...
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quantitatifs */}
        {extraction.quantitatifs && extraction.quantitatifs.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900 flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Quantitatifs ({extraction.quantitatifs.length})
              </h4>
              <button
                onClick={exportQuantitatifs}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center"
              >
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantité
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unité
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {extraction.quantitatifs.map((quantitatif, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {quantitatif.label}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {quantitatif.qty.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {quantitatif.unite}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pied de carte */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Créé le {new Date(extraction.created_at).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div className="flex space-x-2">
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              >
                Tout afficher
              </button>
            )}
            {expanded && (
              <button
                onClick={() => setExpanded(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
              >
                Réduire
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractionCard; 