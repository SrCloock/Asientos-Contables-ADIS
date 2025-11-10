// pages/FormPage5.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHandHoldingUsd } from 'react-icons/fa';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

const FormPage5 = ({ user }) => {
  // Estados del FormPage1 (documento y proveedor)
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Campos de documento (igual que FormPage1)
  const [serie, setSerie] = useState(user?.serie || 'PAG');
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Campos de proveedor (igual que FormPage1)
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '', cuenta: '' });
  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');
  const isNuevoProveedor = cuentaP === '4000';
  
  // Campos específicos para el pago
  const [importePago, setImportePago] = useState('');

  // Efectos (igual que FormPage1)
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
    const fetchProveedores = async () => {
      try {
        const [proveedoresRes, cuentasRes] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true })
        ]);
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
      } catch (error) {
        console.error('Error cargando proveedores:', error);
      }
    };
    fetchProveedores();
  }, []);

  // Actualizar datos proveedor (igual que FormPage1)
  useEffect(() => {
    if (cuentaP && cuentaP !== '4000') {
      const proveedor = proveedores.find(p => p.codigo === cuentaP);
      const cuentaProv = proveedoresCuentas.find(p => p.codigo === cuentaP);
      
      if (proveedor) {
        setDatosCuentaP({
          cif: proveedor.cif || '',
          nombre: proveedor.nombre || '',
          cp: proveedor.cp || '',
          cuenta: cuentaProv?.cuenta || '400000000'
        });
      }
    } else if (cuentaP === '4000') {
      setDatosCuentaP({
        cif: inputCIF,
        nombre: inputNombre,
        cp: inputCP,
        cuenta: inputCuenta || '400000000'
      });
    }
  }, [cuentaP, proveedores, proveedoresCuentas, inputCIF, inputNombre, inputCP, inputCuenta]);

  // Manejo de archivos
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(`C:\\Users\\${user?.usuario || 'Usuario'}\\Desktop\\${file.name}`);
    }
  };

  // Envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!cuentaP || !numDocumento || !importePago) {
      alert('Por favor complete los campos obligatorios');
      return;
    }

    setLoading(true);

    try {
      const datosEnvio = {
        // Datos de documento
        serie,
        numDocumento,
        fechaReg,
        
        // Datos de proveedor
        proveedor: {
          cuentaProveedor: isNuevoProveedor ? '400000000' : cuentaP,
          cif: isNuevoProveedor ? inputCIF : datosCuentaP.cif,
          nombre: isNuevoProveedor ? inputNombre : datosCuentaP.nombre,
          cp: isNuevoProveedor ? inputCP : datosCuentaP.cp
        },
        
        // Datos específicos del pago
        importePago: parseFloat(importePago),
        concepto,
        
        // Archivo
        archivo: archivo
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/pago-caja-proveedor`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`Asiento #${response.data.asiento} - Pago en Caja a Proveedor creado correctamente`);
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
    setCuentaP('');
    setDatosCuentaP({ cif: '', nombre: '', cp: '', cuenta: '' });
    setInputCuenta('');
    setInputCIF('');
    setInputNombre('');
    setInputCP('');
    setNumDocumento('');
    setImportePago('');
    setConcepto('');
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
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2>
          <FaHandHoldingUsd />
          Pago en Caja a Proveedor
        </h2>
        <div className={styles.fp5AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp5Form}>
        {/* Sección de Datos del Documento */}
        <div className={styles.fp5Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="PAG, etc."
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento"
                required
              />
            </div>
            <div className={styles.fp5FormGroup}>
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

        {/* Sección de Datos del Proveedor */}
        <div className={styles.fp5Section}>
          <h3>Datos del Proveedor</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Seleccionar Proveedor *</label>
              <select
                value={cuentaP}
                onChange={(e) => setCuentaP(e.target.value)}
                required
              >
                <option value="">-- Seleccionar proveedor --</option>
                {proveedores.map(prov => (
                  <option key={prov.codigo} value={prov.codigo}>
                    {prov.codigo} - {prov.nombre}
                  </option>
                ))}
                <option value="4000">-- NUEVO PROVEEDOR --</option>
              </select>
            </div>
          </div>

          {!isNuevoProveedor ? (
            // Mostrar datos del proveedor seleccionado
            <div className={styles.fp5FormRow}>
              <div className={styles.fp5FormGroup}>
                <label>CIF/NIF</label>
                <input 
                  type="text" 
                  value={datosCuentaP.cif}
                  readOnly
                  className={styles.fp5Readonly}
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Razón Social</label>
                <input 
                  type="text" 
                  value={datosCuentaP.nombre}
                  readOnly
                  className={styles.fp5Readonly}
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Código Postal</label>
                <input 
                  type="text" 
                  value={datosCuentaP.cp}
                  readOnly
                  className={styles.fp5Readonly}
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Cuenta Contable</label>
                <input 
                  type="text" 
                  value={datosCuentaP.cuenta}
                  readOnly
                  className={styles.fp5Readonly}
                />
              </div>
            </div>
          ) : (
            // Campos para nuevo proveedor
            <div className={styles.fp5FormRow}>
              <div className={styles.fp5FormGroup}>
                <label>CIF/NIF *</label>
                <input 
                  type="text" 
                  value={inputCIF}
                  onChange={(e) => setInputCIF(e.target.value)}
                  placeholder="CIF/NIF del proveedor"
                  required
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Razón Social *</label>
                <input 
                  type="text" 
                  value={inputNombre}
                  onChange={(e) => setInputNombre(e.target.value)}
                  placeholder="Nombre del proveedor"
                  required
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Código Postal</label>
                <input 
                  type="text" 
                  value={inputCP}
                  onChange={(e) => setInputCP(e.target.value)}
                  placeholder="Código postal"
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Cuenta Contable</label>
                <input 
                  type="text" 
                  value={inputCuenta}
                  onChange={(e) => setInputCuenta(e.target.value)}
                  placeholder="400000000"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sección de Importe del Pago */}
        <div className={styles.fp5Section}>
          <h3>Importe del Pago</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Concepto</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Pago factura pendiente"
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Importe a Pagar *</label>
              <input 
                type="number" 
                step="0.01"
                min="0.01"
                value={importePago}
                onChange={(e) => setImportePago(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>
        </div>

        {/* Sección de Archivo */}
        <div className={styles.fp5Section}>
          <h3>Archivo</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Adjuntar Archivo</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp5FileInput}
              />
              {archivo && (
                <span className={styles.fp5FileName}>{archivo}</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumen del Asiento */}
        <div className={styles.fp5Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{datosCuentaP.cuenta} - Proveedores</span>
              <span>{importePago ? parseFloat(importePago).toFixed(2) + ' €' : '0.00 €'}</span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>570000000 - Caja</span>
              <span>{importePago ? parseFloat(importePago).toFixed(2) + ' €' : '0.00 €'}</span>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className={styles.fp5ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp5CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className={styles.fp5ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp5SubmitBtn} 
            disabled={loading || !cuentaP || !numDocumento || !importePago}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;