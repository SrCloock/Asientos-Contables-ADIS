// pages/FormPage6.jsx - VERSIÓN ACTUALIZADA CON DATOS ANALÍTICOS AUTOMÁTICOS
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaMoneyBillWave } from 'react-icons/fa';
import styles from '../styles/FormPage6.module.css';
import config from '../config/config';

const FormPage6 = ({ user }) => {
  // Estados base
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
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
  
  // CAMPOS UNIFICADOS DE DOCUMENTO
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // CAMPOS DE PROVEEDOR
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ 
    cif: '', 
    nombre: '', 
    cp: '', 
    cuentaContable: ''
  });
  
  const isNuevoProveedor = cuentaP === '4000';

  // CUENTA DE INGRESO FIJA - NO SELECCIONABLE
  const cuentaIngresoFija = '519000000';
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
          
          // CUENTA CAJA
          setCuentaCaja(userData.cuentaCaja || '570000000');
          
          setDatosAnaliticos({
            codigoCanal: userData.codigoCanal || '',
            codigoProyecto: userData.codigoProyecto || '',
            codigoSeccion: userData.codigoSeccion || '',
            codigoDepartamento: userData.codigoDepartamento || '',
            idDelegacion: userData.idDelegacion || ''
          });

          console.log(`✅ FormPage6 - Datos analíticos cargados:`, {
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
        setAnalitico('EM');
        setCuentaCaja('570000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // ACTUALIZADO: Manejo de proveedor - CON OPCIÓN NUEVO PROVEEDOR
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
    if (!importe || parseFloat(importe) <= 0) errores.push('El importe debe ser mayor a 0');
    
    // Validar campos de nuevo proveedor si es necesario
    if (isNuevoProveedor) {
      if (!datosCuentaP.cif.trim()) {
        errores.push('El CIF/NIF es obligatorio para nuevo proveedor');
      }
      if (!datosCuentaP.nombre.trim()) {
        errores.push('La razón social es obligatoria para nuevo proveedor');
      }
    }
    
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
        comentario: `${numFRA || ''} - ${concepto}`.trim().substring(0, 40),
        
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
        cuentaIngreso: cuentaIngresoFija, // ✅ CUENTA FIJA
        cuentaCaja,
        importe: parseFloat(importe),
        archivo
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
        {/* SECCIÓN DE DATOS DEL DOCUMENTO - UNIFICADA */}
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
            <div className={styles.fp6FormGroup}>
              <label>Nº Factura Proveedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor"
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
            <div className={styles.fp6FormGroup}>
              <label>Fecha de Factura *</label>
              <input
                type="date"
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                required
              />
            </div>
            <div className={styles.fp6FormGroup}>
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
        <div className={styles.fp6Section}>
          <h3>👥 Datos del Proveedor/Cliente</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
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
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>CIF/NIF {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                onChange={(e) => handleDatosProveedorChange('cif', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp6Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Razón Social {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp6Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                onChange={(e) => handleDatosProveedorChange('cp', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp6Readonly : ''}
              />
            </div>
            <div className={styles.fp6FormGroup}>
              <label>Cuenta Contable Real</label>
              <input 
                type="text" 
                value={datosCuentaP.cuentaContable}
                readOnly
                className={styles.fp6Readonly}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN DE IMPORTE Y CUENTA - CON CUENTA FIJA */}
        <div className={styles.fp6Section}>
          <h3>💰 Importe y Cuenta</h3>
          <div className={styles.fp6FormRow}>
            <div className={styles.fp6FormGroup}>
              <label>Cuenta de Ingreso</label>
              <input 
                type="text" 
                value={cuentaIngresoFija}
                readOnly
                className={styles.fp6Readonly}
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

        {/* SECCIÓN DE ARCHIVO */}
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
              {archivo && (
                <span className={styles.fp6FileName}>📄 {archivo.split('\\').pop()}</span>
              )}
            </div>
          </div>
        </div>

        {/* RESUMEN DEL ASIENTO */}
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
                {cuentaIngresoFija} - Ingresos Varios
              </span>
              <span className={styles.fp6Importe}>
                {importe ? parseFloat(importe).toFixed(2) + ' €' : '0.00 €'}
              </span>
            </div>
          </div>
        </div>

        {/* BOTONES */}
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