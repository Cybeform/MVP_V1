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
    console.log('🔑 Token récupéré:', token ? 'Présent' : 'Absent');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Header Authorization ajouté');
    } else {
      console.log('❌ Pas de token trouvé dans localStorage');
    }
    return config;
  },
  (error) => {
    console.error('❌ Erreur intercepteur request:', error);
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

  // Obtenir un document spécifique par ID
  getDocument: async (documentId) => {
    const response = await api.get(`/documents/${documentId}`);
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

  // Obtenir l'URL de téléchargement d'un document
  getDocumentUrl: (documentId) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/documents/${documentId}/download?token=${token}`;
  },

  // Vérifier si un document est un PDF
  isPDF: (document) => {
    return document.file_type === 'application/pdf' || 
           document.original_filename.toLowerCase().endsWith('.pdf');
  },

  // Supprimer un document
  deleteDocument: async (documentId) => {
    const response = await api.delete(`/documents/${documentId}`);
    return response.data;
  },

  // Régénérer les embeddings d'un document
  regenerateEmbeddings: async (documentId) => {
    const response = await api.post(`/documents/regenerate-embeddings/${documentId}`);
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
  connect: (userId, onMessage) => {
    const ws = new WebSocket(`${WS_BASE_URL}/documents/ws/${userId}`);
    
    ws.onopen = () => {
      console.log('WebSocket connecté');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (onMessage) {
        onMessage(data);
      }
    };
    
    ws.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket fermé');
    };
    
    return ws;
  }
};

// Services Q&A (Question-Answering)
export const qaService = {
  // Poser une question sur un document
  askQuestion: async (documentId, question, options = {}) => {
    const params = new URLSearchParams();
    
    // Paramètres optionnels
    if (options.similarityThreshold !== undefined) {
      params.append('similarity_threshold', options.similarityThreshold);
    }
    if (options.chunksLimit !== undefined) {
      params.append('chunks_limit', options.chunksLimit);
    }
    if (options.model !== undefined) {
      params.append('model', options.model);
    }
    if (options.generateAnswer !== undefined) {
      params.append('generate_answer', options.generateAnswer);
    }

    const url = `/qa/ask${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await api.post(url, {
      document_id: documentId,
      question: question
    });
    
    return response.data;
  },

  // Obtenir un résumé formaté de la réponse
  getQuestionSummary: async (documentId, question) => {
    const response = await api.get(`/qa/summary/${documentId}`, {
      params: { question }
    });
    return response.data;
  },

  // Obtenir la meilleure correspondance pour une question
  getBestMatch: async (documentId, question) => {
    const response = await api.get(`/qa/best-match/${documentId}`, {
      params: { question }
    });
    return response.data;
  },

  // Obtenir les statistiques Q&A de l'utilisateur
  getStats: async () => {
    const response = await api.get('/qa/stats');
    return response.data;
  },

  // Recherche sémantique dans les chunks
  semanticSearch: async (query, options = {}) => {
    const params = new URLSearchParams({
      query: query,
      ...options
    });

    const response = await api.post(`/documents/chunks/search-semantic?${params.toString()}`);
    return response.data;
  },

  // Valider une question (côté client)
  validateQuestion: (question) => {
    const errors = [];
    
    if (!question || !question.trim()) {
      errors.push('La question ne peut pas être vide');
    }
    
    if (question && question.trim().length < 3) {
      errors.push('La question doit contenir au moins 3 caractères');
    }
    
    if (question && question.trim().length > 500) {
      errors.push('La question ne peut pas dépasser 500 caractères');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  // Formater l'affichage de la confiance
  formatConfidence: (confidence) => {
    const confidenceMap = {
      'haute': { label: 'Haute', color: 'green', emoji: '✅' },
      'moyenne': { label: 'Moyenne', color: 'orange', emoji: '⚠️' },
      'faible': { label: 'Faible', color: 'red', emoji: '❌' }
    };
    
    return confidenceMap[confidence] || { label: 'Inconnue', color: 'gray', emoji: '❓' };
  },

  // Exporter une réponse Q&A au format texte
  exportQAToText: (qaResponse) => {
    let content = `Question : ${qaResponse.question}\n`;
    content += `Document : ${qaResponse.document_name}\n`;
    content += `Date : ${new Date().toLocaleDateString('fr-FR')}\n\n`;
    
    if (qaResponse.answer) {
      content += `RÉPONSE :\n${qaResponse.answer}\n\n`;
      content += `Confiance : ${qaResponse.confidence}\n\n`;
    }
    
    if (qaResponse.citations && qaResponse.citations.length > 0) {
      content += `CITATIONS :\n`;
      qaResponse.citations.forEach((citation, index) => {
        content += `${index + 1}. `;
        if (citation.lot) content += `${citation.lot} `;
        if (citation.page) content += `(page ${citation.page}) `;
        content += `:\n   "${citation.excerpt}"\n\n`;
      });
    }
    
    content += `\nStatistiques :\n`;
    content += `- Passages analysés : ${qaResponse.chunks_returned}\n`;
    content += `- Temps de traitement : ${qaResponse.processing_time_ms}ms\n`;
    if (qaResponse.answer_generation_time_ms) {
      content += `- Temps génération réponse : ${qaResponse.answer_generation_time_ms}ms\n`;
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reponse_qa_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
  }
};

// Services pour l'historique Q&A
export const qaHistoryService = {
  // Récupérer l'historique avec pagination
  getHistory: async (params = {}) => {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page);
    if (params.per_page) searchParams.append('per_page', params.per_page);
    if (params.document_id) searchParams.append('document_id', params.document_id);
    if (params.search) searchParams.append('search', params.search);
    
    const url = `/qa/history${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  // Récupérer une entrée spécifique de l'historique
  getHistoryItem: async (historyId) => {
    const response = await api.get(`/qa/history/${historyId}`);
    return response.data;
  },

  // Supprimer une entrée de l'historique
  deleteHistoryItem: async (historyId) => {
    const response = await api.delete(`/qa/history/${historyId}`);
    return response.data;
  },

  // Vider l'historique (tout ou par document)
  clearHistory: async (documentId = null) => {
    const params = documentId ? `?document_id=${documentId}` : '';
    const response = await api.delete(`/qa/history${params}`);
    return response.data;
  },

  // Récupérer les statistiques de l'historique
  getHistoryStats: async () => {
    const response = await api.get('/qa/history/stats');
    return response.data;
  },

  // Formater une date pour l'affichage
  formatDate: (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  },

  // Exporter l'historique au format CSV
  exportHistoryToCSV: (historyData) => {
    const csvHeaders = [
      'Date',
      'Document',
      'Question',
      'Réponse',
      'Confiance',
      'Temps (ms)',
      'Chunks',
      'Cache',
      'Modèle'
    ];

    const csvData = historyData.map(item => [
      new Date(item.created_at).toLocaleDateString('fr-FR'),
      item.document_name || '',
      item.question || '',
      item.answer ? item.answer.substring(0, 100) + '...' : '',
      item.confidence || '',
      item.processing_time_ms || '',
      item.chunks_returned || '',
      item.from_cache ? 'Oui' : 'Non',
      item.embedding_model || ''
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historique_qa_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  },

  // Rechercher dans l'historique
  searchHistory: async (searchTerm, documentId = null) => {
    return await qaHistoryService.getHistory({
      search: searchTerm,
      document_id: documentId,
      per_page: 50
    });
  }
};

export default api; 