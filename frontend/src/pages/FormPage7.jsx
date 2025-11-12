// pages/FormPage7.jsx - VERSIÓN COMPLETA Y CORREGIDA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaReceipt, FaEuroSign, FaWallet } from 'react-icons/fa';
import styles from '../styles/FormPage7.module.css';
import config from '../config/config';

const FormPage7 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  
  // SERIE Y ANALITICO FIJOS desde tabla Clientes + 'C' al principio
  const [serieBase, setSerieBase] = useState('');
  const [serie, setSerie] = useState('');
  const [analitico, setAnalitico] = useState('');
  
  // CUENTA CAJA desde tabla Clientes
  const [cuentaCaja, setCuentaCaja] = useState('');
  
  // Campos del formulario
  const [numDocumento, setNumDocumento] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [importe, setImporte] = useState('');
  const [archivo, setArchivo] = useState(null);

  // Cuentas de gasto (6xx) desde BD
  const [cuentasGasto, setCuentasGasto] = useState([]);

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
        const [
          gastosRes,
          canalRes,
          cuentaCajaRes
        ] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cliente/canal`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cliente/cuenta-caja`, { withCredentials: true })
        ]);
        
        setCuentasGasto(gastosRes.data || []);
        
        // SERIE Y ANALITICO FIJOS + 'C' al principio de la serie
        const serieCliente = canalRes.data?.serie || 'EM';
        const analiticoCliente = canalRes.data?.analitico || 'EM';
        const serieConC = `C${serieCliente}`;
        
        setSerieBase(serieCliente);
        setSerie(serieConC);
        setAnalitico(analiticoCliente);
        
        // CUENTA CAJA
        setCuentaCaja(cuentaCajaRes.data?.cuentaCaja || '570000000');
        
        // Establecer primera cuenta de gasto por defecto si existe
        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        }
        
        console.log(`✅ FormPage7 - Serie: ${serieConC} (base: ${serieCliente}), Analítico: ${analiticoCliente}, Caja: ${cuentaCajaRes.data?.cuentaCaja}`);
        
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
    
    if (!cuentaGasto || !importe || !concepto || !numDocumento) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    if (parseFloat(importe) <= 0) {
      alert('El importe debe ser mayor a 0');
      return;
    }

    setLoading(true);

    try {
      const datosEnvio = {
        serie,
        numDocumento,
        fecha,
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
    setCuentaGasto(cuentasGasto.length > 0 ? cuentasGasto[0].id : '');
    setImporte('');
    setConcepto('');
    setNumDocumento('');
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
    <div className={styles.fp7Container}>
      <div className={styles.fp7Header}>
        <div className={styles.fp7Title}>
          <FaReceipt className={styles.fp7Icon} />
          <h2>Gasto Directo en Caja - CORREGIDO</h2>
        </div>
        <div className={styles.fp7AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Analítico: <strong>{analitico}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <div className={styles.fp7Description}>
        <p>
          <strong>Objetivo:</strong> Registrar un gasto pagado directamente en efectivo 
          (Sin factura, pero con liquidación de gasto, ticket u otro justificante).
        </p>
        <div className={styles.fp7AsientoType}>
          <span><strong>Asiento:</strong> DEBE → 6xx (Gasto con IVA incluido) | HABER → 570 (Caja)</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp7Form}>
        {/* Sección de Datos del Documento */}
        <div className={styles.fp7Section}>
          <h3>📄 Datos del Documento</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Serie (C + Serie usuario)</label>
              <input 
                type="text" 
                value={serie}
                readOnly
                className={styles.fp7Readonly}
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Nº Documento * (Va a NumeroDoc)</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento/ticket"
                required
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Sección de Importe y Cuenta */}
        <div className={styles.fp7Section}>
          <h3>💰 Importe y Cuenta</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del gasto (ticket, liquidación, etc.)"
                required
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>
                <FaEuroSign /> Importe (IVA Incluido) *
              </label>
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
          </div>
        </div>

        {/* Sección de Archivo */}
        <div className={styles.fp7Section}>
          <h3>📎 Archivo Adjunto</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Justificante (Ticket, Liquidación, etc.)</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp7FileInput}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {archivo && (
                <span className={styles.fp7FileName}>📄 {archivo.split('\\').pop()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumen del Asiento */}
        <div className={styles.fp7Section}>
          <h3>📊 Resumen del Asiento</h3>
          <div className={styles.fp7Resumen}>
            <div className={styles.fp7ResumenItem}>
              <span className={styles.fp7DebeHaber}>DEBE</span>
              <span className={styles.fp7CuentaInfo}>
                {cuentaGasto} - {cuentasGasto.find(c => c.id === cuentaGasto)?.nombre}
              </span>
              <span className={styles.fp7Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
            <div className={styles.fp7ResumenItem}>
              <span className={styles.fp7DebeHaber}>HABER</span>
              <span className={styles.fp7CuentaInfo}>
                <FaWallet /> {cuentaCaja} - Caja
              </span>
              <span className={styles.fp7Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
          </div>
          
          <div className={styles.fp7InfoBox}>
            <p><strong>✅ Correcciones aplicadas:</strong></p>
            <ul>
              <li>Serie con 'C': <strong>{serie}</strong> (base: {serieBase})</li>
              <li>Analítico fijo: <strong>{analitico}</strong> (desde tabla Clientes)</li>
              <li>Nº Documento va a columna <strong>NumeroDoc</strong></li>
              <li>Cuentas 6xx desde BD</li>
              <li>Cuenta caja del cliente: <strong>{cuentaCaja}</strong></li>
            </ul>
          </div>
        </div>

        {/* Botones */}
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