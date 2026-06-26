import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaMoneyBillWave } from 'react-icons/fa';
import styles from '../../styles/FormPage6.module.css';
import config from '../../config/config';
import { useFormShared } from '../../hooks/useFormShared';
import { formatFechaForBackend } from '../../utils/formUtils';

const Form6 = () => {
  const { numAsiento, refreshContador, serieBase, cuentaCaja } = useFormShared();

  const serie = `C${serieBase}`;
  const analitico = `C${serieBase}`;

  const [loading, setLoading] = useState(false);
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [archivo, setArchivo] = useState('');
  const [cuentaIngreso, setCuentaIngreso] = useState('');
  const [cuentasIngreso, setCuentasIngreso] = useState([]);

  useEffect(() => {
    axios.get(`${config.apiBaseUrl}/api/cuentas/ingresos`, { withCredentials: true })
      .then(res => setCuentasIngreso(res.data))
      .catch(err => console.error('Error cargando cuentas de ingreso:', err));
  }, []);

  const resetForm = () => {
    setNumDocumento(''); setConcepto(''); setImporte(''); setArchivo(''); setCuentaIngreso('');
    refreshContador();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errores = [];
    if (!numDocumento.trim()) errores.push('El número de documento es obligatorio');
    if (!concepto.trim()) errores.push('El concepto es obligatorio');
    if (!importe || parseFloat(importe) <= 0) errores.push('El importe debe ser mayor a 0');
    if (!cuentaIngreso) errores.push('La cuenta de ingreso es obligatoria');
    if (errores.length > 0) { alert('Errores:\n• ' + errores.join('\n• ')); return; }

    setLoading(true);
    try {
      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/ingreso-caja`, {
        serie, numDocumento,
        fechaReg: formatFechaForBackend(fechaReg),
        concepto, comentario: concepto,
        analitico, cuentaIngreso, cuentaCaja,
        importe: parseFloat(importe), archivo
      }, { withCredentials: true });
      if (response.data.success) { alert(`✅ Asiento #${response.data.asiento} - Ingreso en Caja creado correctamente`); resetForm(); }
      else alert('❌ Error: ' + response.data.message);
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const importeNum = parseFloat(importe) || 0;
  const cuentaIngresoNombre = cuentasIngreso.find(c => c.id === cuentaIngreso)?.nombre || '';

  return (
    <div className={styles.fp6Container}>
      <div className={styles.fp6Header}>
        <h2><FaMoneyBillWave /> Ingreso en Caja</h2>
        <div className={styles.fp6AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp6Form}>
        <div className={styles.fp6Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Serie</label>
              <input type="text" value={serie} readOnly className={styles.fp6Readonly} />
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Nº Documento *</label>
              <input type="text" value={numDocumento} onChange={e => setNumDocumento(e.target.value)} placeholder="Número de documento" required />
            </div>
          </div>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Concepto *</label>
              <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción del ingreso" required />
            </div>
          </div>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Fecha de Registro *</label>
              <input type="date" value={fechaReg} onChange={e => setFechaReg(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className={styles.fp6Section}>
          <h3>Importe</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Código Analítico</label>
              <input type="text" value={analitico} readOnly className={styles.fp6Readonly} />
              <small>Igual a Serie</small>
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Cuenta de Ingreso *</label>
              <select value={cuentaIngreso} onChange={e => setCuentaIngreso(e.target.value)} required>
                <option value="">-- Selecciona cuenta --</option>
                {cuentasIngreso.map(c => (
                  <option key={c.id} value={c.id}>{c.id} - {c.nombre}</option>
                ))}
              </select>
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Importe *</label>
              <input type="number" step="0.01" min="0.01" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" required />
            </div>
          </div>
        </div>

        <div className={styles.fp6Section}>
          <h3>Archivo Adjunto</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Ruta Completa del Justificante</label>
              <input type="text" value={archivo} onChange={e => setArchivo(e.target.value)} placeholder="Ej: C:\Carpeta\justificante.pdf" className={styles.fp6FileInput} />
              {archivo && <div className={styles.fp6FileName}>✅ Ruta: <strong>{archivo}</strong></div>}
            </div>
          </div>
        </div>

        <div className={styles.fp6Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp6Resumen}>
            <div className={styles.fp6ResumenItem}>
              <span className={styles.fp6DebeHaber}>DEBE</span>
              <span className={styles.fp6CuentaInfo}>{cuentaCaja} - Caja</span>
              <span className={styles.fp6Importe}>{importeNum.toFixed(2)} €</span>
            </div>
            <div className={styles.fp6ResumenItem}>
              <span className={styles.fp6DebeHaber}>HABER</span>
              <span className={styles.fp6CuentaInfo}>
                {cuentaIngreso ? `${cuentaIngreso} - ${cuentaIngresoNombre}` : '-- Sin seleccionar --'}
              </span>
              <span className={styles.fp6Importe}>{importeNum.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <div className={styles.fp6ButtonGroup}>
          <button type="button" className={styles.fp6CancelBtn} onClick={() => window.history.back()} disabled={loading}>← Volver</button>
          <button type="button" className={styles.fp6ClearBtn} onClick={resetForm} disabled={loading}>Limpiar</button>
          <button type="submit" className={styles.fp6SubmitBtn} disabled={loading || !importe || !concepto || !numDocumento || !cuentaIngreso}>
            {loading ? 'Procesando...' : 'Crear Asiento de Ingreso'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Form6;
