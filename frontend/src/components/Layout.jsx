import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import styles from '../styles/Layout.module.css';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.navbar}>
        <div className={styles.navBrand}>
          <h2>Sage200 Contabilidad</h2>
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
              Dashboard
            </Link>
          </li>
          <li>
            <Link 
              to="/form1" 
              className={location.pathname === '/form1' ? styles.active : ''}
            >
              Facturas y Gastos
            </Link>
          </li>
          <li>
            <Link 
              to="/form2" 
              className={location.pathname === '/form2' ? styles.active : ''}
            >
              Ingresos
            </Link>
          </li>
          <li>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Cerrar Sesión
            </button>
          </li>
        </ul>
      </nav>
      <main className={styles.mainContent}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;