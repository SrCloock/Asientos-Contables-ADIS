import React, { useState } from 'react';
import styles from '../styles/FormPage2.module.css';

const CUENTAS_CAJA = [
  { id: '6001', nombre: 'Compras generales' },
  { id: '6002', nombre: 'Servicios externos' },
  { id: '6010', nombre: 'Suministros oficina' },
  { id: '6011', nombre: 'Gastos transporte' },
  { id: '6020', nombre: 'Publicidad' },
  { id: '6031', nombre: 'Mantenimiento técnico' },
];

const CUENTAS_INGRESO = [
  { id: '519634', nombre: 'Ingreso por ventas' },
  { id: '519719', nombre: 'Ingreso por servicios' },
  { id: '519820', nombre: 'Ingreso por alquileres' },
  { id: '519901', nombre: 'Otros ingresos' },
];

const FormPage2 = () => {
  const [tipoIngreso, setTipoIngreso] = useState('caja');
  const [fechaFactura, setFechaFactura] = useState('');
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('');

  const cuentasDisponibles = tipoIngreso === 'caja' ? CUENTAS_CAJA : CUENTAS_INGRESO;

  return (
    <div className={styles.formulario2Container}>
      <h2>Formulario de Ingreso / Caja</h2>

      <div className={styles.section}>
        <h3>Tipo</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Tipo</label>
            <select
              value={tipoIngreso}
              onChange={(e) => {
                setTipoIngreso(e.target.value);
                setCuentaSeleccionada(''); // resetea cuenta al cambiar tipo
              }}
            >
              <option value="caja">Caja</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Datos</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Serie</label>
            <input type="text" value="CEM" readOnly />
          </div>
          <div className={styles.formGroup}>
            <label>Nº Documento</label>
            <input type="text" />
          </div>
          <div className={styles.formGroup}>
            <label>Fecha Factura</label>
            <input
              type="date"
              value={fechaFactura}
              onChange={(e) => setFechaFactura(e.target.value)}
              min="2000-01-01"
              max="2099-12-31"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Importe y Cuenta</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Concepto</label>
            <input type="text" />
          </div>
          <div className={styles.formGroup}>
            <label>Importe</label>
            <input type="number" />
          </div>

          <div className={styles.formGroup}>
            <label>Cuenta</label>
            <select
              value={cuentaSeleccionada}
              onChange={(e) => setCuentaSeleccionada(e.target.value)}
            >
              <option value="">-- Seleccionar cuenta --</option>
              {cuentasDisponibles.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.id} - {cuenta.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Cuenta Caja</label>
            <input type="text" value="4563" readOnly />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Archivo</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Adjuntar Archivo</label>
            <input type="file" />
          </div>
        </div>
      </div>

      <div className={styles.buttonGroup}>
        <button className={styles.cancelBtn}>Cancelar</button>
        <button className={styles.clearBtn}>Limpiar</button>
        <button className={styles.submitBtn}>Aceptar</button>
      </div>
    </div>
  );
};

export default FormPage2;