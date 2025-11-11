// pages/FormPage7.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaReceipt, FaEuroSign, FaWallet } from 'react-icons/fa';
import styles from '../styles/FormPage7.module.css';
import config from '../config/config';

const FormPage7 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Campos del formulario
  const [serie, setSerie] = useState('GAS');
  const [numDocumento, setNumDocumento] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [cuentaGasto, setCuentaGasto] = useState('600000000');
  const [importe, setImporte] = useState('');
  const [archivo, setArchivo] = useState(null);

  // Cuentas de gasto (6xx) - Más completas
  const CUENTAS_GASTO = [
    { id: '600000000', nombre: 'Compras de mercaderías' },
    { id: '601000000', nombre: 'Compras de materias primas' },
    { id: '602000000', nombre: 'Compras de otros aprovisionamientos' },
    { id: '606000000', nombre: 'Descuentos sobre compras' },
    { id: '610000000', nombre: 'Variación de existencias' },
    { id: '621000000', nombre: 'Arrendamientos y cánones' },
    { id: '622000000', nombre: 'Reparaciones y conservación' },
    { id: '623000000', nombre: 'Servicios de profesionales independientes' },
    { id: '624000000', nombre: 'Transportes' },
    { id: '625000000', nombre: 'Primas de seguros' },
    { id: '626000000', nombre: 'Servicios bancarios y similares' },
    { id: '627000000', nombre: 'Publicidad, propaganda y relaciones públicas' },
    { id: '628000000', nombre: 'Suministros (Agua, luz, gas, teléfono)' },
    { id: '629000000', nombre: 'Otros servicios' },
    { id: '630000000', nombre: 'Impuestos (IAE, IVA no deducible, etc.)' },
    { id: '631000000', nombre: 'Tributos' },
    { id: '640000000', nombre: 'Sueldos y salarios' },
    { id: '641000000', nombre: 'Indemnizaciones' },
    { id: '642000000', nombre: 'Seguridad Social a cargo de la empresa' },
    { id: '649000000', nombre: 'Otros gastos sociales' },
    { id: '650000000', nombre: 'Pérdidas de créditos comerciales' },
    { id: '651000000', nombre: 'Otros servicios' },
    { id: '652000000', nombre: 'Suscripciones, cuotas y donativos' },
    { id: '653000000', nombre: 'Primas de seguro' },
    { id: '654000000', nombre: 'Pérdidas procedentes del inmovilizado' },
    { id: '659000000', nombre: 'Otros gastos de gestión' },
    { id: '660000000', nombre: 'Gastos financieros' },
    { id: '665000000', nombre: 'Intereses por descuento de efectos' },
    { id: '669000000', nombre: 'Otros gastos financieros' },
    { id: '670000000', nombre: 'Pérdidas procedentes de activos no corrientes' },
    { id: '671000000', nombre: 'Pérdidas por operaciones con acciones' },
    { id: '672000000', nombre: 'Gastos excepcionales' },
    { id: '679000000', nombre: 'Otros gastos excepcionales' }
  ];

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
        cuentaGasto,
        importe: parseFloat(importe),
        archivo
      };

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
    setCuentaGasto('600000000');
    setImporte('');
    setConcepto('');
    setNumDocumento('');
    setArchivo(null);
    
    // Actualizar contador
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
          <h2>Gasto Directo en Caja</h2>
        </div>
        <div className={styles.fp7AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
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
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="GAS, TKT, LIQ..."
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
                {CUENTAS_GASTO.map((cuenta) => (
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
                {cuentaGasto} - {CUENTAS_GASTO.find(c => c.id === cuentaGasto)?.nombre}
              </span>
              <span className={styles.fp7Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
            <div className={styles.fp7ResumenItem}>
              <span className={styles.fp7DebeHaber}>HABER</span>
              <span className={styles.fp7CuentaInfo}>
                <FaWallet /> 570000000 - Caja (Fijo)
              </span>
              <span className={styles.fp7Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
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