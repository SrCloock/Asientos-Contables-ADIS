// components/Layout.jsx
import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { 
  FaChartLine, 
  FaFileInvoice, 
  FaMoneyBill, 
  FaExchangeAlt, 
  FaSignOutAlt, 
  FaUser, 
  FaBuilding,
  FaFileInvoiceDollar,
  FaHandHoldingUsd,
  FaMoneyBillWave,
  FaHistory,
  FaReceipt
} from 'react-icons/fa';
import styles from '../styles/Layout.module.css';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

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
          <div className={styles.lyNavHeader}>
            <div className={styles.lyLogoSection}>
              <img 
                src={logo} 
                alt="Logo Sage200" 
                className={styles.lyLogo}
              />
              <div className={styles.lyBrandText}>
                <h1>Sage200</h1>
                <span>Contabilidad</span>
              </div>
            </div>
            <div className={styles.lyUserInfo}>
              <span>
                <FaUser />
                Usuario: <strong>{user?.usuario}</strong>
              </span>
              <span>
                <FaUser />
                Nombre: <strong>{user?.nombre}</strong>
              </span>
              <span>
                <FaBuilding />
                Empresa: <strong>10000</strong>
              </span>
            </div>
          </div>
          <ul className={styles.lyNavMenu}>
            <li>
              <Link 
                to="/form4" 
                className={location.pathname === '/form4' ? styles.active : ''}
              >
                <FaFileInvoiceDollar />
                Factura Proveedor
              </Link>
            </li>
            <li>
              <Link 
                to="/form5" 
                className={location.pathname === '/form5' ? styles.active : ''}
              >
                <FaHandHoldingUsd />
                Pago Caja Proveedor
              </Link>
            </li>
            <li>
              <Link 
                to="/form6" 
                className={location.pathname === '/form6' ? styles.active : ''}
              >
                <FaMoneyBillWave />
                Ingreso Caja
              </Link>
            </li>
            <li>
              <Link 
                to="/form7" 
                className={location.pathname === '/form7' ? styles.active : ''}
              >
                <FaReceipt />
                Gasto Directo Caja
              </Link>
            </li>
            <li>
              <Link 
                to="/historial" 
                className={location.pathname === '/historial' ? styles.active : ''}
              >
                <FaHistory />
                Historial Asientos
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