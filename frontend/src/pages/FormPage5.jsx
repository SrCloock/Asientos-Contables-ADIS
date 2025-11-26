// pages/FormPage5.jsx - VERSIÓN COMPLETA CON GESTIÓN DE DOCUMENTOS CORREGIDA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCashRegister, FaPlus, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

const FormPage5 = ({ user }) => {
  // Estados del FormPage5
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Nuevos estados para datos maestros
  const [cuentasGasto, setCuentasGasto] = useState([]);
  
  // DATOS ANALÍTICOS FIJOS desde tabla Clientes (sesión)
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
  
  // Campos de documento
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [concepto, setConcepto] = useState('');
  
  // Campos de proveedor
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ 
    cif: '', 
    nombre: '', 
    cp: '', 
    cuentaContable: ''
  });
  
  const isNuevoProveedor = cuentaP === '4000';
  
  // Campos específicos
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Detalles igual que FormPage4 (con IVA y retención - 0% por defecto)
  const [detalles, setDetalles] = useState([
    { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      retencion: '0', // ✅ CORREGIDO: 0% por defecto
      cuotaRetencion: 0,
      importeTotalLinea: 0
    }
  ]);

  // Estados para react-select
  const [proveedoresOptions, setProveedoresOptions] = useState([]);
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);

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
          
          // DATOS ANALÍTICOS FIJOS desde tabla Clientes
          const serieBase = userData.codigoCanal || 'EM';
          const serieValue = 'C' + serieBase;
          setSerie(serieValue);
          setAnalitico(serieValue);
          setCuentaCaja(userData.cuentaCaja || '570000000');
          
          setDatosAnaliticos({
            codigoCanal: userData.codigoCanal || '',
            codigoProyecto: userData.codigoProyecto || '',
            codigoSeccion: userData.codigoSeccion || '',
            codigoDepartamento: userData.codigoDepartamento || '',
            idDelegacion: userData.idDelegacion || ''
          });
        }

        // Cargar el resto de datos maestros
        const [
          proveedoresRes, 
          cuentasRes, 
          gastosRes
        ] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
        setCuentasGasto(gastosRes.data || []);

        // Preparar opciones para selects
        const proveedoresOpts = [
          { 
            value: '4000', 
            label: '➕ NUEVO PROVEEDOR (400000000)',
            isNuevo: true 
          },
          ...proveedoresRes.data.map(prov => {
            const cuentaProv = cuentasRes.data.find(p => p.codigo === prov.codigo);
            return {
              value: prov.codigo,
              label: `${prov.codigo} - ${prov.nombre} - Cuenta: ${cuentaProv?.cuenta || '400000000'}`,
              proveedorData: prov,
              cuentaData: cuentaProv
            };
          })
        ];
        setProveedoresOptions(proveedoresOpts);

        const gastosOpts = gastosRes.data.map(cuenta => ({
          value: cuenta.id,
          label: `${cuenta.id} - ${cuenta.nombre}`,
          cuentaData: cuenta
        }));
        setCuentasGastoOptions(gastosOpts);

        // Establecer primera cuenta de gasto por defecto si existe
        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        } else {
          setCuentaGasto('600000000');
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        const defaultValue = 'CEM';
        setSerie(defaultValue);
        setAnalitico(defaultValue);
        setCuentaCaja('570000000');
        setCuentaGasto('600000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // Actualizar datos proveedor - CON OPCIÓN NUEVO PROVEEDOR
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

  // MANEJO DE SELECTS CON REACT-SELECT
  const handleProveedorChange = (selectedOption) => {
    if (selectedOption) {
      setCuentaP(selectedOption.value);
      
      if (selectedOption.isNuevo) {
        setDatosCuentaP({
          cif: '',
          nombre: '',
          cp: '',
          cuentaContable: '400000000'
        });
      } else {
        const proveedor = selectedOption.proveedorData;
        const cuentaProv = selectedOption.cuentaData;
        
        if (proveedor) {
          setDatosCuentaP({
            cif: proveedor.cif || '',
            nombre: proveedor.nombre || '',
            cp: proveedor.cp || '',
            cuentaContable: cuentaProv?.cuenta || '400000000'
          });
        }
      }
    } else {
      setCuentaP('');
      setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '' });
    }
  };

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

  // MANEJO DE DETALLES - CON CÁLCULO CORRECTO DE IVA
  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;

    const baseNum = parseFloat(newDetalles[index].base) || 0;
    const tipoIVANum = parseFloat(newDetalles[index].tipoIVA) || 0;
    const retencionNum = parseFloat(newDetalles[index].retencion) || 0;
    
    if (!isNaN(baseNum) && baseNum >= 0) {
      const cuotaIVA = (baseNum * tipoIVANum) / 100;
      const cuotaRetencion = (baseNum * retencionNum) / 100;
      newDetalles[index].cuotaIVA = cuotaIVA;
      newDetalles[index].cuotaRetencion = cuotaRetencion;
      newDetalles[index].importeTotalLinea = baseNum + cuotaIVA - cuotaRetencion;
    } else {
      newDetalles[index].cuotaIVA = 0;
      newDetalles[index].cuotaRetencion = 0;
      newDetalles[index].importeTotalLinea = 0;
    }
    
    setDetalles(newDetalles);
  };

  // ✅ CORREGIDO: Retención por defecto 0%
  const addDetalleLine = () => {
    setDetalles([...detalles, { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      retencion: '0', // ✅ 0% por defecto
      cuotaRetencion: 0,
      importeTotalLinea: 0
    }]);
  };

  const removeDetalleLine = (index) => {
    if (detalles.length > 1) {
      const newDetalles = [...detalles];
      newDetalles.splice(index, 1);
      setDetalles(newDetalles);
    }
  };

  // Cálculo de totales
  const calcularTotales = () => {
    return detalles.reduce((acc, detalle) => {
      const base = parseFloat(detalle.base) || 0;
      const iva = parseFloat(detalle.cuotaIVA) || 0;
      const retencion = parseFloat(detalle.cuotaRetencion) || 0;
      
      if (base > 0) {
        return {
          base: acc.base + base,
          iva: acc.iva + iva,
          retencion: acc.retencion + retencion,
          total: acc.total + base + iva - retencion
        };
      }
      return acc;
    }, { base: 0, iva: 0, retencion: 0, total: 0 });
  };

  const totales = calcularTotales();

  // Validación del formulario - SIN VENCIMIENTO
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
    if (!cuentaGasto) {
      errores.push('Debe seleccionar una cuenta de gasto');
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
    
    const lineasValidas = detalles.filter(d => d.base && parseFloat(d.base) > 0);
    if (lineasValidas.length === 0) {
      errores.push('Debe ingresar al menos una línea con base imponible mayor a 0');
    }
    
    return errores;
  };

  // 🔥 CORREGIDO: Manejo de archivos - Solo enviar el nombre del archivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 🔥 SOLO enviar el nombre del archivo, NO la ruta completa
      setArchivo(file.name);
      console.log(`📄 Archivo seleccionado: ${file.name}`);
    }
  };

  // 📅 CORRECCIÓN: Función para formatear fechas en el frontend
  const formatFechaForBackend = (fechaString) => {
    if (!fechaString) return '';
    
    // Asegurar que la fecha esté en formato YYYY-MM-DD
    const fecha = new Date(fechaString);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Envío del formulario - ACTUALIZADO CON FECHAS CORREGIDAS
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errores = validarFormulario();
    if (errores.length > 0) {
      alert('Errores en el formulario:\n• ' + errores.join('\n• '));
      return;
    }

    setLoading(true);

    try {
      // 📅 CORRECCIÓN: Asegurar que las fechas estén en formato correcto
      const fechaRegFormatted = formatFechaForBackend(fechaReg);
      const fechaFacturaFormatted = formatFechaForBackend(fechaFactura);
      const fechaOperFormatted = formatFechaForBackend(fechaOper);

      console.log('📅 FECHAS ENVIADAS AL BACKEND:');
      console.log('- Fecha Registro:', fechaRegFormatted);
      console.log('- Fecha Factura:', fechaFacturaFormatted);
      console.log('- Fecha Operación:', fechaOperFormatted);

      // COMENTARIO COMBINADO: Nº FRA - Concepto (formato corregido)
      const comentarioCombinado = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);

      const datosEnvio = {
        // Datos de documento CON FECHAS CORREGIDAS
        serie,
        numDocumento,
        numFRA,
        fechaReg: fechaRegFormatted,
        fechaFactura: fechaFacturaFormatted,
        fechaOper: fechaOperFormatted,
        concepto,
        comentario: comentarioCombinado,
        
        // Datos de proveedor - USAR CUENTA CONTABLE REAL
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || '400000000',
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp
        },
        
        // Datos específicos
        cuentaGasto,
        analitico,
        
        // Detalles CON IVA Y RETENCIÓN
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // 🔥 CORREGIDO: Solo el nombre del archivo
        archivo: archivo,
        
        // Totales CON IVA Y RETENCIÓN
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalRetencion: totales.retencion,
        totalFactura: totales.total,

        // Datos analíticos para el backend
        datosAnaliticos: datosAnaliticos
      };

      console.log('📤 Enviando datos FormPage5 (Factura Caja):', datosEnvio);

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/pago-proveedor`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        const lineasCreadas = response.data.detalles?.lineas || 5;
        const cuentaUsada = response.data.detalles?.cuentaGasto || cuentaGasto;
        const partes = response.data.detalles?.partes;
        
        alert(`✅ Asiento #${response.data.asiento} - Factura con Pago en Caja creado correctamente\nLíneas creadas: ${lineasCreadas}\nCuenta de gasto: ${cuentaUsada}\nPartes: ${partes?.parte1} y ${partes?.parte2}`);
        resetForm();
      } else {
        alert('❌ Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento de factura caja:', error);
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
    setDetalles([{ 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      retencion: '0', // ✅ 0% por defecto
      cuotaRetencion: 0,
      importeTotalLinea: 0 
    }]);
    setArchivo(null);
    
    // Restablecer cuenta de gasto
    if (cuentasGastoOptions.length > 0) {
      setCuentaGasto(cuentasGastoOptions[0].value);
    }
    
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

  // Obtener nombre de la cuenta seleccionada
  const getNombreCuentaGasto = () => {
    const cuenta = cuentasGasto.find(c => c.id === cuentaGasto);
    return cuenta ? cuenta.nombre : '';
  };

  // Calcular totales para el resumen
  const totalDebe = totales.base + totales.iva + totales.total;
  const totalHaber = totales.total + totales.retencion + totales.total;

  return (
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2>
          <FaCashRegister />
          Facturas de Caja - Pago Inmediato
        </h2>
        <div className={styles.fp5AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
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
                readOnly
                className={styles.fp5Readonly}
              />
              <small>Serie para facturas de caja (C + Canal)</small>
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
              <label>Nº Factura Proveedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor"
              />
            </div>
          </div>
          
          {/* CAMPO: Concepto */}
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del gasto/proveedor"
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

        {/* Sección de Datos del Proveedor - CON SELECT CON BÚSQUEDA */}
        <div className={styles.fp5Section}>
          <h3>Datos del Proveedor</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Seleccionar Proveedor *</label>
              <Select
                options={proveedoresOptions}
                value={proveedoresOptions.find(option => option.value === cuentaP)}
                onChange={handleProveedorChange}
                placeholder="Buscar o seleccionar proveedor..."
                isSearchable
                styles={customStyles}
                required
              />
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

        {/* Sección de Detalles Económicos - CON SELECT CON BÚSQUEDA */}
        <div className={styles.fp5Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Código Analítico</label>
              <input 
                type="text" 
                value={analitico}
                readOnly
                className={styles.fp5Readonly}
              />
              <small>Valor fijo (igual a Serie)</small>
            </div>
            <div className={styles.fp5FormGroup}>
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
          </div>

          <div className={styles.fp5Detalles}>
            <h4>Líneas de la Factura:</h4>
            
            {detalles.map((line, i) => (
              <div className={styles.fp5DetalleLinea} key={i}>
                <div className={styles.fp5LineaHeader}>
                  <span>Línea {i + 1}</span>
                  {detalles.length > 1 && (
                    <button 
                      type="button" 
                      className={styles.fp5RemoveBtn}
                      onClick={() => removeDetalleLine(i)}
                    >
                      <FaTrash />
                      Eliminar
                    </button>
                  )}
                </div>
                
                <div className={styles.fp5FormRow}>
                  <div className={styles.fp5FormGroup}>
                    <label>Base Imponible *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.base}
                      onChange={(e) => handleDetalleChange(i, 'base', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  
                  <div className={styles.fp5FormGroup}>
                    <label>Tipo IVA</label>
                    <select
                      value={line.tipoIVA}
                      onChange={(e) => handleDetalleChange(i, 'tipoIVA', e.target.value)}
                    >
                      <option value="21">21% General</option>
                      <option value="10">10% Reducido</option>
                      <option value="4">4% Superreducido</option>
                      <option value="0">0% Exento</option>
                    </select>
                  </div>
                  
                  <div className={styles.fp5FormGroup}>
                    <label>Cuota IVA</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.cuotaIVA.toFixed(2)} 
                      className={styles.fp5Readonly}
                    />
                  </div>
                  
                  {/* Campos de Retención */}
                  <div className={styles.fp5FormGroup}>
                    <label>% Retención</label>
                    <select
                      value={line.retencion}
                      onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}
                    >
                      <option value="15">15% Profesional</option>
                      <option value="7">7% Reducido</option>
                      <option value="1">1% Especial</option>
                      <option value="0">0% Sin retención</option>
                    </select>
                  </div>
                  
                  <div className={styles.fp5FormGroup}>
                    <label>Cuota Retención</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.cuotaRetencion.toFixed(2)} 
                      className={styles.fp5Readonly}
                    />
                  </div>
                  
                  <div className={styles.fp5FormGroup}>
                    <label>Total Línea</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.importeTotalLinea.toFixed(2)} 
                      className={styles.fp5Readonly}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button type="button" className={styles.fp5AddBtn} onClick={addDetalleLine}>
              <FaPlus />
              Añadir línea de factura
            </button>
          </div>

          {/* Resumen de Totales CON IVA Y RETENCIÓN */}
          <div className={styles.fp5Totales}>
            <h4>Resumen de Totales:</h4>
            <div className={styles.fp5TotalItem}>
              <span>Base Imponible:</span>
              <span>{totales.base.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5TotalItem}>
              <span>IVA:</span>
              <span>+ {totales.iva.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5TotalItem}>
              <span>Retención:</span>
              <span>- {totales.retencion.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5TotalItem + ' ' + styles.fp5TotalFinal}>
              <span>
                <strong>TOTAL A PAGAR:</strong>
              </span>
              <span>
                <strong>{totales.total.toFixed(2)} €</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 🔥 CORREGIDO: Sección de Archivo - CON INSTRUCCIONES CLARAS */}
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
              <div className={styles.fp5FileInfo}>
                <small>
                  📁 <strong>IMPORTANTE:</strong> El archivo debe estar guardado en:<br />
                  <code>C:\Users\sageinstall.MERIDIANOS-SSCC\Desktop\DocumentosSage\</code>
                </small>
                {archivo && (
                  <div className={styles.fp5FileName}>
                    ✅ Archivo seleccionado: <strong>{archivo}</strong>
                    <br />
                    <small>Ruta completa: C:\Users\sageinstall.MERIDIANOS-SSCC\Desktop\DocumentosSage\{archivo}</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen del Asiento - ACTUALIZADO: TODAS LAS LÍNEAS CON PARTE 1 Y PARTE 2 */}
        <div className={styles.fp5Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            {/* PARTE 1: FACTURA */}
            <div className={styles.fp5ResumenParte}>
              <h5>Parte 1 - Factura</h5>
              
              {/* LÍNEA 1: BASE IMPONIBLE */}
              <div className={styles.fp5ResumenItem}>
                <span>DEBE:</span>
                <span>{cuentaGasto} - {getNombreCuentaGasto()}</span>
                <span>{totales.base.toFixed(2)} €</span>
                <small>P1 | {concepto.substring(0, 20)}...</small>
              </div>
              
              {/* LÍNEA 2: IVA - MISMA CUENTA DE GASTO */}
              {totales.iva > 0 && (
                <div className={styles.fp5ResumenItem}>
                  <span>DEBE:</span>
                  <span>{cuentaGasto} - IVA Soportado</span>
                  <span>{totales.iva.toFixed(2)} €</span>
                  <small>P1 | {concepto.substring(0, 20)}...</small>
                </div>
              )}
              
              {/* LÍNEA 3: PROVEEDOR */}
              <div className={styles.fp5ResumenItem}>
                <span>HABER:</span>
                <span>{datosCuentaP.cuentaContable} - Proveedores</span>
                <span>{totales.total.toFixed(2)} €</span>
                <small>P1 | {concepto.substring(0, 20)}...</small>
              </div>
            </div>

            {/* PARTE 2: PAGO EN CAJA */}
            <div className={styles.fp5ResumenParte}>
              <h5>Parte 2 - Pago en Caja</h5>
              
              {/* LÍNEA 4: RETENCIÓN (si existe) */}
              {totales.retencion > 0 && (
                <div className={styles.fp5ResumenItem}>
                  <span>HABER:</span>
                  <span>475100000 - Retenciones Practicadas</span>
                  <span>{totales.retencion.toFixed(2)} €</span>
                  <small>P2 | {concepto.substring(0, 20)}...</small>
                </div>
              )}
              
              {/* LÍNEA 5: CAJA */}
              <div className={styles.fp5ResumenItem}>
                <span>DEBE:</span>
                <span>{cuentaCaja} - Caja</span>
                <span>{totales.total.toFixed(2)} €</span>
                <small>P2 | {concepto.substring(0, 20)}...</small>
              </div>
            </div>

            {/* RESUMEN FINAL */}
            <div className={styles.fp5ResumenFinal}>
              <div className={styles.fp5TotalItem}>
                <span>Total DEBE:</span>
                <span>{totalDebe.toFixed(2)} €</span>
              </div>
              <div className={styles.fp5TotalItem}>
                <span>Total HABER:</span>
                <span>{totalHaber.toFixed(2)} €</span>
              </div>
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
            disabled={loading || !cuentaP || !numDocumento || !concepto || !detalles.some(d => d.base && parseFloat(d.base) > 0) || !cuentaGasto}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;