import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/Dashboard.css';

const Dashboard = ({ user }) => {
  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardHeader}>
        <h1>🏠 Inicio - Sage200</h1>
        <p>Sistema de Gestión Contable Integrado</p>
        <div className={styles.userWelcome}>
          <p>Bienvenido, <strong>{user?.razonSocial || user?.username || 'Usuario'}</strong></p>
          <p><small>CIF: {user?.cifDni} | Empresa: {user?.codigoCliente}</small></p>
        </div>
      </div>

      <div className={styles.dashboardGrid}>
        <div className={styles.dashboardCard}>
          <div className={styles.cardIcon}>📋</div>
          <h3>Facturas y Gastos</h3>
          <p>Registro de facturas recibidas y gastos contables</p>
          <Link to="/form1" className={styles.cardButton}>
            Acceder a Facturas
          </Link>
        </div>

        <div className={styles.dashboardCard}>
          <div className={styles.cardIcon}>💰</div>
          <h3>Ingresos</h3>
          <p>Registro de ingresos y cobros contables</p>
          <Link to="/form2" className={styles.cardButton}>
            Acceder a Ingresos
          </Link>
        </div>

        <div className={styles.dashboardCard}>
          <div className={styles.cardIcon}>📊</div>
          <h3>Consultas</h3>
          <p>Consulta de asientos y movimientos contables</p>
          <button className={styles.cardButton + ' ' + styles.disabledButton}>
            Próximamente
          </button>
        </div>

        <div className={styles.dashboardCard}>
          <div className={styles.cardIcon}>⚙️</div>
          <h3>Configuración</h3>
          <p>Ajustes y configuración del sistema</p>
          <button className={styles.cardButton + ' ' + styles.disabledButton}>
            Próximamente
          </button>
        </div>
      </div>

      <div className={styles.dashboardInfo}>
        <div className={styles.infoSection}>
          <h3>✅ Características del Sistema</h3>
          <ul>
            <li>✅ Conexión integrada con <strong>Sage200</strong></li>
            <li>✅ Registro rápido de asientos contables</li>
            <li>✅ Validaciones automáticas</li>
            <li>✅ Persistencia de sesión segura</li>
            <li>✅ Interfaz moderna y responsive</li>
          </ul>
        </div>

        <div className={styles.infoSection}>
          <h3>📈 Información de Usuario</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Usuario</span>
              <span className={styles.statNumber}>{user?.username}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Empresa</span>
              <span className={styles.statNumber}>{user?.codigoCliente}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>CIF</span>
              <span className={styles.statNumber}>{user?.cifDni}</span>
            </div>
            {user?.isAdmin && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Rol</span>
                <span className={styles.statNumber}>Administrador</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;