import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../styles/Login.css';

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
    // Verificar si ya hay una sesión activa
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
    <div className="login-container">
      <div className="login-background">
        <div className="login-background-shapes">
          <div className="login-shape login-shape-1"></div>
          <div className="login-shape login-shape-2"></div>
          <div className="login-shape login-shape-3"></div>
        </div>
      </div>

      <div className="login-content">
        <div className="login-branding">
          <div className="login-logo-container">
            <div className="login-logo">
              <span className="login-logo-text">SC</span>
            </div>
          </div>
          <h1 className="login-app-name">Sage200 Contabilidad</h1>
          <p className="login-integration-text">Sistema integrado con Sage200</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form-header">
            <h2 className="login-form-title">Iniciar Sesión</h2>
            <p className="login-form-subtitle">Acceda a su cuenta para continuar</p>
          </div>
          
          {error && (
            <div className="login-error">
              <div className="login-error-icon">!</div>
              <p>{error}</p>
            </div>
          )}

          <div className="login-input-group">
            <label htmlFor="username" className="login-label">Usuario</label>
            <div className="login-input-container">
              <span className="login-input-icon">👤</span>
              <input
                id="username"
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="login-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="login-input-group">
            <label htmlFor="password" className="login-label">Contraseña</label>
            <div className="login-input-container">
              <span className="login-input-icon">🔒</span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="login-input"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="login-password-toggle"
                disabled={isLoading}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="login-remember-forgot">
            <label className="login-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="login-checkbox"
                disabled={isLoading}
              />
              <span className="login-checkbox-custom"></span>
              Recordar usuario
            </label>
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="login-button-spinner"></div>
                Iniciando sesión...
              </>
            ) : (
              'Acceder al sistema'
            )}
          </button>

          <div className="login-footer">
            <p className="login-footer-text">
              Sistema integrado con Sage200 • Versión 1.0
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;