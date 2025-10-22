import React from 'react';
import { Link } from 'react-router-dom';
import { FaFileInvoice, FaMoneyBill, FaChartLine, FaCheckCircle, FaServer } from 'react-icons/fa';
import styles from '../styles/Dashboard.module.css';

const Dashboard = () => {
  return (
    <div className={styles.dbContainer}>
      <div className={styles.dbHeader}>
        <h1>Panel Principal - Sage200</h1>
        <p>Sistema de Gestión Contable Integrado</p>
      </div>

      <div className={styles.dbGrid}>
        <div className={styles.dbCard}>
          <div className={styles.dbCardIcon}>
            <FaFileInvoice />
          </div>
          <h3>Facturas y Gastos</h3>
          <p>Registro de facturas recibidas y gastos contables con control de IVA y retenciones</p>
          <Link to="/form1" className={styles.dbCardButton}>
            Acceder a Facturas
          </Link>
        </div>

        <div className={styles.dbCard}>
          <div className={styles.dbCardIcon}>
            <FaMoneyBill />
          </div>
          <h3>Ingresos</h3>
          <p>Registro de ingresos y cobros contables con múltiples cuentas de ingreso</p>
          <Link to="/form2" className={styles.dbCardButton}>
            Acceder a Ingresos
          </Link>
        </div>
      </div>

      <div className={styles.dbInfo}>
        <div className={styles.dbInfoSection}>
          <h3>Características del Sistema</h3>
          <ul>
            <li>Conexión integrada con <strong>Sage200</strong></li>
            <li>Registro rápido de asientos contables</li>
            <li>Validaciones automáticas y cálculos en tiempo real</li>
            <li>Persistencia de sesión segura</li>
            <li>Interfaz moderna y responsive</li>
            <li>Gestión de proveedores y cuentas contables</li>
          </ul>
        </div>

        <div className={styles.dbInfoSection}>
          <h3>Estadísticas del Sistema</h3>
          <div className={styles.dbStatsGrid}>
            <div className={styles.dbStatItem}>
              <span className={styles.dbStatNumber}>3</span>
              <span className={styles.dbStatLabel}>Módulos Activos</span>
            </div>
            <div className={styles.dbStatItem}>
              <span className={styles.dbStatNumber}>
                <FaCheckCircle />
              </span>
              <span className={styles.dbStatLabel}>Sistema Online</span>
            </div>
            <div className={styles.dbStatItem}>
              <span className={styles.dbStatNumber}>24/7</span>
              <span className={styles.dbStatLabel}>Disponibilidad</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;