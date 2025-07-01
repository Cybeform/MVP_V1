import { useState, useEffect } from 'react';
import { projectService } from '../utils/api';
import ProjectManageModal from './ProjectManageModal';

function ProjectSelector({ selectedProject, onProjectChange, showCreateButton = true, compact = false }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // États pour le modal de gestion
  const [showManageModal, setShowManageModal] = useState(false);
  const [projectToManage, setProjectToManage] = useState(null);

  // Form state pour créer un projet
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectsList = await projectService.getProjects();
      setProjects(projectsList);
      
      // Si aucun projet n'est sélectionné et qu'il y en a, sélectionner le premier
      if (!selectedProject && projectsList.length > 0) {
        onProjectChange(projectsList[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
      setError('Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    
    // Validation
    const validation = projectService.validateProject(formData);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      setCreateLoading(true);
      setError(null);
      
      const newProject = await projectService.createProject(formData);
      
      // Ajouter le nouveau projet à la liste
      const updatedProjects = [...projects, newProject];
      setProjects(updatedProjects);
      
      // Sélectionner le nouveau projet
      onProjectChange(newProject);
      
      // Reset form
      setFormData({ name: '', description: '', color: '#3B82F6' });
      setShowCreateForm(false);
      
    } catch (error) {
      console.error('Erreur lors de la création du projet:', error);
      setError('Erreur lors de la création du projet');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handler pour ouvrir le modal de gestion
  const handleManageProject = (project, e) => {
    e.stopPropagation(); // Empêcher la sélection du projet
    setProjectToManage(project);
    setShowManageModal(true);
  };

  // Handler pour la mise à jour d'un projet
  const handleProjectUpdated = (updatedProject) => {
    setProjects(prevProjects => 
      prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p)
    );
    
    // Mettre à jour le projet sélectionné si c'est celui qui a été modifié
    if (selectedProject?.id === updatedProject.id) {
      onProjectChange(updatedProject);
    }
  };

  // Handler pour la suppression d'un projet
  const handleProjectDeleted = (deletedProjectId) => {
    setProjects(prevProjects => 
      prevProjects.filter(p => p.id !== deletedProjectId)
    );
    
    // Si le projet supprimé était sélectionné, sélectionner le premier disponible
    if (selectedProject?.id === deletedProjectId) {
      const remainingProjects = projects.filter(p => p.id !== deletedProjectId);
      if (remainingProjects.length > 0) {
        onProjectChange(remainingProjects[0]);
      } else {
        onProjectChange(null);
      }
    }
  };

  const colors = projectService.getProjectColors();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement des projets...</p>
        </div>
      </div>
    );
  }

  // Version compacte pour les autres pages
  if (compact) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🏗️ Projet actuel
            </label>
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === parseInt(e.target.value));
                if (project) onProjectChange(project);
              }}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <option value="">✨ Sélectionner un projet</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  📁 {project.name} ({project.documents_count} doc{project.documents_count > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {showCreateButton && (
            <div className="pt-8">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
              >
                ✨ Nouveau
              </button>
            </div>
          )}
        </div>

        {/* Affichage compact du projet sélectionné */}
        {selectedProject && (
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div 
                className="w-6 h-6 rounded-full shadow-md ring-2 ring-white"
                style={{ backgroundColor: selectedProject.color }}
              ></div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">{selectedProject.name}</h3>
                {selectedProject.description && (
                  <p className="text-sm text-gray-600 mt-1">{selectedProject.description}</p>
                )}
                <div className="flex items-center space-x-6 mt-3 text-sm">
                  <div className="flex items-center space-x-1 bg-blue-100 px-3 py-1 rounded-full">
                    <span>📄</span>
                    <span className="font-medium text-blue-700">{selectedProject.documents_count} doc{selectedProject.documents_count > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center space-x-1 bg-purple-100 px-3 py-1 rounded-full">
                    <span>⚡</span>
                    <span className="font-medium text-purple-700">{selectedProject.extractions_count} extraction{selectedProject.extractions_count > 1 ? 's' : ''}</span>
                  </div>
                  {selectedProject.last_activity && (
                    <div className="flex items-center space-x-1 bg-green-100 px-3 py-1 rounded-full">
                      <span>🕒</span>
                      <span className="font-medium text-green-700">{new Date(selectedProject.last_activity).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Bouton de gestion */}
              <button
                onClick={(e) => handleManageProject(selectedProject, e)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                title="Gérer le projet"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Version complète avec cartes visuelles
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg shadow-sm">
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

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <span className="mr-3">🏗️</span>
          Vos Projets
        </h2>
        {showCreateButton && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium flex items-center space-x-2"
          >
            <span>✨</span>
            <span>Créer un projet</span>
          </button>
        )}
      </div>

      {/* Grille des projets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => onProjectChange(project)}
            className={`relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border-2 group overflow-hidden ${
              selectedProject?.id === project.id
                ? 'ring-4 ring-blue-500 ring-opacity-50 border-blue-500 shadow-xl scale-105'
                : 'border-gray-200 hover:border-gray-300 hover:scale-102'
            }`}
          >
            {/* Header coloré */}
            <div 
              className="h-20 relative"
              style={{ 
                background: `linear-gradient(135deg, ${project.color}, ${project.color}dd)` 
              }}
            >
              <div className="absolute inset-0 bg-black bg-opacity-10"></div>
              <div className="absolute top-4 right-4 flex items-center space-x-2">
                {/* Bouton de gestion */}
                <button
                  onClick={(e) => handleManageProject(project, e)}
                  className="bg-white bg-opacity-90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105"
                  title="Gérer le projet"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {selectedProject?.id === project.id && (
                  <div className="bg-white bg-opacity-90 rounded-full p-2 shadow-lg">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Icône projet */}
              <div className="absolute bottom-0 left-6 transform translate-y-1/2">
                <div 
                  className="w-12 h-12 rounded-xl shadow-lg flex items-center justify-center text-white text-xl font-bold ring-4 ring-white"
                  style={{ backgroundColor: project.color }}
                >
                  📁
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div className="p-6 pt-8">
              <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {project.name}
              </h3>
              
              {project.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              {/* Statistiques */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 text-sm">📄</span>
                    </div>
                    <span className="text-sm text-gray-600">Documents</span>
                  </div>
                  <span className="font-bold text-blue-600 text-lg">
                    {project.documents_count}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <span className="text-purple-600 text-sm">⚡</span>
                    </div>
                    <span className="text-sm text-gray-600">Extractions</span>
                  </div>
                  <span className="font-bold text-purple-600 text-lg">
                    {project.extractions_count}
                  </span>
                </div>

                {project.last_activity && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>🕒</span>
                      <span>Dernière activité: {new Date(project.last_activity).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Indicateur de sélection */}
            {selectedProject?.id === project.id && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-5 pointer-events-none"></div>
            )}
          </div>
        ))}

        {/* Carte d'ajout de projet */}
        {showCreateButton && (
          <div
            onClick={() => setShowCreateForm(true)}
            className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-6 hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 cursor-pointer group flex flex-col items-center justify-center text-center min-h-[280px]"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-700 mb-2 group-hover:text-blue-600">
              Nouveau Projet
            </h3>
            <p className="text-sm text-gray-500 group-hover:text-blue-500">
              Créez un nouveau projet pour organiser vos documents
            </p>
          </div>
        )}
      </div>

      {/* Message si aucun projet */}
      {projects.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📁</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun projet trouvé</h3>
          <p className="text-gray-600 mb-6">
            Créez votre premier projet pour commencer à organiser vos documents.
          </p>
          {showCreateButton && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
            >
              ✨ Créer mon premier projet
            </button>
          )}
        </div>
      )}

      {/* Formulaire de création de projet */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-3">✨</span>
                  Nouveau Projet
                </h3>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setError(null);
                    setFormData({ name: '', description: '', color: '#3B82F6' });
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleCreateProject} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    📝 Nom du projet *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Projet Résidentiel 2024"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    📋 Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du projet (optionnel)"
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    🎨 Couleur du projet
                  </label>
                  <div className="grid grid-cols-5 gap-3">
                    {colors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, color: color.value });
                        }}
                        className={`w-12 h-12 rounded-xl border-3 transition-all duration-200 hover:scale-110 ${
                          formData.color === color.value 
                            ? 'border-gray-800 ring-4 ring-gray-300 ring-opacity-50 scale-110' 
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      >
                        {formData.color === color.value && (
                          <svg className="w-6 h-6 text-white mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setError(null);
                      setFormData({ name: '', description: '', color: '#3B82F6' });
                    }}
                    className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center space-x-2"
                  >
                    {createLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Création...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>Créer le projet</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestion des projets */}
      <ProjectManageModal
        isOpen={showManageModal}
        onClose={() => {
          setShowManageModal(false);
          setProjectToManage(null);
        }}
        project={projectToManage}
        onProjectUpdated={handleProjectUpdated}
        onProjectDeleted={handleProjectDeleted}
      />
    </div>
  );
}

export default ProjectSelector; 