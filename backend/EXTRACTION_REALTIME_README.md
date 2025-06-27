# Système d'Extraction DCE en Temps Réel

## Vue d'ensemble

Ce système transforme le traitement d'extraction IA en tâches de fond avec progression temps réel via WebSocket.

## Architecture

### Backend (FastAPI)

#### 1. Modèles de données
- **ExtractionStatus** : Enum pour les statuts (`pending`, `processing`, `completed`, `failed`)
- **Extraction** : Table avec nouveaux champs :
  - `status` : Statut actuel
  - `progress` : Progression (0-100%)
  - `error_message` : Message d'erreur
  - `started_at` / `completed_at` : Horodatage

#### 2. Service d'extraction asynchrone
- **`extract_dce_info_from_text_async()`** : Version asynchrone avec progression
- **`update_extraction_progress()`** : Met à jour statut et notifie WebSocket
- **WebSocketManager** : Gestion des connexions WebSocket utilisateur

#### 3. Endpoints API
- `POST /documents/upload` : Upload avec extraction automatique en arrière-plan
- `GET /documents/{id}/status` : Statut de l'extraction d'un document
- `POST /documents/{id}/extract-dce` : Lancement manuel d'extraction
- `WS /documents/ws/{user_id}` : WebSocket pour notifications temps réel

### Frontend (React)

#### 1. Services API
- **websocketService** : Gestion centralisée des WebSocket
- **documentService.getDocumentStatus()** : Vérification statut
- Support de la reconnexion automatique

#### 2. Composants React
- **ExtractionProgress** : Barre de progression temps réel
- **useWebSocket** : Hook personnalisé pour WebSocket
- **ExtractionDemo** : Composant de test/démo

#### 3. Intégrations
- **FileUpload** : Progression automatique après upload
- **Extractions** : Page avec statuts en temps réel

## Flux de fonctionnement

### 1. Upload de document
```
Utilisateur upload fichier
↓
Backend: Créer document + texte
↓
Backend: Créer extraction (status: pending)
↓
Backend: Lancer tâche asynchrone
↓
Frontend: Afficher progression temps réel
```

### 2. Progression en temps réel
```
Backend: update_extraction_progress()
↓
WebSocket: Envoyer notification
↓
Frontend: Recevoir et afficher progression
↓
Barre de progression + statut mis à jour
```

### 3. Statuts possibles
- **pending** : En attente de traitement
- **processing** : Traitement en cours (0-99%)
- **completed** : Terminé avec succès (100%)
- **failed** : Échec avec message d'erreur

## Messages WebSocket

### Structure des messages
```json
{
  "type": "extraction_progress",
  "extraction_id": 123,
  "document_id": 456,
  "progress": 75,
  "status": "processing"
}
```

### Types de messages
- `extraction_progress` : Mise à jour progression
- `extraction_error` : Erreur durant extraction

## Configuration requise

### Backend
- OpenAI API Key configurée
- Base de données avec nouveaux champs

### Frontend
- WebSocket support dans le navigateur
- Gestion des reconnexions automatiques

## Utilisation

### 1. Upload automatique
- Upload un fichier → Extraction DCE lancée automatiquement
- Progression visible en temps réel

### 2. Extraction manuelle
```javascript
// Lancer extraction
await extractionService.extractDCE(documentId);

// Vérifier statut
const status = await documentService.getDocumentStatus(documentId);
```

### 3. WebSocket
```javascript
// Connexion automatique
websocketService.connect(userId);

// Écouter notifications
websocketService.addListener('key', (data) => {
  console.log('Progression:', data.progress);
});
```

## Avantages

1. **Expérience utilisateur** : Feedback temps réel
2. **Performance** : Traitement asynchrone non-bloquant
3. **Fiabilité** : Gestion d'erreurs et reconnexion
4. **Scalabilité** : Tâches de fond + WebSocket
5. **Monitoring** : Suivi précis des extractions

## Tests

### Composant de démonstration
`ExtractionDemo.jsx` permet de tester :
- Sélection de documents
- Lancement d'extractions
- Vérification de statuts
- Notifications WebSocket

### Points de test
1. Upload document → Extraction automatique
2. Extraction manuelle via interface
3. Reconnexion WebSocket
4. Gestion des erreurs
5. Progression temps réel

## Améliorations futures

1. **Celery** : Remplacer BackgroundTasks pour plus de robustesse
2. **Redis** : Cache pour statuts d'extraction
3. **Retry logic** : Relance automatique en cas d'échec
4. **Métriques** : Suivi des performances d'extraction
5. **Notifications** : Email/SMS pour extractions terminées 