import React, { useState, useEffect } from 'react';
import { documentService, qaService } from '../utils/api';
import { Link } from 'react-router-dom';

const QuickQA = ({ selectedDocument: propSelectedDocument, onNewQA }) => {
  const [documents, setDocuments] = useState([]);
  const [internalSelectedDocument, setInternalSelectedDocument] = useState(null);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickAnswer, setQuickAnswer] = useState(null);
  const [error, setError] = useState('');

  // Détermine quel document utiliser (prop ou état interne)
  const selectedDocument = propSelectedDocument || internalSelectedDocument;
  const useInternalDocuments = !propSelectedDocument;

  // Questions prédéfinies
  const quickQuestions = [
    "Quels sont les matériaux nécessaires ?",
    "Quelles sont les normes applicables ?",
    "Quelles sont les procédures de sécurité ?",
    "Quels sont les délais d'exécution ?"
  ];

  useEffect(() => {
    // Charger les documents seulement si aucun selectedDocument n'est fourni en prop
    if (useInternalDocuments) {
      loadDocuments();
    }
  }, [useInternalDocuments]);

  const loadDocuments = async () => {
    try {
      const docs = await documentService.getDocuments();
      setDocuments(docs.slice(0, 5)); // Limiter à 5 documents récents
      if (docs.length > 0) {
        setInternalSelectedDocument(docs[0]);
      }
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  const handleQuickQuestion = async (questionText) => {
    if (!selectedDocument) {
      setError('Aucun document sélectionné');
      return;
    }

    setQuestion(questionText);
    setIsLoading(true);
    setError('');
    setQuickAnswer(null);

    try {
      const response = await qaService.askQuestion(selectedDocument.id, questionText, {
        generateAnswer: true,
        chunksLimit: 3
      });
      
      setQuickAnswer(response);
      
      // Notifier le parent s'il y a un callback
      if (onNewQA) {
        onNewQA({
          question: questionText,
          answer: response.answer,
          document_name: selectedDocument.original_filename,
          confidence: response.confidence,
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      setError('Erreur lors de la recherche');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedDocument) return;
    
    await handleQuickQuestion(question.trim());
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center">
          <span className="mr-3">🤖</span>
          Assistant Q&A Rapide
        </h3>
        <Link 
          to="/qa" 
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          Interface complète →
        </Link>
      </div>

      {useInternalDocuments && documents.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📄</span>
          </div>
          <p className="text-gray-500 mb-4">Aucun document disponible</p>
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Uploader un document
          </Link>
        </div>
      ) : !selectedDocument ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📄</span>
          </div>
          <p className="text-gray-500 mb-4">Sélectionnez un document ci-dessus pour commencer</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sélection de document interne (si pas de prop) */}
          {useInternalDocuments && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Document à analyser
              </label>
              <select
                value={selectedDocument?.id || ''}
                onChange={(e) => {
                  const doc = documents.find(d => d.id === parseInt(e.target.value));
                  setInternalSelectedDocument(doc);
                }}
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {documents.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.original_filename.length > 40 
                      ? doc.original_filename.substring(0, 40) + '...' 
                      : doc.original_filename}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Affichage du document sélectionné (si fourni en prop) */}
          {!useInternalDocuments && (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">📄</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Document sélectionné</h4>
                  <p className="text-sm text-gray-600">
                    {selectedDocument.original_filename.length > 40 
                      ? selectedDocument.original_filename.substring(0, 40) + '...' 
                      : selectedDocument.original_filename}
                  </p>
                </div>
                <div className="flex-1 text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✅ Prêt pour analyse
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Questions rapides */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Questions rapides
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quickQuestions.map((q, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickQuestion(q)}
                  disabled={isLoading}
                  className="text-left p-3 text-sm bg-gray-50 hover:bg-blue-50 hover:border-blue-200 rounded-lg border border-gray-200 text-gray-700 hover:text-blue-700 disabled:opacity-50 transition-all duration-200 font-medium"
                >
                  <span className="mr-2">💡</span>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Question personnalisée */}
          <form onSubmit={handleCustomQuestion} className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Question personnalisée
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Tapez votre question..."
                className="flex-1 p-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 text-sm transition-colors font-medium flex items-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <span>🚀</span>
                )}
              </button>
            </div>
          </form>

          {/* Chargement */}
          {isLoading && (
            <div className="flex items-center justify-center py-6 bg-blue-50 rounded-xl">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
              <span className="ml-3 text-sm text-blue-700 font-medium">L'IA analyse votre question...</span>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">❌</span>
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Réponse rapide */}
          {quickAnswer && (
            <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-gray-900 flex items-center">
                  <span className="mr-2">🤖</span>
                  Réponse de l'Assistant IA
                </span>
                {quickAnswer.confidence && (
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    quickAnswer.confidence === 'haute' ? 'bg-green-100 text-green-800' :
                    quickAnswer.confidence === 'moyenne' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {quickAnswer.confidence === 'haute' ? '✅ Haute confiance' :
                     quickAnswer.confidence === 'moyenne' ? '⚠️ Confiance moyenne' :
                     '❌ Faible confiance'}
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    <span className="mr-2">❓</span>
                    {quickAnswer.question}
                  </p>
                </div>
                
                {quickAnswer.answer && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-900 leading-relaxed">
                      <span className="font-semibold mr-2">💬</span>
                      {quickAnswer.answer}
                    </p>
                  </div>
                )}
                
                {quickAnswer.chunks && quickAnswer.chunks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Sources trouvées :</h4>
                    {quickAnswer.chunks.slice(0, 2).map((chunk, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-400">
                        <div className="text-xs text-gray-500 mb-1">
                          {chunk.lot && `📁 ${chunk.lot}`}
                          {chunk.page_number && ` • 📄 Page ${chunk.page_number}`}
                          {` • Pertinence: ${Math.round(chunk.similarity_score * 100)}%`}
                        </div>
                        <p className="text-sm text-gray-700">
                          {chunk.text.length > 120 
                            ? chunk.text.substring(0, 120) + '...'
                            : chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  <span className="mr-4">⏱️ Traité en {quickAnswer.processing_time_ms}ms</span>
                  {quickAnswer.from_cache && <span className="text-blue-600">📝 Depuis le cache</span>}
                </div>
                <Link
                  to="/qa"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Analyse complète →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickQA; 