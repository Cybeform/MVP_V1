import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { documentService } from '../utils/api';

// Configuration du worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({ documentId, initialPage = 1, onClose, documentName }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1.2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const viewerRef = useRef(null);

  useEffect(() => {
    loadPDF();
  }, [documentId]);

  useEffect(() => {
    // Naviguer à la page initiale quand elle change
    if (initialPage && initialPage !== currentPage) {
      setCurrentPage(initialPage);
      scrollToCurrentPage();
    }
  }, [initialPage]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Créer une URL pour le PDF via l'API
      const token = localStorage.getItem('token');
      const url = `http://localhost:8000/documents/${documentId}/download`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement du PDF');
      }
      
      const blob = await response.blob();
      const pdfUrl = URL.createObjectURL(blob);
      setPdfUrl(pdfUrl);
      
    } catch (error) {
      console.error('Erreur chargement PDF:', error);
      setError('Impossible de charger le document PDF');
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error) => {
    console.error('Erreur PDF.js:', error);
    setError('Erreur lors du chargement du PDF');
    setLoading(false);
  };

  const scrollToCurrentPage = () => {
    // Scroll automatique vers la page courante
    setTimeout(() => {
      const pageElement = document.querySelector(`[data-page-number="${currentPage}"]`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
      scrollToCurrentPage();
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      viewerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.2);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700">Chargement du PDF...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4">
          <div className="text-center">
            <span className="text-red-500 text-4xl mb-4 block">❌</span>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Barre d'outils */}
      <div className="bg-white border-b shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 p-1 rounded"
            title="Fermer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="text-sm text-gray-700">
            <span className="font-medium">{documentName}</span>
            {numPages && (
              <span className="ml-2 text-gray-500">
                ({numPages} page{numPages > 1 ? 's' : ''})
              </span>
            )}
          </div>
        </div>

        {/* Navigation et contrôles */}
        <div className="flex items-center space-x-4">
          {/* Navigation par page */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 rounded text-gray-600 hover:text-gray-800 disabled:opacity-50"
              title="Page précédente"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value))}
                min="1"
                max={numPages}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
              />
              <span className="text-sm text-gray-600">/ {numPages}</span>
            </div>
            
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1 rounded text-gray-600 hover:text-gray-800 disabled:opacity-50"
              title="Page suivante"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Contrôles de zoom */}
          <div className="flex items-center space-x-2 border-l pl-4">
            <button
              onClick={zoomOut}
              className="p-1 rounded text-gray-600 hover:text-gray-800"
              title="Zoom arrière"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <span className="text-sm text-gray-600 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            
            <button
              onClick={zoomIn}
              className="p-1 rounded text-gray-600 hover:text-gray-800"
              title="Zoom avant"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            <button
              onClick={resetZoom}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              title="Zoom par défaut"
            >
              Reset
            </button>
          </div>

          {/* Plein écran */}
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded text-gray-600 hover:text-gray-800 border-l pl-4"
            title="Plein écran"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Visionneuse PDF */}
      <div 
        ref={viewerRef}
        className="flex-1 overflow-auto bg-gray-100 p-4"
      >
        <div className="max-w-4xl mx-auto">
          {pdfUrl && (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              className="pdf-document"
            >
              {/* Afficher toutes les pages */}
              {Array.from(new Array(numPages), (el, index) => (
                <div
                  key={`page_${index + 1}`}
                  className={`mb-4 shadow-lg bg-white ${
                    currentPage === index + 1 ? 'ring-2 ring-blue-500' : ''
                  }`}
                  data-page-number={index + 1}
                >
                  <Page
                    pageNumber={index + 1}
                    scale={scale}
                    className="mx-auto"
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  
                  {/* Numéro de page */}
                  <div className="text-center py-2 text-sm text-gray-500 bg-gray-50">
                    Page {index + 1} / {numPages}
                  </div>
                </div>
              ))}
            </Document>
          )}
        </div>
      </div>

      {/* Indicateur de page courante */}
      {currentPage && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm shadow-lg">
          Page {currentPage}
        </div>
      )}
    </div>
  );
};

export default PDFViewer; 