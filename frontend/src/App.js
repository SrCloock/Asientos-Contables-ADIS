import React, { useEffect } from 'react'; // Añade useEffect aquí
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import FormPage1 from './pages/FormPage1';
import FormPage2 from './pages/FormPage2';
import Login from './pages/Login';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading, checkSession } = useAuth();

  // Revisamos la sesión cuando el ProtectedRoute se monta
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '2rem' }}>⏳</div>
        <p>Verificando autenticación...</p>
      </div>
    );
  }

  return isLoggedIn ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="form1" element={<FormPage1 />} />
            <Route path="form2" element={<FormPage2 />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;