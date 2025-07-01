import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { documentService, qaService, projectService } from '../utils/api';
import PDFViewer from './PDFViewer';
import ProjectSelector from './ProjectSelector';
import VoiceRecognition from './VoiceRecognition';

const QAInterface = () => {
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get('project');
  
  // États pour l'interface
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qaResponse, setQaResponse] = useState(null);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  
  // Options avancées
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5);
  const [chunksLimit, setChunksLimit] = useState(10);
  const [generateAnswer, setGenerateAnswer] = useState(true);

  // États pour la reconnaissance vocale
  const [voiceError, setVoiceError] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  // États pour la visualisation PDF
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [pdfDocumentId, setPdfDocumentId] = useState(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfDocumentName, setPdfDocumentName] = useState('');

  // Handlers pour la reconnaissance vocale
  const handleVoiceTranscript = (data) => {
    setVoiceTranscript(data.transcript);
    setIsListening(true);
    
    // Si c'est un résultat final, l'ajouter à la question
    if (data.isFinal) {
      setQuestion(prev => {
        const newQuestion = prev + (prev ? ' ' : '') + data.transcript;
        return newQuestion;
      });
      setVoiceTranscript('');
      setIsListening(false);
      
      // Notification de succès
      showVoiceSuccessNotification(data.transcript);
    }
  };

  const handleVoiceError = (errorMessage) => {
    setVoiceError(errorMessage);
    setVoiceTranscript('');
    setIsListening(false);
    
    // Effacer l'erreur après 5 secondes
    setTimeout(() => setVoiceError(''), 5000);
  };

  const showVoiceSuccessNotification = (transcript) => {
    // Créer une notification temporaire
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 transform transition-all duration-300';
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="font-medium">Question ajoutée !</p>
          <p class="text-sm opacity-90">« ${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''} »</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animation d'entrée
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    });
    
    // Supprimer après 3 secondes
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  };

  // Charger les projets au montage du composant
  useEffect(() => {
    loadProjects();
  }, []);

  // Pré-sélectionner le projet depuis l'URL
  useEffect(() => {
    if (projectIdFromUrl && projects.length > 0) {
      const projectFromUrl = projects.find(p => p.id === parseInt(projectIdFromUrl));
      if (projectFromUrl) {
        setSelectedProject(projectFromUrl);
      }
    }
  }, [projectIdFromUrl, projects]);

  // Charger les documents quand le projet change
  useEffect(() => {
    if (selectedProject) {
      loadDocuments();
    } else {
      setDocuments([]);
      setSelectedDocument(null);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const projectsList = await projectService.getProjects();
      setProjects(projectsList);
      
      // Sélectionner le premier projet par défaut seulement si pas de projet depuis l'URL
      if (!projectIdFromUrl && projectsList.length > 0) {
        setSelectedProject(projectsList[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
      setError('Impossible de charger les projets');
    }
  };

  const loadDocuments = async () => {
    if (!selectedProject) return;
    
    try {
      const allDocs = await documentService.getDocuments();
      // Filtrer les documents par projet sélectionné
      const projectDocs = allDocs.filter(doc => doc.project_id === selectedProject.id);
      setDocuments(projectDocs);
      
      // Sélectionner le premier document par défaut
      if (projectDocs.length > 0) {
        setSelectedDocument(projectDocs[0]);
      } else {
        setSelectedDocument(null);
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
                🤖 Assistant Q&A Intelligent avec Reconnaissance Vocale
              </h1>
              <p className="text-gray-600">
                Posez des questions sur vos documents CCTP par écrit ou à l'oral et obtenez des réponses précises avec citations
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

        {/* Sélecteur de projet */}
        {!projectIdFromUrl && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3">🏗️</span>
              Sélectionner un projet
            </h2>
            {projects.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800">
                  Aucun projet disponible. Créez d'abord un projet depuis le dashboard.
                </p>
              </div>
            ) : (
              <div className="max-w-md">
                <select
                  value={selectedProject?.id || ''}
                  onChange={(e) => {
                    const project = projects.find(p => p.id === parseInt(e.target.value));
                    setSelectedProject(project);
                  }}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <option value="">✨ Sélectionner un projet</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      📁 {project.name} ({project.documents_count} doc{project.documents_count > 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
                
                {/* Affichage du projet sélectionné */}
                {selectedProject && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-6 h-6 rounded-full shadow-md ring-2 ring-white"
                        style={{ backgroundColor: selectedProject.color }}
                      ></div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{selectedProject.name}</h3>
                        {selectedProject.description && (
                          <p className="text-sm text-gray-600 mt-1">{selectedProject.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <div className="flex items-center space-x-1 bg-blue-100 px-2 py-1 rounded-full">
                            <span>📄</span>
                            <span className="font-medium text-blue-700">{selectedProject.documents_count} doc{selectedProject.documents_count > 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center space-x-1 bg-purple-100 px-2 py-1 rounded-full">
                            <span>⚡</span>
                            <span className="font-medium text-purple-700">{selectedProject.extractions_count} extraction{selectedProject.extractions_count > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Affichage du projet sélectionné depuis l'URL */}
        {projectIdFromUrl && selectedProject && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-3">🏗️</span>
              Projet sélectionné
            </h2>
            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 rounded-full shadow-md ring-2 ring-white"
                  style={{ backgroundColor: selectedProject.color }}
                ></div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">{selectedProject.name}</h3>
                  {selectedProject.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedProject.description}</p>
                  )}
                  <div className="flex items-center space-x-6 mt-3 text-sm">
                    <div className="flex items-center space-x-1 bg-blue-100 px-3 py-1 rounded-full">
                      <span>📄</span>
                      <span className="font-medium text-blue-700">{selectedProject.documents_count} document{selectedProject.documents_count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center space-x-1 bg-purple-100 px-3 py-1 rounded-full">
                      <span>⚡</span>
                      <span className="font-medium text-purple-700">{selectedProject.extractions_count} extraction{selectedProject.extractions_count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire de question */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {selectedProject ? (
            <form onSubmit={handleSubmitQuestion} className="space-y-4">
              {/* Sélection du document */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  📄 Sélectionner un document à analyser
                </label>
                {documents.length === 0 ? (
                  <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">📁</span>
                    </div>
                    <p className="text-yellow-800 font-medium">Aucun document disponible</p>
                    <p className="text-yellow-600 text-sm mt-1">
                      Uploadez des documents dans ce projet pour commencer l'analyse.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(document => (
                      <div
                        key={document.id}
                        onClick={() => setSelectedDocument(document)}
                        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                          selectedDocument?.id === document.id
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        {/* Icône du type de fichier */}
                        <div className="flex items-center space-x-3 mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            documentService.isPDF(document) 
                              ? 'bg-red-100 text-red-600' 
                              : document.original_filename.toLowerCase().includes('docx')
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {documentService.isPDF(document) ? '📄' : 
                             document.original_filename.toLowerCase().includes('docx') ? '📝' : '📊'}
                          </div>
                          
                          {/* Badge de sélection */}
                          {selectedDocument?.id === document.id && (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Nom du fichier */}
                        <h3 className={`font-medium mb-2 ${
                          selectedDocument?.id === document.id ? 'text-blue-900' : 'text-gray-900'
                        }`}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.4'
                        }}>
                          {document.original_filename}
                        </h3>

                        {/* Informations du document */}
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <span>📅</span>
                            <span>{new Date(document.upload_date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}</span>
                          </div>
                          
                          {document.file_size && (
                            <div className="flex items-center space-x-1">
                              <span>💾</span>
                              <span>{(document.file_size / 1024 / 1024).toFixed(1)} MB</span>
                            </div>
                          )}
                          
                          {/* Statut d'analyse */}
                          <div className="flex items-center space-x-1">
                            <span>⚡</span>
                            <span className="text-green-600 font-medium">Analysé</span>
                          </div>
                        </div>

                        {/* Bouton PDF si applicable */}
                        {documentService.isPDF(document) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedDocument?.id === document.id) {
                                openPDFAtPage(1);
                              } else {
                                setSelectedDocument(document);
                              }
                            }}
                            className={`absolute top-3 right-3 p-2 rounded-lg transition-colors ${
                              selectedDocument?.id === document.id
                                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Visualiser le PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        )}

                        {/* Indicateur de sélection */}
                        {selectedDocument?.id === document.id && (
                          <div className="absolute inset-0 bg-blue-500 bg-opacity-5 pointer-events-none rounded-xl"></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Champ de question avec reconnaissance vocale */}
              <div>
                <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                  Votre question
                  {isListening && (
                    <span className="ml-2 text-sm text-blue-600 font-medium animate-pulse">
                      🎤 En cours d'écoute...
                    </span>
                  )}
                </label>
                
                <div className="relative">
                  <textarea
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ex: Quels sont les matériaux nécessaires pour le gros œuvre ? Ou cliquez sur le micro pour poser votre question à l'oral..."
                    rows={3}
                    className={`w-full p-3 pr-16 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                      validationError ? 'border-red-500' : 'border-gray-300'
                    } ${isListening ? 'ring-2 ring-blue-200 border-blue-400' : ''}`}
                  />
                  
                  {/* Boutons d'action */}
                  <div className="absolute right-3 top-3 flex flex-col space-y-2">
                    {/* Composant de reconnaissance vocale */}
                    <div className="relative">
                      <VoiceRecognition
                        onTranscript={handleVoiceTranscript}
                        onError={handleVoiceError}
                        language="fr-FR"
                        continuous={false}
                        className="relative"
                        disabled={!selectedDocument}
                      />
                    </div>
                    
                    {/* Bouton d'effacement */}
                    {question.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setQuestion('')}
                        className="p-2 rounded-full bg-gray-400 hover:bg-gray-500 text-white transition-colors"
                        title="Effacer la question"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Affichage du transcript en cours */}
                {isListening && voiceTranscript && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md transition-all">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-blue-700">Reconnaissance en cours...</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1 italic">« {voiceTranscript} »</p>
                  </div>
                )}
                
                {/* Erreurs vocales */}
                {voiceError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start space-x-2">
                      <span className="text-red-400 mt-0.5">⚠️</span>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-red-700">Erreur de reconnaissance vocale</span>
                        <div className="text-sm text-red-600 mt-1 whitespace-pre-line">{voiceError}</div>
                        <p className="text-xs text-red-500 mt-2">
                          💡 Astuce: Assurez-vous que votre microphone fonctionne et que vous êtes dans un environnement silencieux.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Guide d'aide et indicateur de caractères sur la même ligne */}
                <div className="flex justify-between items-center mt-1">
                  {/* Guide d'aide pour la reconnaissance vocale */}
                  {selectedDocument ? (
                    <details className="relative">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                        🎤 Aide pour la reconnaissance vocale
                      </summary>
                      <div className="absolute left-0 top-6 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 max-w-md z-10 shadow-lg">
                        <div className="space-y-2">
                          <div>
                            <strong>✅ Prérequis :</strong>
                            <ul className="mt-1 space-y-1 ml-4">
                              <li>• Navigateur supporté : Chrome, Safari, Edge</li>
                              <li>• Connexion HTTPS ou localhost</li>
                              <li>• Permissions microphone autorisées</li>
                            </ul>
                          </div>
                          <div>
                            <strong>🔧 En cas de problème :</strong>
                            <ul className="mt-1 space-y-1 ml-4">
                              <li>• Cliquez sur l'icône 🔒 ou 🎤 dans la barre d'adresse</li>
                              <li>• Autorisez l'accès au microphone</li>
                              <li>• Actualisez la page</li>
                              <li>• Vérifiez qu'aucune autre app n'utilise le micro</li>
                            </ul>
                          </div>
                          <div>
                            <strong>🎯 Conseils d'utilisation :</strong>
                            <ul className="mt-1 space-y-1 ml-4">
                              <li>• Parlez clairement et distinctement</li>
                              <li>• Évitez les bruits de fond</li>
                              <li>• Attendez la fin de l'enregistrement</li>
                              <li>• La transcription s'ajoute automatiquement</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </details>
                  ) : (
                    <div></div>
                  )}

                  {/* Indicateur de caractères */}
                  <span className={`text-sm ${validationError ? 'text-red-500' : 'text-gray-500'}`}>
                    {validationError || `${question.length}/500 caractères`}
                  </span>
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
                  <span className="ml-1">Options avancées (paramètres optimisés)</span>
                </button>

                {showAdvanced && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Seuil de précision: {similarityThreshold}
                        </label>
                        <input
                          type="range"
                          min="0.3"
                          max="0.8"
                          step="0.05"
                          value={similarityThreshold}
                          onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Plus de résultats</span>
                          <span>Plus précis</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Recommandé: 0.5 pour documents CCTP
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Passages analysés: {chunksLimit}
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="20"
                          step="1"
                          value={chunksLimit}
                          onChange={(e) => setChunksLimit(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Rapide</span>
                          <span>Complet</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Recommandé: 10 pour analyse approfondie
                        </p>
                      </div>

                      <div className="flex flex-col justify-center">
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            id="generateAnswer"
                            checked={generateAnswer}
                            onChange={(e) => setGenerateAnswer(e.target.checked)}
                            className="mr-2"
                          />
                          <label htmlFor="generateAnswer" className="text-sm text-gray-700">
                            Réponse intelligente GPT-4o
                          </label>
                        </div>
                        <p className="text-xs text-gray-600">
                          Analyse les passages trouvés et génère une réponse synthétique et précise
                        </p>
                      </div>
                    </div>
                    
                    {/* Boutons de preset */}
                    <div className="border-t pt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Presets optimisés :
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSimilarityThreshold(0.6);
                            setChunksLimit(8);
                            setGenerateAnswer(true);
                          }}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                        >
                          🎯 Précision maximale
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSimilarityThreshold(0.5);
                            setChunksLimit(10);
                            setGenerateAnswer(true);
                          }}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                        >
                          ⚖️ Équilibré (défaut)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSimilarityThreshold(0.4);
                            setChunksLimit(15);
                            setGenerateAnswer(true);
                          }}
                          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                        >
                          🔍 Recherche large
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSimilarityThreshold(0.3);
                            setChunksLimit(20);
                            setGenerateAnswer(false);
                          }}
                          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                        >
                          🚀 Recherche rapide
                        </button>
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
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏗️</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sélectionnez un projet</h3>
              <p className="text-gray-600">
                Choisissez un projet ci-dessus pour accéder à ses documents et poser des questions par écrit ou à l'oral avec le microphone 🎤.
              </p>
            </div>
          )}
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