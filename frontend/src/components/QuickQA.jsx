import React, { useState, useEffect } from 'react';
import { documentService, qaService } from '../utils/api';
import { Link } from 'react-router-dom';

const QuickQA = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickAnswer, setQuickAnswer] = useState(null);
  const [error, setError] = useState('');

  // Questions prédéfinies
  const quickQuestions = [
    "Quels sont les matériaux nécessaires ?",
    "Quelles sont les normes applicables ?",
    "Quelles sont les procédures de sécurité ?",
    "Quels sont les délais d'exécution ?"
  ];

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await documentService.getDocuments();
      setDocuments(docs.slice(0, 5)); // Limiter à 5 documents récents
      if (docs.length > 0) {
        setSelectedDocument(docs[0]);
      }
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    }
  };

  const handleQuickQuestion = async (questionText) => {
    if (!selectedDocument) {
      setError('Veuillez sélectionner un document');
      return;
    }

    setQuestion(questionText);
    setIsLoading(true);
    setError('');
    setQuickAnswer(null);

    try {
      const response = await qaService.getBestMatch(selectedDocument.id, questionText);
      setQuickAnswer(response);
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          🤖 Assistant Q&A Rapide
        </h3>
        <Link 
          to="/qa" 
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Interface complète →
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-500 mb-3">Aucun document disponible</p>
          <Link
            to="/upload"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Uploader un document
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sélection du document */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document à analyser
            </label>
            <select
              value={selectedDocument?.id || ''}
              onChange={(e) => {
                const doc = documents.find(d => d.id === parseInt(e.target.value));
                setSelectedDocument(doc);
              }}
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.original_filename.length > 30 
                    ? doc.original_filename.substring(0, 30) + '...' 
                    : doc.original_filename}
                </option>
              ))}
            </select>
          </div>

          {/* Questions rapides */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Questions rapides
            </label>
            <div className="grid grid-cols-1 gap-2">
              {quickQuestions.map((q, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickQuestion(q)}
                  disabled={isLoading}
                  className="text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border text-gray-700 hover:text-gray-900 disabled:opacity-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Question personnalisée */}
          <form onSubmit={handleCustomQuestion} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Question personnalisée
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Tapez votre question..."
                className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 text-sm transition-colors"
              >
                {isLoading ? '...' : '🚀'}
              </button>
            </div>
          </form>

          {/* Chargement */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Recherche en cours...</span>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Réponse rapide */}
          {quickAnswer && (
            <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Réponse rapide</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  quickAnswer.confidence === 'haute' ? 'bg-green-100 text-green-800' :
                  quickAnswer.confidence === 'moyenne' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {quickAnswer.confidence || 'N/A'}
                </span>
              </div>
              
              <p className="text-sm font-medium text-blue-900 mb-2">
                Q: {quickAnswer.question}
              </p>
              
              {quickAnswer.best_match && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500">
                    {quickAnswer.best_match.lot && `📁 ${quickAnswer.best_match.lot}`}
                    {quickAnswer.best_match.page_number && ` • 📄 Page ${quickAnswer.best_match.page_number}`}
                    {` • Score: ${Math.round(quickAnswer.best_match.similarity_score * 100)}%`}
                  </div>
                  <p className="text-sm text-gray-700">
                    {quickAnswer.best_match.text.length > 150 
                      ? quickAnswer.best_match.text.substring(0, 150) + '...'
                      : quickAnswer.best_match.text}
                  </p>
                </div>
              )}
              
              <div className="mt-3 flex justify-end">
                <Link
                  to="/qa"
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Voir l'analyse complète →
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