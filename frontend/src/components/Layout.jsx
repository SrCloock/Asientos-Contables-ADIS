import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import styles from '../styles/Layout.module.css';

const Layout = ({ children, isLoggedIn, onLogout, user }) => {
  const location = useLocation();

  // Si no está logueado, redirigir al login
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.navbar}>
        <div className={styles.navBrand}>
          <h2>🧮 Sage200 Contabilidad</h2>
          <span className={styles.userInfo}>
            Usuario: {user?.username || user?.UsuarioLogicNet || 'Invitado'}
            {user?.isAdmin && ' (Admin)'}
          </span>
        </div>
        <ul className={styles.navMenu}>
          <li>
            <Link 
              to="/dashboard" 
              className={location.pathname === '/dashboard' ? styles.active : ''}
            >
              📊 Inicio
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
            <button onClick={onLogout} className={styles.logoutBtn}>
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