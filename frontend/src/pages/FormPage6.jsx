// pages/FormPage6.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaMoneyBillWave } from 'react-icons/fa';
import styles from '../styles/FormPage6.module.css';
import config from '../config/config';

const FormPage6 = ({ user }) => {
  // Estados similares al FormPage2
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Campos de documento (similar a FormPage2)
  const [serie, setSerie] = useState('ING');
  const [numDocumento, setNumDocumento] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Campos específicos para el ingreso
  const [cuentaIngreso, setCuentaIngreso] = useState('');
  const [importe, setImporte] = useState('');

  // Cuentas de ingreso (similares a las del FormPage2)
  const CUENTAS_INGRESO = [
    { id: '700000000', nombre: 'Ventas de mercaderías' },
    { id: '701000000', nombre: 'Ventas de productos terminados' },
    { id: '702000000', nombre: 'Ventas de productos semi-terminados' },
    { id: '703000000', nombre: 'Ventas de subproductos y residuos' },
    { id: '704000000', nombre: 'Ventas de envases y embalajes' },
    { id: '705000000', nombre: 'Prestaciones de servicios' },
    { id: '706000000', nombre: 'Descuentos sobre ventas por pronto pago' },
    { id: '708000000', nombre: 'Devoluciones de ventas y operaciones similares' },
    { id: '709000000', nombre: 'Rappels sobre ventas' },
    { id: '759000000', nombre: 'Ingresos por arrendamientos' },
    { id: '760000000', nombre: 'Ingresos por propiedad intelectual' },
    { id: '761000000', nombre: 'Ingresos por servicios al personal' },
    { id: '762000000', nombre: 'Ingresos por servicios profesionales' },
    { id: '769000000', nombre: 'Otros ingresos de gestión' }
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
    
    if (!cuentaIngreso || !importe || !concepto || !numDocumento) {
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
        cuentaIngreso,
        importe: parseFloat(importe),
        archivo
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/ingreso-caja`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`Asiento #${response.data.asiento} - Ingreso en Caja creado correctamente`);
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
    setCuentaIngreso('');
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
          Ingreso en Caja
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

        {/* Sección de Importe y Cuenta */}
        <div className={styles.fp6Section}>
          <h3>Importe y Cuenta</h3>
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
            <div className={styles.fp6FormGroup}>
              <label>Cuenta de Ingreso *</label>
              <select
                value={cuentaIngreso}
                onChange={(e) => setCuentaIngreso(e.target.value)}
                required
              >
                <option value="">-- Seleccionar cuenta --</option>
                {CUENTAS_INGRESO.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.id} - {cuenta.nombre}
                  </option>
                ))}
              </select>
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

        {/* Resumen del Asiento */}
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
              <span>{cuentaIngreso} - {CUENTAS_INGRESO.find(c => c.id === cuentaIngreso)?.nombre || 'Ingreso'}</span>
              <span>{importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}</span>
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
            disabled={loading || !importe || !cuentaIngreso || !concepto || !numDocumento}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage6;