import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FormPage1 from './pages/FormPage1';
import FormPage2 from './pages/FormPage2';
import Layout from './components/Layout';
import axios from 'axios';
import './App.css';

// Configurar axios para incluir credenciales
axios.defaults.withCredentials = true;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión al cargar la aplicación
    const checkAuth = async () => {
      try {
        const savedUser = localStorage.getItem('user');
        
        if (savedUser) {
          // Verificar si la sesión del servidor sigue activa
          try {
            const response = await axios.get('http://localhost:5000/api/session');
            if (response.data.authenticated) {
              setUser(response.data.user);
              setIsLoggedIn(true);
            } else {
              localStorage.removeItem('user');
            }
          } catch (error) {
            // Si hay error de conexión, usar datos guardados
            setUser(JSON.parse(savedUser));
            setIsLoggedIn(true);
          }
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:5000/logout');
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      setIsLoggedIn(false);
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando aplicación...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            !isLoggedIn ? 
            <Login onLogin={handleLogin} /> : 
            <Navigate to="/dashboard" replace />
          } 
        />
        <Route 
          path="/*" 
          element={
            isLoggedIn ? (
              <Layout isLoggedIn={isLoggedIn} onLogout={handleLogout} user={user}>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/form1" element={<FormPage1 user={user} />} />
                  <Route path="/form2" element={<FormPage2 user={user} />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;