# Frontend React - Interface d'Authentification

Interface utilisateur moderne construite avec React et Vite pour l'authentification utilisateur.

## Technologies utilisées

- **React 18** - Bibliothèque JavaScript pour l'interface utilisateur
- **Vite** - Outil de build rapide
- **React Router** - Navigation côté client
- **Tailwind CSS** - Framework CSS utilitaire
- **Axios** - Client HTTP pour les requêtes API

## Installation

1. Installer les dépendances :
```bash
npm install
```

## Démarrage

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## Scripts disponibles

- `npm run dev` - Démarre le serveur de développement
- `npm run build` - Construit l'application pour la production
- `npm run preview` - Prévisualise la build de production
- `npm run lint` - Lance l'analyse du code

## Structure du projet

```
src/
├── components/
│   ├── Navbar.jsx          # Barre de navigation
│   └── ProtectedRoute.jsx  # Composant de protection des routes
├── pages/
│   ├── Home.jsx            # Page d'accueil
│   ├── Login.jsx           # Page de connexion
│   ├── Register.jsx        # Page d'inscription
│   └── Dashboard.jsx       # Tableau de bord (protégé)
├── utils/
│   └── api.js              # Services API et configuration Axios
├── App.jsx                 # Composant principal
├── main.jsx                # Point d'entrée
└── index.css               # Styles Tailwind
```

## Fonctionnalités

### Pages publiques
- **Accueil** - Page de présentation avec call-to-action
- **Connexion** - Formulaire de connexion avec validation
- **Inscription** - Formulaire d'inscription avec validation

### Pages protégées
- **Dashboard** - Profil utilisateur et liste des utilisateurs

### Fonctionnalités d'authentification
- Inscription avec validation côté client
- Connexion avec gestion des erreurs
- Déconnexion automatique
- Protection des routes
- Persistance de la session
- Redirection automatique

## Configuration

### Variables d'environnement

Créez un fichier `.env.local` dans le répertoire frontend :

```env
VITE_API_URL=http://localhost:8000
```

### Tailwind CSS

La configuration Tailwind est dans `tailwind.config.js` avec des couleurs personnalisées pour le thème.

## Services API

Le fichier `src/utils/api.js` contient :

- Configuration Axios avec intercepteurs
- Gestion automatique des tokens JWT
- Services d'authentification
- Services utilisateurs
- Gestion des erreurs 401 (déconnexion automatique)

## Gestion d'état

L'état de l'authentification est géré au niveau du composant `App` et transmis aux composants enfants via les props.

## Sécurité

- Validation côté client des formulaires
- Protection des routes sensibles
- Stockage sécurisé des tokens JWT dans localStorage
- Gestion automatique de l'expiration des tokens

## Design

Interface moderne et responsive avec :
- Design système basé sur Tailwind CSS
- Composants réutilisables
- Animations et transitions fluides
- Palette de couleurs cohérente
- Responsive design (mobile-first)

## Build et déploiement

```bash
# Construire pour la production
npm run build

# Prévisualiser la build
npm run preview
```

Les fichiers de production seront dans le dossier `dist/`. 