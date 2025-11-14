// pages/FormPage7.jsx - VERSIÓN CORREGIDA Y UNIFICADA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaReceipt, FaPlus, FaTrash } from 'react-icons/fa';
import styles from '../styles/FormPage7.module.css';
import config from '../config/config';

const FormPage7 = ({ user }) => {
  // Estados base
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // SERIE Y ANALITICO FIJOS desde tabla Clientes + 'C' al principio
  const [serieBase, setSerieBase] = useState('');
  const [serie, setSerie] = useState('');
  const [analitico, setAnalitico] = useState('');
  
  // CUENTA CAJA desde tabla Clientes
  const [cuentaCaja, setCuentaCaja] = useState('');

  // CAMPOS UNIFICADOS DE DOCUMENTO (iguales a otros formularios)
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // CAMPOS DE PROVEEDOR (iguales a otros formularios)
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ 
    cif: '', 
    nombre: '', 
    cp: '', 
    cuentaContable: ''
  });
  
  const isNuevoProveedor = cuentaP === '4000';

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
        const [
          proveedoresRes, 
          cuentasRes, 
          gastosRes,
          canalRes,
          cuentaCajaRes
        ] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cliente/canal`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cliente/cuenta-caja`, { withCredentials: true })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
        setCuentasGasto(gastosRes.data || []);
        
        // SERIE Y ANALITICO FIJOS + 'C' al principio de la serie
        const serieCliente = canalRes.data?.serie || 'ERROR';
        const analiticoCliente = canalRes.data?.analitico || 'ERROR';
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

  // ACTUALIZADO: Manejo de proveedor - USAR CUENTA CONTABLE REAL
  useEffect(() => {
    if (cuentaP) {
      if (cuentaP === '4000') {
        // NUEVO PROVEEDOR - Campos editables
        setDatosCuentaP({
          cif: '',
          nombre: '',
          cp: '',
          cuentaContable: '400000000'
        });
      } else {
        // Proveedor existente
        const proveedor = proveedores.find(p => p.codigo === cuentaP);
        const cuentaProv = proveedoresCuentas.find(p => p.codigo === cuentaP);
        
        if (proveedor) {
          setDatosCuentaP({
            cif: proveedor.cif || '',
            nombre: proveedor.nombre || '',
            cp: proveedor.cp || '',
            cuentaContable: cuentaProv?.cuenta || '400000000'
          });
        }
      }
    }
  }, [cuentaP, proveedores, proveedoresCuentas]);

  // MANEJO DE CAMPOS EDITABLES PARA NUEVO PROVEEDOR
  const handleDatosProveedorChange = (field, value) => {
    if (isNuevoProveedor) {
      setDatosCuentaP(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

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
        // DATOS DE DOCUMENTO UNIFICADOS
        serie,
        numDocumento,
        numFRA,
        fechaReg,
        fechaFactura,
        fechaOper,
        concepto,
        comentario: concepto,
        
        // DATOS DE PROVEEDOR
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || '400000000',
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp
        },
        
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
    setCuentaP('');
    setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '' });
    setNumDocumento('');
    setNumFRA('');
    setConcepto('');
    setFechaOper('');
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

  return (
    <div className={styles.fp7Container}>
      <div className={styles.fp7Header}>
        <h2>
          <FaReceipt />
          Gasto Directo en Caja - UNIFICADO
        </h2>
        <div className={styles.fp7AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Analítico: <strong>{analitico}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp7Form}>
        {/* SECCIÓN DE DATOS DEL DOCUMENTO - UNIFICADA */}
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
            <div className={styles.fp7FormGroup}>
              <label>Nº Factura Proveedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor"
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
            <div className={styles.fp7FormGroup}>
              <label>Fecha de Factura *</label>
              <input
                type="date"
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                required
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Fecha de Operación</label>
              <input
                type="date"
                value={fechaOper}
                onChange={(e) => setFechaOper(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN DE PROVEEDOR - UNIFICADA */}
        <div className={styles.fp7Section}>
          <h3>👥 Datos del Proveedor</h3>
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>Seleccionar Proveedor</label>
              <select
                value={cuentaP}
                onChange={(e) => setCuentaP(e.target.value)}
              >
                <option value="">-- Seleccionar proveedor --</option>
                <option value="4000">➕ NUEVO PROVEEDOR (400000000)</option>
                {proveedores.map(prov => (
                  <option key={prov.codigo} value={prov.codigo}>
                    {prov.codigo} - {prov.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CAMPOS DE PROVEEDOR - EDITABLES SI ES NUEVO */}
          <div className={styles.fp7FormRow}>
            <div className={styles.fp7FormGroup}>
              <label>CIF/NIF {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                onChange={(e) => handleDatosProveedorChange('cif', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp7Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Razón Social {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp7Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                onChange={(e) => handleDatosProveedorChange('cp', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp7Readonly : ''}
              />
            </div>
            <div className={styles.fp7FormGroup}>
              <label>Cuenta Contable Real</label>
              <input 
                type="text" 
                value={datosCuentaP.cuentaContable}
                readOnly
                className={styles.fp7Readonly}
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