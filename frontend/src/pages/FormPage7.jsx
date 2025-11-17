// pages/FormPage7.jsx - VERSIÓN MODIFICADA (CAMPOS ELIMINADOS)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaReceipt, FaPlus, FaTrash } from 'react-icons/fa';
import styles from '../styles/FormPage7.module.css';
import config from '../config/config';

const FormPage7 = ({ user }) => {
  // Estados base
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  
  // DATOS ANALÍTICOS FIJOS desde tabla Clientes (sesión)
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

  // CAMPOS UNIFICADOS DE DOCUMENTO (CAMPOS ELIMINADOS)
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Cuentas de gasto (6xx) desde BD
  const [cuentasGasto, setCuentasGasto] = useState([]);
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [importe, setImporte] = useState('');

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
        // Obtener datos de la sesión que ahora incluye todos los campos analíticos
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { 
          withCredentials: true 
        });

        if (sessionRes.data.authenticated) {
          const userData = sessionRes.data.user;
          
          // SERIE Y ANALITICO FIJOS + 'C' al principio de la serie
          const serieCliente = userData.codigoCanal || 'EM';
          const analiticoCliente = userData.idDelegacion || 'EM';
          const serieConC = `C${serieCliente}`;
          
          setSerieBase(serieCliente);
          setSerie(serieConC);
          setAnalitico(analiticoCliente);
          setCuentaCaja(userData.cuentaCaja || '570000000');
          
          setDatosAnaliticos({
            codigoCanal: userData.codigoCanal || '',
            codigoProyecto: userData.codigoProyecto || '',
            codigoSeccion: userData.codigoSeccion || '',
            codigoDepartamento: userData.codigoDepartamento || '',
            idDelegacion: userData.idDelegacion || ''
          });

          console.log(`✅ FormPage7 - Datos analíticos cargados:`, {
            serie: serieConC,
            analitico: analiticoCliente,
            cuentaCaja: userData.cuentaCaja,
            canal: userData.codigoCanal,
            proyecto: userData.codigoProyecto,
            seccion: userData.codigoSeccion,
            departamento: userData.codigoDepartamento,
            delegacion: userData.idDelegacion
          });
        }

        // Cargar cuentas de gasto
        const gastosRes = await axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true });
        
        setCuentasGasto(gastosRes.data || []);
        
        // Establecer primera cuenta de gasto por defecto si existe
        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        // Valores por defecto en caso de error
        setSerie('CEM');
        setAnalitico('EM');
        setCuentaCaja('570000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(`C:\\Users\\${user?.usuario || 'Usuario'}\\Desktop\\${file.name}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación
    const errores = [];
    if (!numDocumento.trim()) errores.push('El número de documento es obligatorio');
    if (!concepto.trim()) errores.push('El concepto es obligatorio');
    if (!cuentaGasto) errores.push('Debe seleccionar una cuenta de gasto');
    if (!importe || parseFloat(importe) <= 0) errores.push('El importe debe ser mayor a 0');
    
    if (errores.length > 0) {
      alert('Errores en el formulario:\n• ' + errores.join('\n• '));
      return;
    }

    setLoading(true);

    try {
      const datosEnvio = {
        // DATOS DE DOCUMENTO UNIFICADOS (CAMPOS ELIMINADOS)
        serie,
        numDocumento,
        fechaReg,
        concepto,
        comentario: concepto,
        
        // DATOS ESPECÍFICOS
        analitico,
        cuentaGasto,
        cuentaCaja,
        importe: parseFloat(importe),
        archivo
      };

      console.log('📤 Enviando datos FormPage7:', datosEnvio);

      const response = await axios.post(
        `${config.apiBaseUrl}/api/asiento/gasto-directo-caja`, 
        datosEnvio, 
        { withCredentials: true }
      );

      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Gasto Directo en Caja creado correctamente`);
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
    
    // Restablecer cuenta de gasto
    if (cuentasGasto.length > 0) {
      setCuentaGasto(cuentasGasto[0].id);
    }
    
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

  // Obtener nombre de la cuenta seleccionada
  const getNombreCuentaGasto = () => {
    const cuenta = cuentasGasto.find(c => c.id === cuentaGasto);
    return cuenta ? cuenta.nombre : '';
  };

  return (
    <div className={styles.fp7Container}>
      <div className={styles.fp7Header}>
        <h2>
          <FaReceipt />
          Gasto Directo en Caja
        </h2>
        <div className={styles.fp7AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp7Form}>
        {/* SECCIÓN DE DATOS DEL DOCUMENTO - SIMPLIFICADA */}
        <div className={styles.fp7Section}>
          <h3>📄 Datos del Documento</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                readOnly
                className={styles.fp7Readonly}
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento/ticket"
                required
              />
            </div>
          </div>
          
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del gasto"
                required
              />
            </div>
          </div>

          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
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

        {/* SECCIÓN DE IMPORTE Y CUENTA */}
        <div className={styles.fp7Section}>
          <h3>💰 Importe y Cuenta</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Cuenta de Gasto *</label>
              <select
                value={cuentaGasto}
                onChange={(e) => setCuentaGasto(e.target.value)}
                required
              >
                <option value="">-- Seleccionar cuenta de gasto --</option>
                {cuentasGasto.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.id} - {cuenta.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.fp7FormGroup}>
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

        {/* SECCIÓN DE ARCHIVO */}
        <div className={styles.fp7Section}>
          <h3>📎 Archivo Adjunto</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Justificante</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp7FileInput}
              />
              {archivo && (
                <span className={styles.fp7FileName}>📄 {archivo.split('\\').pop()}</span>
              )}
            </div>
          </div>
        </div>

        {/* RESUMEN DEL ASIENTO */}
        <div className={styles.fp7Section}>
          <h3>📊 Resumen del Asiento</h3>
          <div className={styles.fp7Resumen}>
            <div className={styles.fp7ResumenItem}>
              <span className={styles.fp7DebeHaber}>DEBE</span>
              <span className={styles.fp7CuentaInfo}>
                {cuentaGasto} - {getNombreCuentaGasto()}
              </span>
              <span className={styles.fp7Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
            <div className={styles.fp7ResumenItem}>
              <span className={styles.fp7DebeHaber}>HABER</span>
              <span className={styles.fp7CuentaInfo}>
                {cuentaCaja} - Caja
              </span>
              <span className={styles.fp7Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
          </div>
        </div>

        {/* BOTONES */}
        <div className={styles.fp7ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp7CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            ← Volver
          </button>
          <button 
            type="button" 
            className={styles.fp7ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            🗑️ Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp7SubmitBtn} 
            disabled={loading || !importe || !cuentaGasto || !concepto || !numDocumento}
          >
            {loading ? '⏳ Procesando...' : '✅ Crear Asiento de Gasto'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage7;