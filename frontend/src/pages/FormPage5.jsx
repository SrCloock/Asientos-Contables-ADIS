// pages/FormPage5.jsx - VERSIÓN COMPLETA CON TODAS LAS CORRECCIONES APLICADAS
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCashRegister, FaPlus, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

const FormPage5 = ({ user }) => {
  // ✅ ESTADOS CORREGIDOS
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // ✅ DATOS ANALÍTICOS SIN VALORES POR DEFECTO
  const [cuentasGasto, setCuentasGasto] = useState([]);
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
  
  // Campos de proveedor/acreedor
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ 
    cif: '', 
    nombre: '', 
    cp: '', 
    cuentaContable: ''
  });
  
  const isNuevoProveedor = cuentaP === '4000';
  const isNuevoAcreedor = cuentaP === '4100';
  
  // Campos específicos
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Detalles igual que FormPage4 (con IVA y retención - 0% por defecto)
  const [detalles, setDetalles] = useState([
    { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      retencion: '0',
      cuotaRetencion: 0,
      importeTotalLinea: 0
    }
  ]);

  // Estados para react-select
  const [proveedoresOptions, setProveedoresOptions] = useState([]);
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);

  // ✅ EFECTO CONTADOR CORREGIDO: MUESTRA CONTADOR + 1
  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, {
          withCredentials: true
        });
        // ✅ CORREGIDO: Mostrar contador + 1
        setNumAsiento(response.data.contador + 1);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    fetchContador();
  }, []);

  // ✅ EFECTO DATOS MAESTROS SIN VALORES POR DEFECTO
  useEffect(() => {
    const fetchDatosMaestros = async () => {
      try {
        // Obtener datos de la sesión
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { 
          withCredentials: true 
        });

        if (sessionRes.data.authenticated) {
          const userData = sessionRes.data.user;
          
          // ✅ CORREGIDO: SIN VALORES POR DEFECTO
          const serieBase = userData.codigoCanal || '';
          const serieValue = 'C' + serieBase;
          setSerie(serieValue);
          setAnalitico(serieValue);
          setCuentaCaja(userData.cuentaCaja || '');
          
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

        // ✅ CORREGIDO: AÑADIR OPCIÓN NUEVO ACREEDOR
        const proveedoresOpts = [
          { 
            value: '4000', 
            label: '➕ NUEVO PROVEEDOR (400000000)',
            isNuevo: true,
            tipo: 'proveedor'
          },
          { 
            value: '4100', 
            label: '➕ NUEVO ACREEDOR (410000000)',
            isNuevo: true,
            tipo: 'acreedor'
          },
          ...proveedoresRes.data.map(prov => {
            const cuentaProv = cuentasRes.data.find(p => p.codigo === prov.codigo);
            return {
              value: prov.codigo,
              label: `${prov.codigo} - ${prov.nombre} - Cuenta: ${cuentaProv?.cuenta || '400000000'}`,
              proveedorData: prov,
              cuentaData: cuentaProv,
              isNuevo: false
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

        // ✅ CORREGIDO: Sin valor por defecto, si no hay cuentas queda vacío
        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        } else {
          setCuentaGasto('');
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        // ✅ CORREGIDO: Sin valores por defecto
        setSerie('');
        setAnalitico('');
        setCuentaCaja('');
        setCuentaGasto('');
      }
    };
    fetchDatosMaestros();
  }, []);

  // ✅ CORREGIDO: Actualizar datos proveedor/acreedor - CON AMBAS OPCIONES NUEVAS
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
      } else if (cuentaP === '4100') {
        // NUEVO ACREEDOR - Campos editables
        setDatosCuentaP({
          cif: '',
          nombre: '',
          cp: '',
          cuentaContable: '410000000'
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

  // ✅ MANEJO DE CAMPOS EDITABLES PARA NUEVO PROVEEDOR/ACREEDOR
  const handleDatosProveedorChange = (field, value) => {
    if (isNuevoProveedor || isNuevoAcreedor) {
      setDatosCuentaP(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // ✅ MANEJO DE SELECTS CON REACT-SELECT
  const handleProveedorChange = (selectedOption) => {
    if (selectedOption) {
      setCuentaP(selectedOption.value);
      
      if (selectedOption.isNuevo) {
        if (selectedOption.value === '4000') {
          setDatosCuentaP({
            cif: '',
            nombre: '',
            cp: '',
            cuentaContable: '400000000'
          });
        } else if (selectedOption.value === '4100') {
          setDatosCuentaP({
            cif: '',
            nombre: '',
            cp: '',
            cuentaContable: '410000000'
          });
        }
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

  // ✅ MANEJO DE DETALLES - CON CÁLCULO CORRECTO DE IVA
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
      retencion: '0',
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

  // ✅ Cálculo de totales
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

  // ✅ Validación del formulario - SIN VENCIMIENTO
  const validarFormulario = () => {
    const errores = [];
    
    if (!numDocumento.trim()) {
      errores.push('El número de documento es obligatorio');
    }
    if (!concepto.trim()) {
      errores.push('El concepto es obligatorio');
    }
    if (!cuentaP) {
      errores.push('Debe seleccionar un proveedor/acreedor');
    }
    if (!cuentaGasto) {
      errores.push('Debe seleccionar una cuenta de gasto');
    }
    
    // Validar campos de nuevo proveedor/acreedor si es necesario
    if (isNuevoProveedor || isNuevoAcreedor) {
      if (!datosCuentaP.cif.trim()) {
        errores.push('El CIF/NIF es obligatorio para nuevo proveedor/acreedor');
      }
      if (!datosCuentaP.nombre.trim()) {
        errores.push('La razón social es obligatoria para nuevo proveedor/acreedor');
      }
    }
    
    const lineasValidas = detalles.filter(d => d.base && parseFloat(d.base) > 0);
    if (lineasValidas.length === 0) {
      errores.push('Debe ingresar al menos una línea con base imponible mayor a 0');
    }
    
    return errores;
  };

  // ✅ Manejo de archivos - Solo enviar el nombre del archivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(file.name);
      console.log(`📄 Archivo seleccionado: ${file.name}`);
    }
  };

  // ✅ Función para formatear fechas en el frontend
  const formatFechaForBackend = (fechaString) => {
    if (!fechaString) return '';
    
    // Asegurar que la fecha esté en formato YYYY-MM-DD
    const fecha = new Date(fechaString);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // ✅ Envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errores = validarFormulario();
    if (errores.length > 0) {
      alert('Errores en el formulario:\n• ' + errores.join('\n• '));
      return;
    }

    setLoading(true);

    try {
      // ✅ Formatear fechas correctamente
      const fechaRegFormatted = formatFechaForBackend(fechaReg);
      const fechaFacturaFormatted = formatFechaForBackend(fechaFactura);
      const fechaOperFormatted = formatFechaForBackend(fechaOper);

      console.log('📅 FECHAS ENVIADAS AL BACKEND:');
      console.log('- Fecha Registro:', fechaRegFormatted);
      console.log('- Fecha Factura:', fechaFacturaFormatted);
      console.log('- Fecha Operación:', fechaOperFormatted);

      // COMENTARIO COMBINADO: Nº FRA - Concepto
      const comentarioCombinado = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);

      const datosEnvio = {
        // ✅ Datos de documento
        serie,
        numDocumento,
        numFRA,
        fechaReg: fechaRegFormatted,
        fechaFactura: fechaFacturaFormatted,
        fechaOper: fechaOperFormatted,
        concepto,
        comentario: comentarioCombinado,
        
        // ✅ Datos de proveedor/acreedor
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || (isNuevoAcreedor ? '410000000' : '400000000'),
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
        
        // ✅ Solo el nombre del archivo
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

  // ✅ RESET FORM CORREGIDO: Obtiene contador y suma 1
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
      retencion: '0',
      cuotaRetencion: 0,
      importeTotalLinea: 0 
    }]);
    setArchivo(null);
    
    // ✅ Restablecer cuenta de gasto
    if (cuentasGastoOptions.length > 0) {
      setCuentaGasto(cuentasGastoOptions[0].value);
    } else {
      setCuentaGasto('');
    }
    
    // ✅ Obtener nuevo contador y sumar 1
    const fetchNewContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, { withCredentials: true });
        setNumAsiento(response.data.contador + 1);
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

  // Determinar si es nuevo proveedor o acreedor
  const isNuevo = isNuevoProveedor || isNuevoAcreedor;

  return (
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2>
          <FaCashRegister />
          Facturas de Caja - Pago Inmediato
        </h2>
        <div className={styles.fp5AsientoInfo}>
          {/* ✅ MUESTRA CONTADOR + 1 */}
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
              <label>Nº Factura Proveedor/Acreedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor/acreedor"
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
                placeholder="Descripción del gasto/proveedor/acreedor"
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

        {/* Sección de Datos del Proveedor/Acreedor - CON SELECT CON BÚSQUEDA */}
        <div className={styles.fp5Section}>
          <h3>Datos del Proveedor/Acreedor</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Seleccionar Proveedor/Acreedor *</label>
              <Select
                options={proveedoresOptions}
                value={proveedoresOptions.find(option => option.value === cuentaP)}
                onChange={handleProveedorChange}
                placeholder="Buscar o seleccionar proveedor/acreedor..."
                isSearchable
                styles={customStyles}
                required
              />
            </div>
          </div>

          {/* CAMPOS DE PROVEEDOR/ACREEDOR - EDITABLES SI ES NUEVO */}
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>CIF/NIF {isNuevo && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                onChange={(e) => handleDatosProveedorChange('cif', e.target.value)}
                readOnly={!isNuevo}
                className={!isNuevo ? styles.fp5Readonly : ''}
                required={isNuevo}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Razón Social {isNuevo && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)}
                readOnly={!isNuevo}
                className={!isNuevo ? styles.fp5Readonly : ''}
                required={isNuevo}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                onChange={(e) => handleDatosProveedorChange('cp', e.target.value)}
                readOnly={!isNuevo}
                className={!isNuevo ? styles.fp5Readonly : ''}
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
              <small>
                {isNuevoProveedor && 'Nuevo Proveedor: 400000000'}
                {isNuevoAcreedor && 'Nuevo Acreedor: 410000000'}
              </small>
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
                      <option value="19">19% Alquileres</option>
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
              <span>IVA (No Deducible):</span>
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

        {/* Resumen del Asiento - PAGO INMEDIATO EN CAJA */}
        <div className={styles.fp5Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            {/* LÍNEA 1: GASTO (BASE) */}
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {getNombreCuentaGasto()} (Base)</span>
              <span>{totales.base.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 2: GASTO (IVA) - MISMA CUENTA */}
            {totales.iva > 0 && (
              <div className={styles.fp5ResumenItem}>
                <span>DEBE:</span>
                <span>{cuentaGasto} - IVA No Deducible</span>
                <span>{totales.iva.toFixed(2)} €</span>
              </div>
            )}
            
            {/* LÍNEA 3: PROVEEDOR/ACREEDOR (FACTURA) */}
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuentaContable} - {isNuevoAcreedor ? 'Acreedores' : 'Proveedores'}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 4: PROVEEDOR/ACREEDOR (PAGO) */}
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{datosCuentaP.cuentaContable} - {isNuevoAcreedor ? 'Acreedores' : 'Proveedores'} (Pago)</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 5: CAJA (PAGO) */}
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>{cuentaCaja} - Caja</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 6: RETENCIÓN - SI APLICA */}
            {totales.retencion > 0 && (
              <div className={styles.fp5ResumenItem}>
                <span>HABER:</span>
                <span>475100000 - Retenciones Practicadas</span>
                <span>{totales.retencion.toFixed(2)} €</span>
              </div>
            )}
          </div>
          <div className={styles.fp5NotaResumen}>
            <small>📝 <strong>Nota:</strong> Este asiento incluye tanto la factura como el pago inmediato en caja</small>
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