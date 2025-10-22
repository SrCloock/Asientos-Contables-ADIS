import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { FaChartLine, FaFileInvoice, FaMoneyBill, FaExchangeAlt, FaSignOutAlt, FaUser, FaBuilding } from 'react-icons/fa';
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
    <div className={styles.lyLayout}>
      <nav className={styles.lyNavbar}>
        <div className={styles.lyNavContent}>
          <div className={styles.lyNavBrand}>
            <h2>Sage200 Contabilidad</h2>
            <div className={styles.lyUserInfo}>
              <span>
                <FaUser style={{ marginRight: '0.25rem' }} />
                Usuario: <strong>{user?.usuario}</strong>
              </span>
              <span>
                <FaUser style={{ marginRight: '0.25rem' }} />
                Nombre: <strong>{user?.nombre}</strong>
              </span>
              <span>
                <FaBuilding style={{ marginRight: '0.25rem' }} />
                Empresa: <strong>9999</strong>
              </span>
            </div>
          </div>
          <ul className={styles.lyNavMenu}>
            <li>
              <Link 
                to="/dashboard" 
                className={location.pathname === '/dashboard' ? styles.active : ''}
              >
                <FaChartLine />
                Dashboard
              </Link>
            </li>
            <li>
              <Link 
                to="/form1" 
                className={location.pathname === '/form1' ? styles.active : ''}
              >
                <FaFileInvoice />
                Facturas y Gastos
              </Link>
            </li>
            <li>
              <Link 
                to="/form2" 
                className={location.pathname === '/form2' ? styles.active : ''}
              >
                <FaMoneyBill />
                Ingresos
              </Link>
            </li>
            <li>
              <Link 
                to="/form3" 
                className={location.pathname === '/form3' ? styles.active : ''}
              >
                <FaExchangeAlt />
                Asiento Doble
              </Link>
            </li>
            <li>
              <button onClick={handleLogout} className={styles.lyLogoutBtn}>
                <FaSignOutAlt />
                Cerrar Sesión
              </button>
            </li>
          </ul>
        </div>
      </nav>
      <main className={styles.lyMainContent}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;