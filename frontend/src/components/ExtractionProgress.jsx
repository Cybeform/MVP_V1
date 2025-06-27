import { useState, useEffect } from 'react';
import { documentService, websocketService } from '../utils/api';

const ExtractionProgress = ({ documentId, userId, onComplete, onError }) => {
  const [status, setStatus] = useState({
    status: 'pending',
    progress: 0,
    error_message: null
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fonction pour gérer les messages WebSocket
    const handleWebSocketMessage = (data) => {
      if (data.document_id === documentId) {
        setStatus({
          status: data.status,
          progress: data.progress,
          error_message: data.error || null
        });

        if (data.status === 'completed') {
          setIsVisible(false);
          if (onComplete) {
            onComplete(data);
          }
        } else if (data.status === 'failed') {
          if (onError) {
            onError(data);
          }
        }
      }
    };

    // Connexion WebSocket
    if (userId && documentId) {
      websocketService.connect(userId);
      websocketService.addListener(`extraction-${documentId}`, handleWebSocketMessage);
      setIsVisible(true);

      // Récupération du statut initial
      const fetchInitialStatus = async () => {
        try {
          const statusData = await documentService.getDocumentStatus(documentId);
          setStatus({
            status: statusData.status,
            progress: statusData.progress,
            error_message: statusData.error_message
          });

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            setIsVisible(false);
          }
        } catch (error) {
          console.error('Erreur récupération statut:', error);
        }
      };

      fetchInitialStatus();
    }

    // Cleanup
    return () => {
      if (documentId) {
        websocketService.removeListener(`extraction-${documentId}`);
      }
    };
  }, [documentId, userId, onComplete, onError]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'processing':
        return 'Traitement en cours';
      case 'completed':
        return 'Terminé';
      case 'failed':
        return 'Échec';
      default:
        return 'Inconnu';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (!isVisible || status.status === 'no_extraction') {
    return null;
  }

  return (
    <div className={`border rounded-lg p-4 mb-4 ${getStatusColor(status.status)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon(status.status)}
          <span className="font-medium">Extraction DCE - {getStatusText(status.status)}</span>
        </div>
        <div className="text-sm font-medium">
          {status.progress}%
        </div>
      </div>

      {/* Barre de progression */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            status.status === 'failed' ? 'bg-red-500' :
            status.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${status.progress}%` }}
        />
      </div>

      {/* Message d'erreur */}
      {status.error_message && (
        <div className="text-sm text-red-600 mt-2">
          <strong>Erreur:</strong> {status.error_message}
        </div>
      )}

      {/* Messages d'état */}
      <div className="text-sm">
        {status.status === 'pending' && 'L\'extraction va démarrer prochainement...'}
        {status.status === 'processing' && 'Analyse du document en cours avec l\'IA...'}
        {status.status === 'completed' && 'Extraction terminée avec succès !'}
        {status.status === 'failed' && 'L\'extraction a échoué. Veuillez réessayer.'}
      </div>
    </div>
  );
};

export default ExtractionProgress; 