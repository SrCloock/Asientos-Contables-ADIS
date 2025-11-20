// pages/FormPage7.jsx - VERSIÓN ACTUALIZADA CON SELECT CON BÚSQUEDA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaReceipt } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../styles/FormPage7.module.css';
import config from '../config/config';

const FormPage7 = ({ user }) => {
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
  const [cuentasGasto, setCuentasGasto] = useState([]);
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [importe, setImporte] = useState('');

  // Estado para react-select
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);

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

        const gastosRes = await axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true });
        setCuentasGasto(gastosRes.data || []);
        
        // Preparar opciones para select
        const gastosOpts = gastosRes.data.map(cuenta => ({
          value: cuenta.id,
          label: `${cuenta.id} - ${cuenta.nombre}`,
          cuentaData: cuenta
        }));
        setCuentasGastoOptions(gastosOpts);

        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        setSerie('CEM');
        setAnalitico('CEM');
        setCuentaCaja('570000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // Manejo de select con react-select
  const handleCuentaGastoChange = (selectedOption) => {
    if (selectedOption) {
      setCuentaGasto(selectedOption.value);
    } else {
      setCuentaGasto('');
    }
  };

  // Estilos personalizados para react-select
  const customStyles = {
    control: (base, state) => ({
      ...base,
      border: '1px solid #ccc',
      borderRadius: '4px',
      minHeight: '38px',
      fontSize: '14px',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(0, 123, 255, 0.25)' : 'none',
      borderColor: state.isFocused ? '#80bdff' : '#ccc'
    }),
    menu: (base) => ({
      ...base,
      fontSize: '14px',
      zIndex: 9999
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? '#e6f3ff' : 'white',
      color: 'black',
      fontSize: '14px',
      cursor: 'pointer'
    }),
    singleValue: (base) => ({
      ...base,
      fontSize: '14px'
    })
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(`C:\\Users\\${user?.usuario || 'Usuario'}\\Desktop\\${file.name}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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
        serie,
        numDocumento,
        fechaReg,
        concepto,
        comentario: concepto,
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
    
    if (cuentasGastoOptions.length > 0) {
      setCuentaGasto(cuentasGastoOptions[0].value);
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

        <div className={styles.fp7Section}>
          <h3>💰 Importe y Cuenta</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Cuenta de Gasto *</label>
              <Select
                options={cuentasGastoOptions}
                value={cuentasGastoOptions.find(option => option.value === cuentaGasto)}
                onChange={handleCuentaGastoChange}
                placeholder="Buscar cuenta de gasto..."
                isSearchable
                styles={customStyles}
                required
              />
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