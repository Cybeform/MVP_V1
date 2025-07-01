import React, { useState, useEffect, useRef } from 'react';

const VoiceRecognition = ({ 
  onTranscript, 
  onError, 
  language = 'fr-FR',
  continuous = false,
  className = "",
  disabled = false 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    initializeSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, continuous]);

  // Test automatique au montage
  useEffect(() => {
    if (isSupported) {
      runDiagnostic();
    }
  }, [isSupported]);

  const runDiagnostic = async () => {
    // Vérifier la compatibilité du navigateur
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      const errorMsg = 'La reconnaissance vocale n\'est pas supportée par votre navigateur. Essayez Chrome ou Safari.';
      setError(errorMsg);
      onError && onError(errorMsg);
      return;
    }

    setIsSupported(true);
    
    const diagnostics = {
      speechRecognition: !!SpeechRecognition,
      https: location.protocol === 'https:' || location.hostname === 'localhost',
      microphone: null,
      browser: navigator.userAgent
    };

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        diagnostics.microphone = permission.state;
      } else {
        diagnostics.microphone = 'unknown';
      }
    } catch (error) {
      diagnostics.microphone = 'error';
    }

    console.log('🔍 Diagnostic reconnaissance vocale:', diagnostics);
    return diagnostics;
  };

  const initializeSpeechRecognition = () => {
    // Vérifier la compatibilité du navigateur
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      const errorMsg = 'La reconnaissance vocale n\'est pas supportée par votre navigateur. Essayez Chrome ou Safari.';
      setError(errorMsg);
      onError && onError(errorMsg);
      return;
    }

    setIsSupported(true);

    // Créer l'instance de reconnaissance vocale
    const recognition = new SpeechRecognition();
    
    // Configuration de la reconnaissance vocale
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    // Événements de la reconnaissance vocale
    recognition.onstart = () => {
      setIsListening(true);
      setError('');
      setTranscript('');
      console.log('🎤 Reconnaissance vocale démarrée');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript + interimTranscript;
      setTranscript(currentTranscript);

      // Appeler le callback avec le transcript
      if (onTranscript) {
        onTranscript({
          transcript: currentTranscript,
          isFinal: !!finalTranscript,
          confidence: event.results[event.results.length - 1]?.[0]?.confidence || 0
        });
      }

      console.log('🎤 Transcript:', { final: finalTranscript, interim: interimTranscript });
    };

    recognition.onend = () => {
      setIsListening(false);
      setTranscript('');
      console.log('🎤 Reconnaissance vocale terminée');
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setTranscript('');
      
      let errorMessage = 'Erreur de reconnaissance vocale';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'Aucune parole détectée. Parlez plus fort ou rapprochez-vous du microphone.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone non accessible. Vérifiez les permissions et qu\'aucune autre application n\'utilise le microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Permission microphone refusée. Cliquez sur l\'icône du microphone dans la barre d\'adresse pour autoriser l\'accès.';
          break;
        case 'network':
          errorMessage = 'Erreur réseau. Vérifiez votre connexion internet.';
          break;
        case 'language-not-supported':
          errorMessage = `Langue "${language}" non supportée.`;
          break;
        case 'service-not-allowed':
          errorMessage = 'Service de reconnaissance vocale non autorisé. Solutions possibles :\n• Autorisez le microphone en cliquant sur l\'icône 🔒 ou 🎤 dans la barre d\'adresse\n• Vérifiez que vous utilisez HTTPS (pas HTTP)\n• Essayez un autre navigateur (Chrome, Safari, Edge)\n• Redémarrez votre navigateur et réessayez';
          break;
        default:
          errorMessage = `Erreur inconnue: ${event.error}`;
      }
      
      setError(errorMessage);
      onError && onError(errorMessage);
      console.error('🎤 Erreur reconnaissance vocale:', event.error);
    };

    recognitionRef.current = recognition;
  };

  const startListening = async () => {
    if (!isSupported || !recognitionRef.current || disabled) {
      const errorMsg = disabled ? 'Reconnaissance vocale désactivée' : 'Reconnaissance vocale non disponible';
      setError(errorMsg);
      onError && onError(errorMsg);
      return;
    }

    // Vérifier les permissions du microphone avant de démarrer
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        
        if (permission.state === 'denied') {
          const errorMsg = 'Permission microphone refusée. Cliquez sur l\'icône 🔒 ou 🎤 dans la barre d\'adresse pour autoriser l\'accès au microphone.';
          setError(errorMsg);
          onError && onError(errorMsg);
          return;
        }
      }
    } catch (permissionError) {
      console.log('Impossible de vérifier les permissions:', permissionError);
    }

    // Vérifier que le site est servi en HTTPS (requis pour la reconnaissance vocale)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      const errorMsg = 'La reconnaissance vocale nécessite une connexion HTTPS sécurisée. Utilisez https:// au lieu de http://.';
      setError(errorMsg);
      onError && onError(errorMsg);
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Erreur démarrage reconnaissance vocale:', error);
      let errorMsg = 'Impossible de démarrer la reconnaissance vocale';
      
      if (error.name === 'InvalidStateError') {
        errorMsg = 'La reconnaissance vocale est déjà en cours. Attendez quelques secondes et réessayez.';
      } else if (error.name === 'NotAllowedError') {
        errorMsg = 'Permission microphone refusée. Autorisez l\'accès au microphone dans les paramètres de votre navigateur.';
      }
      
      setError(errorMsg);
      onError && onError(errorMsg);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const toggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className={`voice-recognition ${className}`}>
      {/* Bouton principal de reconnaissance vocale */}
      <button
        type="button"
        onClick={toggle}
        disabled={!isSupported || disabled}
        className={`
          p-2 rounded-full transition-all duration-200 
          ${!isSupported || disabled 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : isListening 
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg' 
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
          }
        `}
        title={
          !isSupported 
            ? 'Reconnaissance vocale non supportée' 
            : disabled
              ? 'Reconnaissance vocale désactivée'
              : isListening 
                ? 'Arrêter l\'enregistrement' 
                : 'Démarrer la reconnaissance vocale'
        }
      >
        {isListening ? (
          // Icône d'arrêt avec animation
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a2 2 0 114 0v4a2 2 0 11-4 0V7z" clipRule="evenodd" />
          </svg>
        ) : (
          // Icône de microphone
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Indicateur de statut */}
      {isListening && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-red-500 rounded-full animate-bounce"></div>
            <div className="w-1 h-1 bg-red-500 rounded-full animate-bounce delay-75"></div>
            <div className="w-1 h-1 bg-red-500 rounded-full animate-bounce delay-150"></div>
          </div>
        </div>
      )}

      {/* Aide contextuelle pour les erreurs */}
      {!isSupported && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 p-3 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg z-10">
          <div className="text-xs text-yellow-800">
            <div className="font-medium mb-1">🚨 Reconnaissance vocale non supportée</div>
            <div>Votre navigateur ne supporte pas la reconnaissance vocale. Essayez :</div>
            <ul className="mt-1 space-y-1">
              <li>• Chrome (recommandé)</li>
              <li>• Safari</li>
              <li>• Edge</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecognition; 