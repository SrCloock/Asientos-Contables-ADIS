import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import styles from './Layout.module.css';

const Layout = ({ user, onLogout }) => {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <h2>Contabilidad</h2>
        <nav>
          <NavLink to="/dashboard">Inicio</NavLink>
          <NavLink to="/form1">Facturas</NavLink>
          <NavLink to="/form2">Ingresos</NavLink>
        </nav>

        {/* Usuario y logout abajo */}
        <div className={styles.userInfo}>
          <p>Hola, <strong>{user?.name || 'Invitado'}</strong></p>
          {user && (
            <button onClick={onLogout} className={styles.logoutBtn}>
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
