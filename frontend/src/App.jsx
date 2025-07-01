import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './utils/api';

// Components
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ProjectDashboard from './pages/ProjectDashboard';
import Upload from './pages/Upload';
import Extractions from './pages/Extractions';
import QAInterface from './components/QAInterface';
import QAHistory from './components/QAHistory';

// Pages spécifiques aux projets
import ProjectDocuments from './pages/ProjectDocuments';
import ProjectExtractions from './pages/ProjectExtractions';
import ProjectQA from './pages/ProjectQA';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const userProfile = await authService.getProfile();
          setUser(userProfile);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        authService.logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navbar user={user} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/login" 
            element={
              authService.isAuthenticated() ? 
              <Navigate to="/dashboard" replace /> : 
              <Login />
            } 
          />
          <Route 
            path="/register" 
            element={
              authService.isAuthenticated() ? 
              <Navigate to="/dashboard" replace /> : 
              <Register />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <ProjectDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes spécifiques aux projets */}
          <Route 
            path="/project/:projectId/documents" 
            element={
              <ProtectedRoute>
                <ProjectDocuments />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/project/:projectId/extractions" 
            element={
              <ProtectedRoute>
                <ProjectExtractions />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/project/:projectId/qa" 
            element={
              <ProtectedRoute>
                <ProjectQA />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes générales */}
          <Route 
            path="/upload" 
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/extractions" 
            element={
              <ProtectedRoute>
                <Extractions />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/qa" 
            element={
              <ProtectedRoute>
                <QAInterface />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/qa/history" 
            element={
              <ProtectedRoute>
                <QAHistory />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 