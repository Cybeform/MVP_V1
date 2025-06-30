import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentService, qaService } from '../utils/api';
import PDFViewer from './PDFViewer';

const QAInterface = () => {
  // États pour l'interface
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qaResponse, setQaResponse] = useState(null);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  
  // Options avancées
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.6);
  const [chunksLimit, setChunksLimit] = useState(6);
  const [generateAnswer, setGenerateAnswer] = useState(true);

  // États pour la visualisation PDF
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [pdfDocumentId, setPdfDocumentId] = useState(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfDocumentName, setPdfDocumentName] = useState('');

  // Charger les documents au montage du composant
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await documentService.getDocuments();
      setDocuments(docs);
      
      // Sélectionner le premier document par défaut
      if (docs.length > 0) {
        setSelectedDocument(docs[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
      setError('Impossible de charger les documents');
    }
  };

  // Validation en temps réel de la question
  useEffect(() => {
    if (question) {
      const validation = qaService.validateQuestion(question);
      setValidationError(validation.isValid ? '' : validation.errors[0]);
    } else {
      setValidationError('');
    }
  }, [question]);

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    
    if (!selectedDocument) {
      setError('Veuillez sélectionner un document');
      return;
    }

    const validation = qaService.validateQuestion(question);
    if (!validation.isValid) {
      setValidationError(validation.errors[0]);
      return;
    }

    setIsLoading(true);
    setError('');
    setQaResponse(null);

    try {
      const options = {
        similarityThreshold,
        chunksLimit,
        generateAnswer
      };

      const response = await qaService.askQuestion(
        selectedDocument.id, 
        question.trim(), 
        options
      );
      
      setQaResponse(response);
      
    } catch (error) {
      console.error('Erreur lors de la question:', error);
      setError(
        error.response?.data?.detail || 
        'Erreur lors du traitement de votre question. Veuillez réessayer.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setQaResponse(null);
    setError('');
    setQuestion('');
    setValidationError('');
  };

  const exportResponse = () => {
    if (qaResponse) {
      qaService.exportQAToText(qaResponse);
    }
  };

  // Ouvrir le PDF à une page spécifique
  const openPDFAtPage = async (pageNumber = 1) => {
    if (!selectedDocument) return;

    // Vérifier que c'est un PDF
    if (!documentService.isPDF(selectedDocument)) {
      alert('Ce document n\'est pas un PDF. La visualisation n\'est disponible que pour les fichiers PDF.');
      return;
    }

    setPdfDocumentId(selectedDocument.id);
    setPdfPage(pageNumber);
    setPdfDocumentName(selectedDocument.original_filename);
    setShowPDFViewer(true);
  };

  // Fermer la visionneuse PDF
  const closePDFViewer = () => {
    setShowPDFViewer(false);
    setPdfDocumentId(null);
    setPdfPage(1);
    setPdfDocumentName('');
  };

  // Composant pour afficher la confiance
  const ConfidenceBadge = ({ confidence }) => {
    const confidenceData = qaService.formatConfidence(confidence);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[confidenceData.color]}`}>
        <span className="mr-1">{confidenceData.emoji}</span>
        {confidenceData.label}
      </span>
    );
  };

  return (
    <>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🤖 Assistant Q&A Intelligent
              </h1>
              <p className="text-gray-600">
                Posez des questions sur vos documents CCTP et obtenez des réponses précises avec citations
              </p>
            </div>
            <Link
              to="/qa/history"
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Voir l'historique
            </Link>
          </div>
        </div>

        {/* Formulaire de question */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmitQuestion} className="space-y-4">
            {/* Sélection du document */}
            <div>
              <label htmlFor="document-select" className="block text-sm font-medium text-gray-700 mb-2">
                Document à analyser
              </label>
              {documents.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-yellow-800">
                    Aucun document disponible. Veuillez d'abord uploader des documents.
                  </p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <select
                    id="document-select"
                    value={selectedDocument?.id || ''}
                    onChange={(e) => {
                      const doc = documents.find(d => d.id === parseInt(e.target.value));
                      setSelectedDocument(doc);
                    }}
                    className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {documents.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.original_filename} ({new Date(doc.upload_date).toLocaleDateString('fr-FR')})
                      </option>
                    ))}
                  </select>
                  
                  {/* Bouton pour ouvrir le PDF */}
                  {selectedDocument && documentService.isPDF(selectedDocument) && (
                    <button
                      type="button"
                      onClick={() => openPDFAtPage(1)}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center"
                      title="Visualiser le PDF"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="ml-2 hidden sm:inline">PDF</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Champ de question */}
            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                Votre question
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex: Quels sont les matériaux nécessaires pour le gros œuvre ? Quelles sont les normes de sécurité applicables ?"
                rows={3}
                className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              
              {/* Indicateur de caractères */}
              <div className="flex justify-between items-center mt-1">
                <span className={`text-sm ${validationError ? 'text-red-500' : 'text-gray-500'}`}>
                  {validationError || `${question.length}/500 caractères`}
                </span>
                
                {question.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuestion('')}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {/* Options avancées */}
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-800"
              >
                <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
                  ▶
                </span>
                <span className="ml-1">Options avancées</span>
              </button>

              {showAdvanced && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seuil de similarité: {similarityThreshold}
                      </label>
                      <input
                        type="range"
                        min="0.3"
                        max="0.9"
                        step="0.1"
                        value={similarityThreshold}
                        onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Large</span>
                        <span>Précis</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre de passages: {chunksLimit}
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        step="1"
                        value={chunksLimit}
                        onChange={(e) => setChunksLimit(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Rapide</span>
                        <span>Complet</span>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="generateAnswer"
                        checked={generateAnswer}
                        onChange={(e) => setGenerateAnswer(e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="generateAnswer" className="text-sm text-gray-700">
                        Générer une réponse avec GPT-4o
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading || !selectedDocument || !question.trim() || validationError}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🚀</span>
                    Poser la question
                  </>
                )}
              </button>

              {(qaResponse || error) && (
                <button
                  type="button"
                  onClick={clearResults}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Nouvelle question
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">❌</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Affichage de la réponse */}
        {qaResponse && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* En-tête de la réponse */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  💬 Réponse
                </h2>
                <p className="text-sm text-gray-600">
                  Document: <span className="font-medium">{qaResponse.document_name}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                {qaResponse.confidence && (
                  <ConfidenceBadge confidence={qaResponse.confidence} />
                )}
                <button
                  onClick={exportResponse}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <span className="mr-1">📄</span>
                  Exporter
                </button>
              </div>
            </div>

            {/* Question posée */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="text-blue-900 font-medium">Q: {qaResponse.question}</p>
            </div>

            {/* Réponse générée */}
            {qaResponse.answer && (
              <div className="bg-green-50 border-l-4 border-green-400 p-4">
                <div className="flex items-center mb-2">
                  <span className="text-green-600 font-medium">🤖 Réponse intelligente</span>
                  {qaResponse.gpt_model_used && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({qaResponse.gpt_model_used})
                    </span>
                  )}
                </div>
                <div className="text-green-900 whitespace-pre-wrap">
                  {qaResponse.answer}
                </div>
              </div>
            )}

            {/* Citations avec liens vers PDF */}
            {qaResponse.citations && qaResponse.citations.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  📚 Sources et citations
                </h3>
                <div className="space-y-3">
                  {qaResponse.citations.map((citation, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          Citation {index + 1}
                        </span>
                        <div className="flex items-center text-xs text-gray-500 space-x-2">
                          {citation.lot && <span>📁 {citation.lot}</span>}
                          {citation.page && (
                            <button
                              onClick={() => openPDFAtPage(citation.page)}
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 underline cursor-pointer"
                              title={`Voir la page ${citation.page} dans le PDF`}
                            >
                              <span>📄 Page {citation.page}</span>
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 italic mb-2">"{citation.excerpt}"</p>
                      
                      {/* Bouton pour voir dans le PDF */}
                      {citation.page && selectedDocument && documentService.isPDF(selectedDocument) && (
                        <button
                          onClick={() => openPDFAtPage(citation.page)}
                          className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          🔍 Voir dans le PDF →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistiques */}
            <div className="bg-gray-50 rounded-md p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">📊 Statistiques</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Passages analysés:</span>
                  <br />
                  <span className="text-lg font-bold text-blue-600">{qaResponse.chunks_returned}</span>
                </div>
                <div>
                  <span className="font-medium">Temps de recherche:</span>
                  <br />
                  <span className="text-lg font-bold text-green-600">{qaResponse.processing_time_ms}ms</span>
                </div>
                {qaResponse.answer_generation_time_ms && (
                  <div>
                    <span className="font-medium">Temps génération:</span>
                    <br />
                    <span className="text-lg font-bold text-purple-600">{qaResponse.answer_generation_time_ms}ms</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Seuil similarité:</span>
                  <br />
                  <span className="text-lg font-bold text-gray-600">{Math.round(qaResponse.similarity_threshold * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Passages détaillés (repliables) */}
            {qaResponse.chunks && qaResponse.chunks.length > 0 && (
              <details className="border border-gray-200 rounded-md">
                <summary className="p-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
                  🔍 Voir tous les passages trouvés ({qaResponse.chunks.length})
                </summary>
                <div className="p-4 border-t space-y-4">
                  {qaResponse.chunks.map((chunk, index) => (
                    <div key={chunk.chunk_id} className="border border-gray-200 rounded-md p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">Passage {index + 1}</span>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>Score: {Math.round(chunk.similarity_score * 100)}%</span>
                          {chunk.lot && <span>📁 {chunk.lot}</span>}
                          {chunk.page_number && (
                            <button
                              onClick={() => openPDFAtPage(chunk.page_number)}
                              className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                              title={`Voir la page ${chunk.page_number} dans le PDF`}
                            >
                              📄 Page {chunk.page_number}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700">{chunk.text}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Visionneuse PDF en modal */}
      {showPDFViewer && pdfDocumentId && (
        <PDFViewer
          documentId={pdfDocumentId}
          initialPage={pdfPage}
          documentName={pdfDocumentName}
          onClose={closePDFViewer}
        />
      )}
    </>
  );
};

export default QAInterface; 