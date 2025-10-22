import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const login = async (username, password) => {
    try {
      const response = await axios.post(
        'http://localhost:5000/login',
        { username, password },
        { withCredentials: true }
      );

      if (response.data.success) {
        setUser(response.data.user);
        setIsLoggedIn(true);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Error de conexión con el servidor');
    }
  };

  const logout = async () => {
    try {
      await axios.post('http://localhost:5000/logout', {}, { 
        withCredentials: true 
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setUser(null);
      setIsLoggedIn(false);
    }
  };

  const checkSession = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/session', {
        withCredentials: true
      });
      
      if (response.data.authenticated) {
        setUser(response.data.user);
        setIsLoggedIn(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verificando sesión:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    isLoggedIn,
    loading,
    login,
    logout,
    checkSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};