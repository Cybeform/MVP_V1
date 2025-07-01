import { useState, useEffect } from 'react';
import { documentService } from '../utils/api';

const DocumentsList = ({ documents: propDocuments, selectedProject, showTitle = true, showRefresh = true }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regeneratingEmbeddings, setRegeneratingEmbeddings] = useState(new Set());

  // Utiliser les documents fournis en props ou charger depuis l'API
  const usingPropsDocuments = propDocuments !== undefined;

  useEffect(() => {
    if (usingPropsDocuments) {
      setDocuments(propDocuments);
      setLoading(false);
    } else {
      fetchDocuments();
    }
  }, [propDocuments, usingPropsDocuments]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentService.getDocuments();
      setDocuments(docs);
    } catch (error) {
      setError('Erreur lors du chargement des documents');
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId, filename) => {
    try {
      const blob = await documentService.downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError('Erreur lors du téléchargement');
      console.error('Download error:', error);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      await documentService.deleteDocument(documentId);
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (error) {
      setError('Erreur lors de la suppression');
      console.error('Delete error:', error);
    }
  };

  const handleRegenerateEmbeddings = async (documentId, filename) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir régénérer les embeddings pour "${filename}" ?\n\nCela peut prendre quelques minutes et améliorera la qualité des réponses Q&A.`)) {
      return;
    }

    try {
      setRegeneratingEmbeddings(prev => new Set([...prev, documentId]));
      
      const result = await documentService.regenerateEmbeddings(documentId);
      
      if (result.success) {
        setError('');
        // Afficher un message de succès temporaire
        const successMessage = `✅ Embeddings régénérés avec succès pour "${filename}"`;
        setError(successMessage);
        setTimeout(() => setError(''), 5000);
      } else {
        setError(`❌ Erreur lors de la régénération: ${result.message}`);
      }
    } catch (error) {
      setError(`Erreur lors de la régénération des embeddings: ${error.response?.data?.detail || error.message}`);
      console.error('Regenerate embeddings error:', error);
    } finally {
      setRegeneratingEmbeddings(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('sheet')) return '📊';
    return '📁';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-600">Chargement des documents...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {showTitle && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {selectedProject ? `Documents - ${selectedProject.name}` : 'Mes Documents'}
          </h2>
          {showRefresh && !usingPropsDocuments && (
            <button
              onClick={fetchDocuments}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Actualiser
            </button>
          )}
        </div>
      )}

      {error && (
        <div className={`mb-6 p-4 border rounded-md ${
          error.startsWith('✅') 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {error.startsWith('✅') ? (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError('')}
                className={`${error.startsWith('✅') ? 'text-green-400 hover:text-green-600' : 'text-red-400 hover:text-red-600'}`}
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun document</h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedProject 
              ? `Ce projet ne contient aucun document.` 
              : 'Commencez par uploader votre premier document.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((document) => (
            <div key={document.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-3xl">
                    {getFileIcon(document.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {document.original_filename}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(document.file_size)} • 
                      Uploadé le {new Date(document.upload_date).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRegenerateEmbeddings(document.id, document.original_filename)}
                    disabled={regeneratingEmbeddings.has(document.id)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Régénérer les embeddings (améliore la qualité Q&A)"
                  >
                    {regeneratingEmbeddings.has(document.id) ? (
                      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleDownload(document.id, document.original_filename)}
                    className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-md transition-colors"
                    title="Télécharger"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(document.id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                    title="Supprimer"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsList; 