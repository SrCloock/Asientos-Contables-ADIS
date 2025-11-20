// context/AuthContext.js - VERSIÓN MEJORADA
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import config from '../config/config';

export const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar sesión al cargar
  useEffect(() => {
    checkSession();
  }, []);

  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 Intentando login en:', config.apiBaseUrl);

      const response = await axios.post(
        `${config.apiBaseUrl}/login`,
        { username, password },
        { 
          withCredentials: true,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📨 Respuesta del login:', response.data);

      if (response.data.success) {
        setUser(response.data.user);
        setIsLoggedIn(true);
        setError(null);
        console.log('✅ Login exitoso para usuario:', username);
        return true;
      } else {
        setError(response.data.message || 'Error en credenciales');
        return false;
      }
    } catch (error) {
      console.error('❌ Error completo en login:', error);
      
      let errorMessage = 'Error de conexión con el servidor';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout: El servidor no responde';
      } else if (error.response) {
        // El servidor respondió con un código de error
        if (error.response.status === 401) {
          errorMessage = 'Usuario o contraseña incorrectos';
        } else if (error.response.status === 500) {
          errorMessage = 'Error interno del servidor';
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.request) {
        // La petición fue hecha pero no se recibió respuesta
        errorMessage = 'No se pudo conectar con el servidor. Verifique la conexión.';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${config.apiBaseUrl}/logout`, {}, { 
        withCredentials: true,
        timeout: 10000
      });
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      setUser(null);
      setIsLoggedIn(false);
      setError(null);
      localStorage.removeItem('rememberedUsername');
    }
  };

  const checkSession = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${config.apiBaseUrl}/api/session`, {
        withCredentials: true,
        timeout: 15000
      });
      
      console.log('🔍 Verificación de sesión:', response.data);
      
      if (response.data.authenticated) {
        setUser(response.data.user);
        setIsLoggedIn(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error verificando sesión:', error);
      setError('No se pudo verificar la sesión con el servidor');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    isLoggedIn,
    loading,
    error,
    login,
    logout,
    checkSession,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};