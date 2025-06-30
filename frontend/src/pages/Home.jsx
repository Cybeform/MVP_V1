import { Link } from 'react-router-dom';
import { authService } from '../utils/api';

function Home() {
  const isAuthenticated = authService.isAuthenticated();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Bienvenue sur
            <span className="text-primary-600"> CYBEFORM</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Plateforme d'analyse intelligente de documents DCE. 
            Extraction automatique, analyse IA et gestion sécurisée.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors shadow-lg"
                >
                  Aller au Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors shadow-lg"
                >
                  Créer un compte
                </Link>
                <Link
                  to="/login"
                  className="bg-white hover:bg-gray-50 text-primary-600 px-8 py-3 rounded-lg text-lg font-medium transition-colors border-2 border-primary-600"
                >
                  Se connecter
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">Intelligence Artificielle</h3>
            <p className="text-gray-600">
              Extraction DCE automatique avec OpenAI GPT-4o
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Analyse Avancée</h3>
            <p className="text-gray-600">
              Matériaux, quantitatifs, méthodes d'exécution détectés automatiquement
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold mb-2">Temps Réel</h3>
            <p className="text-gray-600">
              Progression WebSocket et interface moderne avec Tailwind CSS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home; 