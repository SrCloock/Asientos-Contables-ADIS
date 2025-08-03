import React, { useState } from 'react';
import styles from '../styles/FormPage2.module.css';

const FormPage2 = () => {
  const [tipoIngreso, setTipoIngreso] = useState('caja');

  return (
    <div className={styles.formulario2Container}>
      <h2>Formulario de Ingreso / Caja</h2>

      <div className={styles.section}>
        <h3>Tipo</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Tipo</label>
            <select value={tipoIngreso} onChange={(e) => setTipoIngreso(e.target.value)}>
              <option value="caja">Caja</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Datos</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label>Serie</label><input type="text" /></div>
          <div className={styles.formGroup}><label>Nº Documento</label><input type="text" /></div>
          <div className={styles.formGroup}>
            <label>Año Factura</label>
            <select>
              <option value="">Seleccionar</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Importe y Cuenta</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label>Concepto</label><input type="text" /></div>
          <div className={styles.formGroup}><label>Importe</label><input type="number" /></div>
          <div className={styles.formGroup}><label>Cuenta</label><input type="text" /></div>
          <div className={styles.formGroup}><label>Cuenta Caja</label><input type="text" /></div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Archivo</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label>Adjuntar Archivo</label><input type="file" /></div>
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
