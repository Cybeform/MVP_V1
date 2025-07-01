import { useState } from 'react';
import FileUpload from '../components/FileUpload';
import DocumentsList from '../components/DocumentsList';
import ProjectSelector from '../components/ProjectSelector';

function Upload() {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <span className="text-2xl">📄</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Gestion des Documents</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Uploadez et gérez vos documents PDF, Word et Excel en toute sécurité dans vos projets.
          </p>
        </div>

        {/* Sélecteur de projet compact */}
        <div className="mb-8 bg-white rounded-2xl shadow-lg p-6">
          <ProjectSelector 
            selectedProject={selectedProject}
            onProjectChange={setSelectedProject}
            compact={true}
            showCreateButton={true}
          />
        </div>
        
        {/* Onglets */}
        <div className="mb-8">
          <nav className="flex space-x-8 bg-white rounded-xl p-2 shadow-md" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-3 px-6 font-semibold text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              📤 Upload de fichiers
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 py-3 px-6 font-semibold text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'documents'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              📋 Mes documents
            </button>
          </nav>
        </div>

        {/* Message si aucun projet sélectionné */}
        {!selectedProject ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Sélectionnez un projet</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Veuillez d'abord sélectionner un projet dans lequel vous souhaitez gérer vos documents.
            </p>
          </div>
        ) : (
          /* Contenu des onglets */
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {activeTab === 'upload' && (
              <div className="p-8">
                <div className="mb-6 flex items-center space-x-3">
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: selectedProject.color }}
                  ></div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Upload dans le projet : {selectedProject.name}
                  </h2>
                </div>
                <FileUpload selectedProject={selectedProject} />
              </div>
            )}
            {activeTab === 'documents' && (
              <div className="p-8">
                <div className="mb-6 flex items-center space-x-3">
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: selectedProject.color }}
                  ></div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Documents du projet : {selectedProject.name}
                  </h2>
                </div>
                <DocumentsList selectedProject={selectedProject} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Upload; 