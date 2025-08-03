import React, { useState } from 'react';
import styles from '../styles/FormPage1.module.css';

const cuentasPredefinidas = {
  '467893': { cif: 'B12345678', nombre: 'Proveedor A', cp: '28001' },
  '467894': { cif: 'B87654321', nombre: 'Proveedor B', cp: '08001' },
  '467895': { cif: 'B11112222', nombre: 'Proveedor C', cp: '46001' }
};

const FormPage1 = () => {
  const [tipo, setTipo] = useState('factura');
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '' });

  const handleCuentaPChange = (e) => {
    const val = e.target.value;
    setCuentaP(val);
    setDatosCuentaP(cuentasPredefinidas[val] || { cif: '', nombre: '', cp: '' });
  };

  return (
    <div className={styles.formulario1Container}>
      <h2>Factura Recibida / Gasto</h2>

      <div className={styles.section}>
        <h3>Tipo de Documento</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="factura">Factura Recibida</option>
              <option value="gasto">Gasto</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Datos del Documento</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label>Serie</label><input type="text" defaultValue="EM" /></div>
          <div className={styles.formGroup}><label>Nº Documento</label><input type="text" /></div>
          <div className={styles.formGroup}><label>F. Reg</label><input type="date" /></div>
          <div className={styles.formGroup}><label>F. F</label><input type="date" /></div>
          <div className={styles.formGroup}><label>F. Oper</label><input type="date" /></div>
          <div className={styles.formGroup}><label>Vencimiento</label><input type="date" /></div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Proveedor</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Nº FRA</label>
            <input type="text" />
          </div>
          <div className={styles.formGroup}>
            <label>Cuenta P.</label>
            <select value={cuentaP} onChange={handleCuentaPChange}>
              <option value="">Seleccionar</option>
              {Object.keys(cuentasPredefinidas).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Cuenta</label>
            <select>
              <option value="467893">467893</option>
              <option value="467894">467894</option>
              <option value="467895">467895</option>
            </select>
          </div>
          <div className={styles.formGroup}><label>CIF</label><input type="text" value={datosCuentaP.cif} readOnly /></div>
          <div className={styles.formGroup}><label>Nombre</label><input type="text" value={datosCuentaP.nombre} readOnly /></div>
          <div className={styles.formGroup}><label>CP</label><input type="text" value={datosCuentaP.cp} readOnly /></div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Detalles Económicos</h3>
        <div className={styles.dualGrid}>
          <div>
            <div className={styles.formGroup}><label>Analítico</label><input type="text" /></div>
            {[1, 2, 3].map((i) => (
              <div className={styles.formRow} key={i}>
                <div className={styles.formGroup}><label>Base{i}</label><input type="number" /></div>
                <div className={styles.formGroup}><label>Tipo IVA</label>
                  <select><option>21%</option><option>10%</option><option>4%</option><option>0%</option></select>
                </div>
                <div className={styles.formGroup}><label>Retención</label>
                  <select><option>15%</option><option>7%</option><option>1%</option><option>0%</option></select>
                </div>
                <div className={styles.formGroup}><label>Cuota</label><input type="number" /></div>
              </div>
            ))}
          </div>
          <div>
            <div className={styles.formGroup}><label>Cuenta</label><input type="text" /></div>
            <div className={styles.formGroup}><label>Adjuntar archivo</label><input type="file" /></div>
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

export default FormPage1;
