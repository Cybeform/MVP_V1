import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../utils/api';
import ProjectSelector from '../components/ProjectSelector';

function ProjectDashboard() {
  const [user, setUser] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userProfile = await authService.getProfile();
        setUser(userProfile);
      } catch (error) {
        setError('Erreur lors du chargement des données utilisateur');
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-500 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium text-lg">Chargement de votre tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* En-tête avec animation */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🏗️</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Tableau de bord CYBEFORM
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Gérez vos projets et analysez vos documents DCE avec l'intelligence artificielle
          </p>
        </div>

        {/* Sélecteur de projet avec la nouvelle interface */}
        <div className="mb-8">
          <ProjectSelector 
            selectedProject={selectedProject}
            onProjectChange={setSelectedProject}
            compact={false}
          />
        </div>

        {selectedProject ? (
          <>
            {/* Actions rapides pour le projet sélectionné */}
            <div className="mb-8 bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <div 
                    className="w-6 h-6 rounded-lg mr-4 shadow-md"
                    style={{ backgroundColor: selectedProject.color }}
                  ></div>
                  🚀 Actions rapides
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link
                  to={`/project/${selectedProject.id}/documents`}
                  className="group relative bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xl">📄</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900 group-hover:text-blue-700">Documents</h3>
                      <p className="text-blue-600 text-sm">{selectedProject.documents_count} fichier{selectedProject.documents_count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="mt-4 text-blue-500 group-hover:translate-x-1 transition-transform text-right">
                    Gérer →
                  </div>
                </Link>

                <Link
                  to={`/project/${selectedProject.id}/extractions`}
                  className="group relative bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xl">⚡</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-purple-900 group-hover:text-purple-700">Extractions DCE</h3>
                      <p className="text-purple-600 text-sm">{selectedProject.extractions_count} extraction{selectedProject.extractions_count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="mt-4 text-purple-500 group-hover:translate-x-1 transition-transform text-right">
                    Analyser →
                  </div>
                </Link>

                <Link
                  to={`/qa?project=${selectedProject.id}`}
                  className="group relative bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xl">💬</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900 group-hover:text-green-700">Questions & Réponses</h3>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-green-600 text-sm">Assistant IA</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-green-500 group-hover:translate-x-1 transition-transform text-right">
                    Questionner →
                  </div>
                </Link>
              </div>
            </div>

            {/* Statistiques du projet */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Aperçu du projet */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <div 
                    className="w-6 h-6 rounded-lg mr-4 shadow-md"
                    style={{ backgroundColor: selectedProject.color }}
                  ></div>
                  📊 Aperçu du projet
                </h2>
                
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">📝 Nom</label>
                    <p className="text-xl font-bold text-gray-900">{selectedProject.name}</p>
                  </div>
                  
                  {selectedProject.description && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">📋 Description</label>
                      <p className="text-gray-900">{selectedProject.description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <label className="block text-sm font-semibold text-blue-700 mb-1">📅 Créé le</label>
                      <p className="text-sm text-blue-900">
                        {new Date(selectedProject.created_at).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>

                    {selectedProject.last_activity && (
                      <div className="p-4 bg-green-50 rounded-xl">
                        <label className="block text-sm font-semibold text-green-700 mb-1">🕒 Dernière activité</label>
                        <p className="text-sm text-green-900">
                          {new Date(selectedProject.last_activity).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profil utilisateur */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-4">👤</span>
                  Mon Profil
                </h2>
                {user && (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-green-50 rounded-xl">
                        <label className="block text-sm font-semibold text-green-700 mb-1">📊 Statut</label>
                        <span className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${
                            user.is_active ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      
                      <div className="p-4 bg-blue-50 rounded-xl">
                        <label className="block text-sm font-semibold text-blue-700 mb-1">🎯 Membre depuis</label>
                        <p className="text-sm text-blue-900">
                          {new Date(user.created_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Message si aucun projet sélectionné */
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-8">
              <span className="text-6xl">🏗️</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Sélectionnez un projet</h3>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              Choisissez un projet existant dans la liste ci-dessus ou créez-en un nouveau pour commencer à analyser vos documents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectDashboard; 