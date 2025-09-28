import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from '../styles/Layout.module.css';
import axios from 'axios';

const Layout = ({ children, isLoggedIn, onLogout, user, setUser }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isLoggedIn);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Verificar sesión al cargar el componente
    const checkSession = async () => {
      if (isLoggedIn) {
        setLoading(false);
        setSessionChecked(true);
        return;
      }

      try {
        console.log('🔍 Verificando sesión existente...');
        const response = await axios.get('http://localhost:5000/api/session', {
          withCredentials: true,
          timeout: 5000
        });
        
        console.log('📋 Respuesta de sesión:', response.data);
        
        if (response.data.authenticated) {
          console.log('🔄 Sesión recuperada:', response.data.user);
          if (setUser) {
            setUser(response.data.user);
          }
          // No navegar automáticamente, dejar que el estado se actualice
        } else {
          console.log('🔒 No hay sesión activa');
          navigate('/');
        }
      } catch (error) {
        console.error('❌ Error verificando sesión:', error);
        if (error.code === 'ECONNREFUSED') {
          console.error('Servidor no disponible');
        }
        navigate('/');
      } finally {
        setLoading(false);
        setSessionChecked(true);
      }
    };

    checkSession();
  }, [isLoggedIn, navigate, setUser]);

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:5000/logout', {}, {
        withCredentials: true,
        timeout: 5000
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      onLogout();
      navigate('/');
    }
  };

  // Mostrar loading mientras se verifica la sesión
  if (loading || !sessionChecked) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>⏳</div>
        <p>Verificando sesión...</p>
        <button 
          className={styles.manualRedirect}
          onClick={() => navigate('/')}
        >
          Ir al login
        </button>
      </div>
    );
  }

  // Si no está logueado, mostrar children directamente (para login)
  if (!isLoggedIn) {
    return children;
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.navbar}>
        <div className={styles.navBrand}>
          <h2>🧮 Sage200 Contabilidad</h2>
          <div className={styles.userInfo}>
            <span>Usuario: <strong>{user?.usuario}</strong></span>
            <span>Nombre: <strong>{user?.nombre}</strong></span>
            <span>Empresa: <strong>9999</strong></span>
          </div>
        </div>
        <ul className={styles.navMenu}>
          <li>
            <Link 
              to="/dashboard" 
              className={location.pathname === '/dashboard' ? styles.active : ''}
            >
              📊 Dashboard
            </Link>
          </li>
          <li>
            <Link 
              to="/form1" 
              className={location.pathname === '/form1' ? styles.active : ''}
            >
              📋 Facturas/Gastos
            </Link>
          </li>
          <li>
            <Link 
              to="/form2" 
              className={location.pathname === '/form2' ? styles.active : ''}
            >
              💰 Ingresos
            </Link>
          </li>
          <li>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              🔒 Cerrar Sesión
            </button>
          </li>
        </ul>
      </nav>
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};

export default Layout;