import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaReceipt } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../../styles/FormPage7.module.css';
import config from '../../config/config';
import { useFormShared } from '../../hooks/useFormShared';
import { formatFechaForBackend, customStyles } from '../../utils/formUtils';

const Form7 = () => {
  const {
    numAsiento, refreshContador,
    serieBase, cuentaCaja,
    cuentasGasto, cuentasGastoOptions
  } = useFormShared({ loadCuentasGasto: true });

  // Form7: serie WITH 'C' prefix
  const serie = `C${serieBase}`;
  const analitico = `C${serieBase}`;

  const [loading, setLoading] = useState(false);
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [archivo, setArchivo] = useState('');

  const resetForm = () => {
    setNumDocumento(''); setConcepto(''); setImporte(''); setArchivo(''); setCuentaGasto('');
    refreshContador();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errores = [];
    if (!numDocumento.trim()) errores.push('El número de documento es obligatorio');
    if (!concepto.trim()) errores.push('El concepto es obligatorio');
    if (!cuentaGasto) errores.push('La cuenta de gasto es obligatoria');
    if (!importe || parseFloat(importe) <= 0) errores.push('El importe debe ser mayor a 0');
    if (errores.length > 0) { alert('Errores:\n• ' + errores.join('\n• ')); return; }

    setLoading(true);
    try {
      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/gasto-directo-caja`, {
        serie, numDocumento,
        fechaReg: formatFechaForBackend(fechaReg),
        concepto, comentario: concepto,
        analitico, cuentaGasto, cuentaCaja,
        importe: parseFloat(importe), archivo
      }, { withCredentials: true });
      if (response.data.success) { alert(`✅ Asiento #${response.data.asiento} - Gasto en Caja creado correctamente`); resetForm(); }
      else alert('❌ Error: ' + response.data.message);
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const importeNum = parseFloat(importe) || 0;
  const getNombreCuentaGasto = () => cuentasGasto.find(c => c.id === cuentaGasto)?.nombre || '';

  return (
    <div className={styles.fp7Container}>
      <div className={styles.fp7Header}>
        <h2><FaReceipt /> Gasto Directo en Caja</h2>
        <div className={styles.fp7AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp7Form}>
        <div className={styles.fp7Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Serie</label>
              <input type="text" value={serie} readOnly className={styles.fp7Readonly} />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Nº Documento *</label>
              <input type="text" value={numDocumento} onChange={e => setNumDocumento(e.target.value)} placeholder="Número de documento" required />
            </div>
          </div>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Concepto *</label>
              <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción del gasto" required />
            </div>
          </div>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Fecha de Registro *</label>
              <input type="date" value={fechaReg} onChange={e => setFechaReg(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className={styles.fp7Section}>
          <h3>Datos del Gasto</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Código Analítico</label>
              <input type="text" value={analitico} readOnly className={styles.fp7Readonly} />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Cuenta de Gasto *</label>
              <Select options={cuentasGastoOptions} value={cuentasGastoOptions.find(o => o.value === cuentaGasto) || null}
                onChange={o => setCuentaGasto(o ? o.value : '')} placeholder="Buscar cuenta de gasto..." isSearchable styles={customStyles} />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Importe *</label>
              <input type="number" step="0.01" min="0.01" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" required />
            </div>
          </div>
        </div>

        <div className={styles.fp7Section}>
          <h3>Archivo Adjunto</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Ruta Completa del Justificante</label>
              <input type="text" value={archivo} onChange={e => setArchivo(e.target.value)} placeholder="Ej: C:\Carpeta\justificante.pdf" className={styles.fp7FileInput} />
              {archivo && <div className={styles.fp7FileName}>✅ Ruta: <strong>{archivo}</strong></div>}
            </div>
          </div>
        </div>

        <div className={styles.fp7Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp7Resumen}>
            <div className={styles.fp7ResumenItem}>
              <span className={styles.fp7DebeHaber}>DEBE</span>
              <span className={styles.fp7CuentaInfo}>{cuentaGasto} - {getNombreCuentaGasto()}</span>
              <span className={styles.fp7Importe}>{importeNum.toFixed(2)} €</span>
            </div>
            <div className={styles.fp7ResumenItem}>
              <span className={styles.fp7DebeHaber}>HABER</span>
              <span className={styles.fp7CuentaInfo}>{cuentaCaja} - Caja</span>
              <span className={styles.fp7Importe}>{importeNum.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <div className={styles.fp7ButtonGroup}>
          <button type="button" className={styles.fp7CancelBtn} onClick={() => window.history.back()} disabled={loading}>← Volver</button>
          <button type="button" className={styles.fp7ClearBtn} onClick={resetForm} disabled={loading}>Limpiar</button>
          <button type="submit" className={styles.fp7SubmitBtn} disabled={loading || !importe || !concepto || !numDocumento || !cuentaGasto}>
            {loading ? 'Procesando...' : 'Crear Asiento de Gasto'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Form7;
