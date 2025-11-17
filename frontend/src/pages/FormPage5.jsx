// pages/FormPage5.jsx - VERSIÓN CORREGIDA CON ANALÍTICO = SERIE
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHandHoldingUsd } from 'react-icons/fa';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

const FormPage5 = ({ user }) => {
  // Estados
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // DATOS ANALÍTICOS FIJOS desde tabla Clientes (sesión)
  const [serieBase, setSerieBase] = useState('');
  const [serie, setSerie] = useState('');
  const [analitico, setAnalitico] = useState(''); // Ahora será igual a serie
  const [cuentaCaja, setCuentaCaja] = useState('');
  const [datosAnaliticos, setDatosAnaliticos] = useState({
    codigoCanal: '',
    codigoProyecto: '',
    codigoSeccion: '',
    codigoDepartamento: '',
    idDelegacion: ''
  });
  
  // Campos de documento
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Campos de proveedor
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ 
    cif: '', 
    nombre: '', 
    cp: '', 
    cuentaContable: ''
  });
  
  const isNuevoProveedor = cuentaP === '4000';
  
  // Campos específicos para el pago
  const [importe, setImporte] = useState('');

  // Efectos para cargar datos maestros
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
          
          // SERIE Y ANALITICO FIJOS - ANALITICO = SERIE = CodigoCanal
          const serieConC = `C${userData.codigoCanal}`;
          const analiticoUsuario = userData.codigoCanal; // Analítico = CodigoCanal
          
          setSerieBase(userData.codigoCanal);
          setSerie(serieConC);
          setAnalitico(analiticoUsuario);
          setCuentaCaja(userData.cuentaCaja || '570000000');
          
          setDatosAnaliticos({
            codigoCanal: userData.codigoCanal || '',
            codigoProyecto: userData.codigoProyecto || '',
            codigoSeccion: userData.codigoSeccion || '',
            codigoDepartamento: userData.codigoDepartamento || '',
            idDelegacion: userData.idDelegacion || ''
          });

          console.log('✅ FormPage5 - Datos analíticos cargados:', {
            serie: serieConC,
            serieBase: userData.codigoCanal,
            analitico: analiticoUsuario, // Mismo que CodigoCanal
            cuentaCaja: userData.cuentaCaja,
            proyecto: userData.codigoProyecto,
            seccion: userData.codigoSeccion,
            departamento: userData.codigoDepartamento
          });
        }

        // Cargar proveedores
        const [proveedoresRes, cuentasRes] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);

      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        // Valores por defecto en caso de error
        setSerie('CEM');
        setSerieBase('EM');
        setAnalitico('EM'); // Analítico = Serie base
        setCuentaCaja('570000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // CORREGIDO: Actualizar datos proveedor - CON OPCIÓN NUEVO PROVEEDOR
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
          console.log(`✅ Proveedor seleccionado: ${proveedor.nombre}, Cuenta: ${cuentaProv?.cuenta}`);
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

  // Validación del formulario
  const validarFormulario = () => {
    const errores = [];
    
    if (!numDocumento.trim()) {
      errores.push('El número de documento es obligatorio');
    }
    if (!concepto.trim()) {
      errores.push('El concepto es obligatorio');
    }
    if (!cuentaP) {
      errores.push('Debe seleccionar un proveedor');
    }
    if (!importe || parseFloat(importe) <= 0) {
      errores.push('El importe debe ser mayor a 0');
    }
    
    // Validar campos de nuevo proveedor si es necesario
    if (isNuevoProveedor) {
      if (!datosCuentaP.cif.trim()) {
        errores.push('El CIF/NIF es obligatorio para nuevo proveedor');
      }
      if (!datosCuentaP.nombre.trim()) {
        errores.push('La razón social es obligatoria para nuevo proveedor');
      }
    }
    
    return errores;
  };

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
    
    const errores = validarFormulario();
    if (errores.length > 0) {
      alert('Errores en el formulario:\n• ' + errores.join('\n• '));
      return;
    }

    setLoading(true);

    try {
      const datosEnvio = {
        // Datos de documento
        serie,
        numDocumento,
        numFRA,
        fechaReg,
        fechaFactura,
        fechaOper,
        concepto,
        
        // Datos de proveedor - USAR CUENTA CONTABLE REAL
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || '400000000',
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp
        },
        
        // Datos específicos
        importe: parseFloat(importe),
        cuentaCaja,
        analitico, // Ahora analitico = serie base = CodigoCanal
        
        // Archivo
        archivo
      };

      console.log('📤 Enviando datos FormPage5:', {
        ...datosEnvio,
        relacionSerieAnalitico: `Serie: ${serie}, Analítico: ${analitico}, Son iguales: ${serieBase === analitico}`
      });

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/pago-proveedor`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Pago a Proveedor creado correctamente\nImporte: ${parseFloat(importe).toFixed(2)} €`);
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
          Pago a Proveedor
        </h2>
        <div className={styles.fp5AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp5Form}>
        {/* Sección de Datos del Documento */}
        <div className={styles.fp5Section}>
          <h3>📄 Datos del Documento</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                readOnly
                className={styles.fp5Readonly}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento/ticket"
                required
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Nº Factura Proveedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor"
              />
            </div>
          </div>
          
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del pago"
                required
              />
            </div>
          </div>

          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Fecha de Registro *</label>
              <input
                type="date"
                value={fechaReg}
                onChange={(e) => setFechaReg(e.target.value)}
                required
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Fecha de Factura *</label>
              <input
                type="date"
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                required
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Fecha de Operación</label>
              <input
                type="date"
                value={fechaOper}
                onChange={(e) => setFechaOper(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Sección de Datos del Proveedor */}
        <div className={styles.fp5Section}>
          <h3>👥 Datos del Proveedor</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Seleccionar Proveedor *</label>
              <select
                value={cuentaP}
                onChange={(e) => setCuentaP(e.target.value)}
                required
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
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>CIF/NIF {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                onChange={(e) => handleDatosProveedorChange('cif', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp5Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Razón Social {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp5Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                onChange={(e) => handleDatosProveedorChange('cp', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp5Readonly : ''}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Cuenta Contable Real</label>
              <input 
                type="text" 
                value={datosCuentaP.cuentaContable}
                readOnly
                className={styles.fp5Readonly}
              />
            </div>
          </div>
        </div>

        {/* Sección de Importe */}
        <div className={styles.fp5Section}>
          <h3>💰 Importe del Pago</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Código Analítico</label>
              <input 
                type="text" 
                value={analitico}
                readOnly
                className={styles.fp5Readonly}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Cuenta de Caja</label>
              <input 
                type="text" 
                value={cuentaCaja}
                readOnly
                className={styles.fp5Readonly}
              />
            </div>
            <div className={styles.fp5FormGroup}>
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
        <div className={styles.fp5Section}>
          <h3>📎 Archivo Adjunto</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Justificante de Pago</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp5FileInput}
              />
              {archivo && (
                <span className={styles.fp5FileName}>📄 {archivo.split('\\').pop()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumen del Asiento */}
        <div className={styles.fp5Section}>
          <h3>📊 Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            <div className={styles.fp5ResumenItem}>
              <span className={styles.fp5DebeHaber}>DEBE</span>
              <span className={styles.fp5CuentaInfo}>
                {datosCuentaP.cuentaContable || '400000000'} - Proveedor
              </span>
              <span className={styles.fp5Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span className={styles.fp5DebeHaber}>HABER</span>
              <span className={styles.fp5CuentaInfo}>
                {cuentaCaja} - Caja
              </span>
              <span className={styles.fp5Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
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
            ← Volver
          </button>
          <button 
            type="button" 
            className={styles.fp5ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            🗑️ Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp5SubmitBtn} 
            disabled={loading || !importe || !concepto || !numDocumento || !cuentaP}
          >
            {loading ? '⏳ Procesando...' : '✅ Crear Asiento de Pago'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;