// pages/FormPage6.jsx - VERSIÓN SIMPLIFICADA CON CUENTA FIJA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaMoneyBillWave } from 'react-icons/fa';
import styles from '../styles/FormPage6.module.css';
import config from '../config/config';

const FormPage6 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  const [serieBase, setSerieBase] = useState('');
  const [serie, setSerie] = useState('');
  const [analitico, setAnalitico] = useState('');
  const [cuentaCaja, setCuentaCaja] = useState('');
  const [datosAnaliticos, setDatosAnaliticos] = useState({
    codigoCanal: '',
    codigoProyecto: '',
    codigoSeccion: '',
    codigoDepartamento: '',
    idDelegacion: ''
  });
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [importe, setImporte] = useState('');

  // CUENTA FIJA - Eliminamos el estado de selección de cuentas
  const cuentaIngresoFija = '519000000';

  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, {
          withCredentials: true
        });
        setNumAsiento(response.data.contador);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    
    fetchContador();
  }, []);

  useEffect(() => {
    const fetchDatosMaestros = async () => {
      try {
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { 
          withCredentials: true 
        });

        if (sessionRes.data.authenticated) {
          const userData = sessionRes.data.user;
          const serieCliente = userData.codigoCanal || 'EM';
          const serieConC = `C${serieCliente}`;
          
          setSerieBase(serieCliente);
          setSerie(serieConC);
          setAnalitico(serieConC);
          setCuentaCaja(userData.cuentaCaja || '570000000');
          
          setDatosAnaliticos({
            codigoCanal: userData.codigoCanal || '',
            codigoProyecto: userData.codigoProyecto || '',
            codigoSeccion: userData.codigoSeccion || '',
            codigoDepartamento: userData.codigoDepartamento || '',
            idDelegacion: userData.idDelegacion || ''
          });
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        const defaultValue = 'CEM';
        setSerie(defaultValue);
        setAnalitico(defaultValue);
        setCuentaCaja('570000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // Manejo de archivos
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(file.name);
      console.log(`📄 Archivo seleccionado: ${file.name}`);
    }
  };

  const formatFechaForBackend = (fechaString) => {
    if (!fechaString) return '';
    
    const fecha = new Date(fechaString);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errores = [];
    if (!numDocumento.trim()) errores.push('El número de documento es obligatorio');
    if (!concepto.trim()) errores.push('El concepto es obligatorio');
    if (!importe || parseFloat(importe) <= 0) errores.push('El importe debe ser mayor a 0');
    
    if (errores.length > 0) {
      alert('Errores en el formulario:\n• ' + errores.join('\n• '));
      return;
    }

    setLoading(true);

    try {
      const fechaRegFormatted = formatFechaForBackend(fechaReg);

      console.log('📅 FECHA ENVIADA AL BACKEND:', fechaRegFormatted);

      const datosEnvio = {
        serie,
        numDocumento,
        fechaReg: fechaRegFormatted,
        concepto,
        comentario: concepto.trim().substring(0, 40),
        analitico,
        // ELIMINADO: cuentaIngreso, // Ya no enviamos este campo
        cuentaCaja,
        importe: parseFloat(importe),
        archivo: archivo
      };

      console.log('📤 Enviando datos FormPage6:', datosEnvio);

      const response = await axios.post(
        `${config.apiBaseUrl}/api/asiento/ingreso-caja`, 
        datosEnvio, 
        { withCredentials: true }
      );

      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Ingreso en Caja creado correctamente`);
        resetForm();
      } else {
        alert('❌ Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento:', error);
      alert('❌ Error al crear el asiento: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNumDocumento('');
    setConcepto('');
    setImporte('');
    setArchivo(null);
    
    const fetchNewContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, { 
          withCredentials: true 
        });
        setNumAsiento(response.data.contador);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    fetchNewContador();
  };

  return (
    <div className={styles.fp6Container}>
      <div className={styles.fp6Header}>
        <h2>
          <FaMoneyBillWave />
          Ingreso en Caja
        </h2>
        <div className={styles.fp6AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp6Form}>
        <div className={styles.fp6Section}>
          <h3>📄 Datos del Documento</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                readOnly
                className={styles.fp6Readonly}
              />
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento"
                required
              />
            </div>
          </div>
          
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del ingreso"
                required
              />
            </div>
          </div>

          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Fecha de Registro *</label>
              <input
                type="date"
                value={fechaReg}
                onChange={(e) => setFechaReg(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.fp6Section}>
          <h3>💰 Importe</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Código Analítico</label>
              <input 
                type="text" 
                value={analitico}
                readOnly
                className={styles.fp6Readonly}
              />
              <small>Valor fijo (igual a Serie)</small>
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Cuenta de Ingreso</label>
              <input 
                type="text" 
                value="519000000 - Ingresos Varios"
                readOnly
                className={styles.fp6Readonly}
              />
              <small>Cuenta fija para todos los ingresos</small>
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Importe *</label>
              <input 
                type="number" 
                step="0.01"
                min="0.01"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>
        </div>

        {/* Sección de Archivo */}
        <div className={styles.fp6Section}>
          <h3>📎 Archivo Adjunto</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Justificante</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp6FileInput}
              />
              <div className={styles.fp6FileInfo}>
                <small>
                  📁 <strong>IMPORTANTE:</strong> El archivo debe estar guardado en:<br />
                  <code>C:\Users\sageinstall.MERIDIANOS-SSCC\Desktop\DocumentosSage\</code>
                </small>
                {archivo && (
                  <div className={styles.fp6FileName}>
                    ✅ Archivo seleccionado: <strong>{archivo}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.fp6Section}>
          <h3>📊 Resumen del Asiento</h3>
          <div className={styles.fp6Resumen}>
            <div className={styles.fp6ResumenItem}>
              <span className={styles.fp6DebeHaber}>DEBE</span>
              <span className={styles.fp6CuentaInfo}>
                {cuentaCaja} - Caja
              </span>
              <span className={styles.fp6Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
            <div className={styles.fp6ResumenItem}>
              <span className={styles.fp6DebeHaber}>HABER</span>
              <span className={styles.fp6CuentaInfo}>
                519000000 - Ingresos Varios
              </span>
              <span className={styles.fp6Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.fp6ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp6CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            ← Volver
          </button>
          <button 
            type="button" 
            className={styles.fp6ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            🗑️ Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp6SubmitBtn} 
            disabled={loading || !importe || !concepto || !numDocumento}
          >
            {loading ? '⏳ Procesando...' : '✅ Crear Asiento de Ingreso'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage6;