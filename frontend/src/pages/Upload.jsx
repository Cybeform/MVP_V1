import { useState } from 'react';
import FileUpload from '../components/FileUpload';
import DocumentsList from '../components/DocumentsList';

function Upload() {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Documents</h1>
          <p className="mt-2 text-gray-600">
            Uploadez et gérez vos documents PDF, Word et Excel en toute sécurité.
          </p>
        </div>
        
        {/* Onglets */}
        <div className="mb-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('upload')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload de fichiers
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mes documents
            </button>
          </nav>
        </div>

        {/* Contenu des onglets */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'upload' && <FileUpload />}
          {activeTab === 'documents' && <DocumentsList />}
        </div>
      </div>
    </div>
  );
}

export default Upload; 