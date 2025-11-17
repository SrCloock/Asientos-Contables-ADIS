// context/AuthContext.js
import React, { createContext, useState, useContext } from 'react';
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

  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔐 Intentando login desde: ${config.apiBaseUrl}`);

      const response = await axios.post(
        `${config.apiBaseUrl}/login`,
        { username, password },
        { 
          withCredentials: true,
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setUser(response.data.user);
        setIsLoggedIn(true);
        setError(null);
        console.log('✅ Login exitoso para usuario:', username);
        return true;
      } else {
        setError(response.data.message || 'Credenciales incorrectas');
        return false;
      }
    } catch (error) {
      console.error('❌ Error completo en login:', error);
      
      let errorMessage = 'Error de conexión con el servidor';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout: El servidor no respondió a tiempo';
      } else if (error.response?.status === 401) {
        errorMessage = 'Usuario o contraseña incorrectos';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('🔒 Cerrando sesión...');
      
      await axios.post(`${config.apiBaseUrl}/logout`, {}, { 
        withCredentials: true,
        timeout: 10000
      });
      
      console.log('✅ Sesión cerrada correctamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      // Continuamos con el logout local aunque falle el servidor
    } finally {
      // Siempre limpiamos el estado local
      setUser(null);
      setIsLoggedIn(false);
      setError(null);
      
      // Limpiar cualquier dato almacenado localmente
      localStorage.removeItem('rememberedUsername');
      sessionStorage.clear();
    }
  };

  const checkSession = async () => {
    try {
      setLoading(true);
      console.log('🔍 Verificando sesión activa...');

      const response = await axios.get(`${config.apiBaseUrl}/api/session`, {
        withCredentials: true,
        timeout: 10000
      });
      
      if (response.data.authenticated) {
        setUser(response.data.user);
        setIsLoggedIn(true);
        setError(null);
        console.log('✅ Sesión activa encontrada para:', response.data.user?.usuario);
        return true;
      } else {
        console.log('ℹ️ No hay sesión activa');
        setUser(null);
        setIsLoggedIn(false);
        return false;
      }
    } catch (error) {
      console.error('❌ Error verificando sesión:', error);
      
      // En producción, no mostramos errores de conexión al usuario
      // Solo limpiamos el estado local
      setUser(null);
      setIsLoggedIn(false);
      
      // Si es un error de red, podríamos considerar mantener al usuario logueado
      // pero por seguridad lo cerramos
      if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
        console.warn('⚠️ Error de red al verificar sesión, limpiando estado local');
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const updateUser = (updatedUserData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedUserData
    }));
  };

  const value = {
    user,
    isLoggedIn,
    loading,
    error,
    login,
    logout,
    checkSession,
    clearError,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};