import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Login.module.css';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/login', {
        usuario: username,
        contrasena: password
      });
      
      if (response.data.success) {
        onLogin(response.data.user);
        navigate('/dashboard');
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Usuario o contraseña incorrectos');
      } else {
        setError('Error en la conexión con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <h1>🧮 Sage200</h1>
          <p>Sistema de Gestión Contable</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <label htmlFor="username">👤 Usuario:</label>
            <input 
              id="username"
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              placeholder="Ingrese su usuario"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">🔒 Contraseña:</label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Ingrese su contraseña"
            />
          </div>
          
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? '⏳ Iniciando sesión...' : '🚀 Ingresar'}
          </button>
        </form>
        
        <div className={styles.loginFooter}>
          <p>Sistema conectado con Sage200</p>
        </div>
      </div>
    </div>
  );
};

export default Login;