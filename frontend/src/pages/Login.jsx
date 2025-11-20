import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';
import styles from '../styles/Login.module.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, isLoggedIn, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  // 🔄 Redirige si ya está logueado
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/dashboard');
    }
  }, [isLoggedIn, navigate]);

  // 💾 Cargar usuario recordado
  useEffect(() => {
    const saved = localStorage.getItem('rememberedUsername');
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const success = await login(username, password);
      if (success) {
        rememberMe
          ? localStorage.setItem('rememberedUsername', username)
          : localStorage.removeItem('rememberedUsername');
        navigate('/dashboard');
      }
    } catch (_) {}
  };

  return (
    <div className={styles.lgContainer}>
      <div className={styles.lgContent}>

        {/* PANEL IZQUIERDO - BRANDING */}
        <div className={styles.lgBranding}>
          <div className={styles.lgLogoContainer}>
            <div className={styles.lgLogo}>SC</div>
          </div>
          <h1 className={styles.lgAppName}>Sage200 Contabilidad</h1>
          <p className={styles.lgIntegrationText}>Sistema integrado con Sage200</p>
        </div>

        {/* FORMULARIO */}
        <form className={styles.lgForm} onSubmit={handleSubmit}>
          <h2 className={styles.lgFormTitle}>Iniciar Sesión</h2>

          {/* USUARIO */}
          <div className={styles.lgInputGroup}>
            <label><FaUser /> Usuario</label>
            <div className={styles.lgInputContainer}>
              <input
                type="text"
                value={username}
                disabled={loading}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.lgInput}
                placeholder="Ingrese su usuario"
              />
            </div>
          </div>

          {/* CONTRASEÑA */}
          <div className={styles.lgInputGroup}>
            <label><FaLock /> Contraseña</label>
            <div className={styles.lgInputContainer}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                disabled={loading}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.lgInput}
                placeholder="Ingrese su contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.lgPasswordToggle}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* RECORDAR USUARIO */}
          <label className={styles.lgCheckboxLabel}>
            <input
              type="checkbox"
              checked={rememberMe}
              disabled={loading}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Recordar usuario
          </label>

          {/* BOTÓN ACCEDER */}
          <button
            type="submit"
            disabled={loading}
            className={styles.lgButton}
          >
            {loading ? <FaSpinner className={styles.lgButtonSpinner} /> : 'Acceder'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
