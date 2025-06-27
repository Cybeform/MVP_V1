import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

// Configuration d'axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs d'authentification
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Services d'authentification
export const authService = {
  // Inscription
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Connexion
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    return response.data;
  },

  // Déconnexion
  logout: () => {
    localStorage.removeItem('token');
  },

  // Obtenir le profil utilisateur
  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Vérifier si l'utilisateur est connecté
  isAuthenticated: () => {
    return localStorage.getItem('token') !== null;
  },
};

// Services utilisateurs
export const userService = {
  // Obtenir la liste des utilisateurs
  getUsers: async () => {
    const response = await api.get('/users/');
    return response.data;
  },
};

// Services documents
export const documentService = {
  // Upload de fichier avec progression
  uploadFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  },

  // Obtenir la liste des documents
  getDocuments: async () => {
    const response = await api.get('/documents/');
    return response.data;
  },

  // Obtenir le statut d'extraction d'un document
  getDocumentStatus: async (documentId) => {
    const response = await api.get(`/documents/${documentId}/status`);
    return response.data;
  },

  // Télécharger un document
  downloadDocument: async (documentId) => {
    const response = await api.get(`/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Supprimer un document
  deleteDocument: async (documentId) => {
    const response = await api.delete(`/documents/${documentId}`);
    return response.data;
  },
};

// Services extractions DCE
export const extractionService = {
  // Obtenir toutes les extractions de l'utilisateur
  getExtractions: async () => {
    const response = await api.get('/documents/extractions/');
    return response.data;
  },

  // Obtenir l'extraction d'un document spécifique
  getDocumentExtraction: async (documentId) => {
    const response = await api.get(`/documents/${documentId}/extraction`);
    return response.data;
  },

  // Lancer une extraction manuelle
  extractDCE: async (documentId) => {
    const response = await api.post(`/documents/${documentId}/extract-dce`);
    return response.data;
  },

  // Exporter les extractions au format CSV
  exportToCSV: (extractions) => {
    const csvHeaders = [
      'Lot',
      'Sous-lot',
      'Matériaux',
      'Équipements',
      'Méthodes d\'exécution',
      'Critères de performance',
      'Localisation',
      'Quantitatifs',
      'Score de confiance',
      'Date de création'
    ];

    const csvData = extractions.map(extraction => [
      extraction.lot || '',
      extraction.sous_lot || '',
      extraction.materiaux?.join('; ') || '',
      extraction.equipements?.join('; ') || '',
      extraction.methodes_exec?.join('; ') || '',
      extraction.criteres_perf?.join('; ') || '',
      extraction.localisation || '',
      extraction.quantitatifs?.map(q => `${q.label}: ${q.qty} ${q.unite}`).join('; ') || '',
      extraction.confidence_score || '',
      new Date(extraction.created_at).toLocaleDateString('fr-FR')
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extractions_dce_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  },

  // Exporter une extraction spécifique au format CSV
  exportExtractionToCSV: (extraction) => {
    // CSV pour les quantitatifs
    if (extraction.quantitatifs && extraction.quantitatifs.length > 0) {
      const csvHeaders = ['Label', 'Quantité', 'Unité'];
      const csvData = extraction.quantitatifs.map(q => [
        q.label,
        q.qty,
        q.unite
      ]);

      const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `quantitatifs_${extraction.lot || 'extraction'}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    }
  }
};

// Service WebSocket pour les notifications temps réel
export const websocketService = {
  connection: null,
  listeners: new Map(),

  // Connecter au WebSocket
  connect: (userId) => {
    if (websocketService.connection?.readyState === WebSocket.OPEN) {
      return websocketService.connection;
    }

    const wsUrl = `${WS_BASE_URL}/documents/ws/${userId}`;
    websocketService.connection = new WebSocket(wsUrl);

    websocketService.connection.onopen = () => {
      console.log('WebSocket connecté');
    };

    websocketService.connection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Message WebSocket reçu:', data);
        
        // Notifier tous les listeners
        websocketService.listeners.forEach((callback, key) => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Erreur dans le listener ${key}:`, error);
          }
        });
      } catch (error) {
        console.error('Erreur parsing message WebSocket:', error);
      }
    };

    websocketService.connection.onclose = () => {
      console.log('WebSocket fermé');
      websocketService.connection = null;
      
      // Tentative de reconnexion après 3 secondes
      setTimeout(() => {
        if (websocketService.listeners.size > 0) {
          websocketService.connect(userId);
        }
      }, 3000);
    };

    websocketService.connection.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
    };

    return websocketService.connection;
  },

  // Ajouter un listener
  addListener: (key, callback) => {
    websocketService.listeners.set(key, callback);
  },

  // Supprimer un listener
  removeListener: (key) => {
    websocketService.listeners.delete(key);
  },

  // Fermer la connexion
  disconnect: () => {
    if (websocketService.connection) {
      websocketService.connection.close();
      websocketService.connection = null;
    }
    websocketService.listeners.clear();
  },

  // Envoyer un message
  send: (message) => {
    if (websocketService.connection?.readyState === WebSocket.OPEN) {
      websocketService.connection.send(JSON.stringify(message));
    }
  }
};

export default api; 