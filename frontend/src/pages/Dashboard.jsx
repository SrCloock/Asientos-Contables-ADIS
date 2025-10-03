import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/Dashboard.module.css';

const Dashboard = () => {
  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Panel Principal - Sage200</h1>
        <p>Sistema de Gestión Contable Integrado</p>
      </div>

      <div className={styles.dashboardGrid}>
        <div className={styles.dashboardCard}>
          <div className={styles.cardIcon}></div>
          <h3>Facturas y Gastos</h3>
          <p>Registro de facturas recibidas y gastos contables</p>
          <Link to="/form1" className={styles.cardButton}>
            Acceder a Facturas
          </Link>
        </div>

        <div className={styles.dashboardCard}>
          <div className={styles.cardIcon}></div>
          <h3>Ingresos</h3>
          <p>Registro de ingresos y cobros contables</p>
          <Link to="/form2" className={styles.cardButton}>
            Acceder a Ingresos
          </Link>
        </div>
      </div>

      <div className={styles.dashboardInfo}>
        <div className={styles.infoSection}>
          <h3>Características del Sistema</h3>
          <ul>
            <li>Conexión integrada con <strong>Sage200</strong></li>
            <li>Registro rápido de asientos contables</li>
            <li>Validaciones automáticas</li>
            <li>Persistencia de sesión segura</li>
            <li>Interfaz moderna y responsive</li>
          </ul>
        </div>

        <div className={styles.infoSection}>
          <h3>Estadísticas del Sistema</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>2</span>
              <span className={styles.statLabel}>Módulos Activos</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>✓</span>
              <span className={styles.statLabel}>Sistema Online</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>24/7</span>
              <span className={styles.statLabel}>Disponibilidad</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;