import { useState, useRef, useEffect } from 'react';
import { documentService, authService, websocketService } from '../utils/api';
import ExtractionProgress from './ExtractionProgress';

const FileUpload = ({ selectedProject, onFileUploaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeExtractions, setActiveExtractions] = useState(new Set());
  const fileInputRef = useRef(null);

  // Types de fichiers acceptés
  const acceptedTypes = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
  };

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  useEffect(() => {
    // Récupérer les informations utilisateur
    const fetchUser = async () => {
      try {
        const user = await authService.getProfile();
        setCurrentUser(user);
      } catch (error) {
        console.error('Erreur récupération utilisateur:', error);
      }
    };

    if (authService.isAuthenticated()) {
      fetchUser();
    }

    // Cleanup WebSocket lors du démontage
    return () => {
      if (currentUser) {
        websocketService.disconnect();
      }
    };
  }, []);

  const validateFile = (file) => {
    const validTypes = Object.keys(acceptedTypes);
    
    if (!validTypes.includes(file.type)) {
      return 'Type de fichier non supporté. Seuls les fichiers PDF, DOCX et XLSX sont autorisés.';
    }
    
    if (file.size > maxFileSize) {
      return 'Le fichier est trop volumineux. Taille maximale : 10MB.';
    }
    
    return null;
  };

  const uploadFile = async (file) => {
    try {
      setIsUploading(true);
      setError('');
      setUploadProgress(0);

      // Préparer les options d'upload
      const uploadOptions = {};
      if (selectedProject) {
        uploadOptions.project_id = selectedProject.id;
      }

      const result = await documentService.uploadFile(file, (progress) => {
        setUploadProgress(progress);
      }, uploadOptions);
      
      const uploadedFile = {
        id: result.id,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        project_id: selectedProject?.id,
        ...result
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);

      // Appeler le callback si fourni
      if (onFileUploaded) {
        onFileUploaded(uploadedFile);
      }

      // Si une extraction DCE a été lancée, l'ajouter aux extractions actives
      if (result.dce_extraction_started) {
        setActiveExtractions(prev => new Set([...prev, result.id]));
      }

      // Maintenir la progression à 100% pendant 2 secondes
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.detail || error.message || 'Erreur lors de l\'upload');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (files) => {
    const file = files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    uploadFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleFileSelect(files);
  };

  const removeFile = (index) => {
    const fileToRemove = uploadedFiles[index];
    if (fileToRemove) {
      setActiveExtractions(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileToRemove.id);
        return newSet;
      });
    }
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtractionComplete = (data) => {
    console.log('Extraction terminée:', data);
    setActiveExtractions(prev => {
      const newSet = new Set(prev);
      newSet.delete(data.document_id);
      return newSet;
    });
  };

  const handleExtractionError = (data) => {
    console.error('Erreur extraction:', data);
    setActiveExtractions(prev => {
      const newSet = new Set(prev);
      newSet.delete(data.document_id);
      return newSet;
    });
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

  const getStatusBadge = (file) => {
    if (file.dce_extraction_started) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <svg className="w-2 h-2 mr-1 animate-spin" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          Extraction IA
        </span>
      );
    }
    
    if (file.text_extracted) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Texte extrait
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Uploadé
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload de Documents</h2>
        {selectedProject ? (
          <div className="flex items-center space-x-3 mb-3">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: selectedProject.color }}
            ></div>
            <p className="text-gray-600">
              Uploading dans le projet : <span className="font-medium text-gray-900">{selectedProject.name}</span>
            </p>
          </div>
        ) : (
          <p className="text-gray-600 mb-3">
            Aucun projet sélectionné - les fichiers seront uploadés sans association de projet
          </p>
        )}
        <p className="text-gray-500 text-sm">
          Glissez-déposez vos fichiers ou cliquez pour sélectionner (PDF, DOCX, XLSX - max 10MB)
        </p>
      </div>

      {/* Extractions en cours */}
      {currentUser && activeExtractions.size > 0 && (
        <div className="mb-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Extractions en cours</h3>
          {Array.from(activeExtractions).map(documentId => (
            <ExtractionProgress
              key={documentId}
              documentId={documentId}
              userId={currentUser.id.toString()}
              onComplete={handleExtractionComplete}
              onError={handleExtractionError}
            />
          ))}
        </div>
      )}

      {/* Zone de drop */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'pointer-events-none' : 'cursor-pointer'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.xlsx"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Upload en cours...</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">{uploadProgress}%</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg className="h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isDragOver ? 'Déposez votre fichier ici' : 'Glissez-déposez votre fichier ici'}
              </p>
              <p className="text-sm text-gray-500">ou cliquez pour parcourir</p>
            </div>
            <div className="flex justify-center space-x-2 text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-100 rounded">PDF</span>
              <span className="px-2 py-1 bg-gray-100 rounded">DOCX</span>
              <span className="px-2 py-1 bg-gray-100 rounded">XLSX</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des fichiers uploadés */}
      {uploadedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fichiers uploadés récemment</h3>
          <div className="space-y-3">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getFileIcon(file.type)}</span>
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{new Date(file.uploadedAt).toLocaleString('fr-FR')}</span>
                    </div>
                    {file.text_preview && (
                      <p className="text-xs text-gray-600 mt-1 max-w-md truncate">
                        {file.text_preview}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getStatusBadge(file)}
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-400 hover:text-red-600 p-1"
                    title="Supprimer de la liste"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 