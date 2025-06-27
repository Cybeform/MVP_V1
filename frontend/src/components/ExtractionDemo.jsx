import { useState, useEffect } from 'react';
import { authService, documentService, extractionService } from '../utils/api';
import ExtractionProgress from './ExtractionProgress';
import useWebSocket from '../hooks/useWebSocket';

const ExtractionDemo = () => {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [message, setMessage] = useState('');

  // WebSocket pour notifications
  const { send } = useWebSocket(
    user?.id?.toString(),
    (data) => {
      console.log('Notification WebSocket:', data);
      if (data.type === 'extraction_progress') {
        setMessage(`Document ${data.document_id} : ${data.progress}% (${data.status})`);
      } else if (data.type === 'extraction_error') {
        setMessage(`Erreur pour document ${data.document_id} : ${data.error}`);
      }
    }
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userProfile = await authService.getProfile();
        setUser(userProfile);
        
        const userDocuments = await documentService.getDocuments();
        setDocuments(userDocuments);
      } catch (error) {
        console.error('Erreur chargement données:', error);
      }
    };

    if (authService.isAuthenticated()) {
      fetchData();
    }
  }, []);

  const startExtraction = async () => {
    if (!selectedDocument) return;

    try {
      setIsExtracting(true);
      setMessage('Lancement de l\'extraction...');
      
      const result = await extractionService.extractDCE(selectedDocument.id);
      setMessage(result.message || 'Extraction lancée');
    } catch (error) {
      setMessage(`Erreur: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const checkStatus = async () => {
    if (!selectedDocument) return;

    try {
      const status = await documentService.getDocumentStatus(selectedDocument.id);
      setMessage(`Statut: ${status.status} - ${status.progress}%`);
    } catch (error) {
      setMessage(`Erreur statut: ${error.message}`);
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Vous devez être connecté pour utiliser cette fonctionnalité.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Test Extraction DCE en Temps Réel</h2>
      
      {/* Sélection de document */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sélectionner un document :
        </label>
        <select
          className="w-full p-2 border border-gray-300 rounded-md"
          value={selectedDocument?.id || ''}
          onChange={(e) => {
            const doc = documents.find(d => d.id === parseInt(e.target.value));
            setSelectedDocument(doc);
          }}
        >
          <option value="">-- Choisir un document --</option>
          {documents.map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.original_filename} ({new Date(doc.upload_date).toLocaleDateString()})
            </option>
          ))}
        </select>
      </div>

      {/* Boutons d'action */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={startExtraction}
          disabled={!selectedDocument || isExtracting}
          className={`px-4 py-2 rounded-md text-white font-medium ${
            !selectedDocument || isExtracting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isExtracting ? 'En cours...' : 'Lancer Extraction'}
        </button>
        
        <button
          onClick={checkStatus}
          disabled={!selectedDocument}
          className={`px-4 py-2 rounded-md border ${
            !selectedDocument
              ? 'border-gray-300 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Vérifier Statut
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800">{message}</p>
        </div>
      )}

      {/* Composant de progression */}
      {selectedDocument && (
        <ExtractionProgress
          documentId={selectedDocument.id}
          userId={user.id.toString()}
          onComplete={(data) => {
            setMessage(`Extraction terminée pour le document ${data.document_id} !`);
          }}
          onError={(data) => {
            setMessage(`Erreur extraction pour le document ${data.document_id}: ${data.error}`);
          }}
        />
      )}

      {/* Informations utilisateur */}
      <div className="mt-8 p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium mb-2">Informations de connexion :</h3>
        <p className="text-sm text-gray-600">Utilisateur ID: {user.id}</p>
        <p className="text-sm text-gray-600">Email: {user.email}</p>
        <p className="text-sm text-gray-600">Documents disponibles: {documents.length}</p>
      </div>
    </div>
  );
};

export default ExtractionDemo; 