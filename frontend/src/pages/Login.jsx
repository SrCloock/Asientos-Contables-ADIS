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
      
      console.log('Respuesta del login:', response.data); // Para debug
      
      if (response.data.success) {
        onLogin(response.data.user);
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'Credenciales inválidas');
      }
    } catch (err) {
      console.error('Error completo:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.code === 'ERR_NETWORK') {
        setError('Error de conexión. Verifica que el servidor esté ejecutándose.');
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
              placeholder="UsuarioLogicNet"
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
              placeholder="ContraseñaLogicNet"
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
          <p><small>Usuario: UsuarioLogicNet | Contraseña: ContraseñaLogicNet</small></p>
        </div>
      </div>
    </div>
  );
};

export default Login;