// pages/FormPage6.jsx - VERSIÓN CORREGIDA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaMoneyBillWave } from 'react-icons/fa';
import styles from '../styles/FormPage6.module.css';
import config from '../config/config';

const FormPage6 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Campos de documento
  const [serie, setSerie] = useState('ING');
  const [numDocumento, setNumDocumento] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Campo único para importe (ya no necesitamos cuentaIngreso)
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(`C:\\Users\\${user?.usuario || 'Usuario'}\\Desktop\\${file.name}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones simplificadas
    if (!importe || !concepto || !numDocumento) {
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
        importe: parseFloat(importe),
        archivo
        // ❌ Eliminado: cuentaIngreso
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/ingreso-caja`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Ingreso en Caja creado correctamente\n\n` +
              `DEBE: 570000000 - Caja\n` +
              `HABER: 519000000 - Responsable de caja\n` +
              `Importe: ${parseFloat(importe).toFixed(2)} €`);
        resetForm();
      } else {
        alert('Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento:', error);
      alert('Error al crear el asiento: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setImporte('');
    setConcepto('');
    setNumDocumento('');
    setArchivo(null);
    
    const fetchNewContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, { withCredentials: true });
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
          Ingreso en Caja - Entrada de Efectivo
        </h2>
        <div className={styles.fp6AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp6Form}>
        {/* Sección de Datos del Documento */}
        <div className={styles.fp6Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="ING, etc."
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
            <div className={styles.fp6FormGroup}>
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

        {/* Sección de Importe - SIMPLIFICADA */}
        <div className={styles.fp6Section}>
          <h3>Datos del Ingreso</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del ingreso (ventas, servicios, etc.)"
                required
              />
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
          <h3>Archivo</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Adjuntar Archivo</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp6FileInput}
              />
              {archivo && (
                <span className={styles.fp6FileName}>{archivo}</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumen del Asiento - CORREGIDO */}
        <div className={styles.fp6Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp6Resumen}>
            <div className={styles.fp6ResumenItem}>
              <span>DEBE:</span>
              <span>570000000 - Caja</span>
              <span>{importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}</span>
            </div>
            <div className={styles.fp6ResumenItem}>
              <span>HABER:</span>
              <span>519000000 - Responsable de caja</span>
              <span>{importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}</span>
            </div>
            <div className={styles.fp6InfoBox}>
              <p><strong>💡 Nota:</strong> Este asiento registra la entrada de dinero en efectivo a caja. 
              La contrapartida se registra automáticamente en la cuenta del responsable de caja (519000000).</p>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className={styles.fp6ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp6CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className={styles.fp6ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp6SubmitBtn} 
            disabled={loading || !importe || !concepto || !numDocumento}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage6;