import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';
import styles from '../styles/Login.module.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, isLoggedIn, checkSession } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const verifySession = async () => {
      const hasSession = await checkSession();
      if (hasSession) {
        navigate('/dashboard');
      }
    };

    verifySession();
  }, [checkSession, navigate]);

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/dashboard');
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!username || !password) {
      setError('Por favor complete todos los campos');
      setIsLoading(false);
      return;
    }

    try {
      const success = await login(username, password);
      if (success) {
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        navigate('/dashboard');
      } else {
        setError('Usuario o contraseña incorrectos');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={styles.lgContainer}>
      <div className={styles.lgContent}>
        <div className={styles.lgBranding}>
          <div className={styles.lgLogoContainer}>
            <div className={styles.lgLogo}>
              SC
            </div>
          </div>
          <h1 className={styles.lgAppName}>Sage200 Contabilidad</h1>
          <p className={styles.lgIntegrationText}>Sistema integrado con Sage200</p>
        </div>
        
        <form className={styles.lgForm} onSubmit={handleSubmit}>
          <div className={styles.lgFormHeader}>
            <h2 className={styles.lgFormTitle}>Iniciar Sesión</h2>
            <p className={styles.lgFormSubtitle}>Acceda a su cuenta para continuar</p>
          </div>
          
          {error && (
            <div className={styles.lgError}>
              <div className={styles.lgErrorIcon}>!</div>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.lgInputGroup}>
            <label htmlFor="username" className={styles.lgLabel}>
              <FaUser style={{ marginRight: '0.5rem' }} />
              Usuario
            </label>
            <div className={styles.lgInputContainer}>
              <input
                id="username"
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={styles.lgInput}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.lgInputGroup}>
            <label htmlFor="password" className={styles.lgLabel}>
              <FaLock style={{ marginRight: '0.5rem' }} />
              Contraseña
            </label>
            <div className={styles.lgInputContainer}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.lgInput}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className={styles.lgPasswordToggle}
                disabled={isLoading}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className={styles.lgRememberForgot}>
            <label className={styles.lgCheckboxLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={styles.lgCheckbox}
                disabled={isLoading}
              />
              Recordar usuario
            </label>
          </div>

          <button 
            type="submit" 
            className={styles.lgButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <FaSpinner className={styles.lgButtonSpinner} />
                Iniciando sesión...
              </>
            ) : (
              'Acceder al sistema'
            )}
          </button>

          <div className={styles.lgFooter}>
            <p className={styles.lgFooterText}>
              Sistema integrado con Sage200 • Versión 1.0
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;