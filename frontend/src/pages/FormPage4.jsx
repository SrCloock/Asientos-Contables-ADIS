// pages/FormPage4.jsx - VERSIÓN COMPLETA CON TIPOS DESDE BASE DE DATOS Y NUEVO ACREEDOR
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFileInvoiceDollar, FaPlus, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../styles/FormPage4.module.css';
import config from '../config/config';

const FormPage4 = ({ user }) => {
  // Estados del FormPage1
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Nuevos estados para tipos desde BD
  const [tiposIVA, setTiposIVA] = useState([]);
  const [tiposRetencion, setTiposRetencion] = useState([]);
  const [cuentasGasto, setCuentasGasto] = useState([]);
  
  // Estados para valores por defecto
  const [ivaDefault, setIvaDefault] = useState('21');
  const [retencionDefault, setRetencionDefault] = useState('0');
  
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
  const [vencimiento, setVencimiento] = useState('');
  
  // NUEVO CAMPO: Concepto obligatorio
  const [concepto, setConcepto] = useState('');
  
  // Campos de proveedor/acreedor
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ 
    cif: '', 
    nombre: '', 
    cp: '', 
    cuentaContable: ''
  });
  
  // Estados para determinar tipo de cuenta
  const isNuevoProveedor = cuentaP === '4000';
  const isNuevoAcreedor = cuentaP === '4100';
  const isNuevo = isNuevoProveedor || isNuevoAcreedor;
  
  // Campos específicos
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Detalles con valores iniciales basados en defaults
  const [detalles, setDetalles] = useState([]);
  
  // Estados para react-select
  const [proveedoresOptions, setProveedoresOptions] = useState([]);
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);
  const [tiposIVALoaded, setTiposIVALoaded] = useState(false);
  const [tiposRetencionLoaded, setTiposRetencionLoaded] = useState(false);

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
        // Obtener datos de la sesión
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { 
          withCredentials: true 
        });

        if (sessionRes.data.authenticated) {
          const userData = sessionRes.data.user;
          
          // DATOS ANALÍTICOS FIJOS desde tabla Clientes
          const serieValue = userData.codigoCanal || 'EM';
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

        // Cargar todos los datos maestros en paralelo
        const [
          proveedoresRes, 
          cuentasRes, 
          gastosRes,
          ivaRes,
          retencionRes
        ] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/tipos-iva`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/tipos-retencion`, { withCredentials: true })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
        setCuentasGasto(gastosRes.data || []);
        
        // Procesar tipos de IVA
        const tiposIVAFormateados = ivaRes.data.map(tipo => ({
          ...tipo,
          PorcentajeIva: parseFloat(tipo.PorcentajeIva).toString()
        }));
        setTiposIVA(tiposIVAFormateados);
        setTiposIVALoaded(true);
        
        // Buscar IVA 21% por defecto
        const iva21 = tiposIVAFormateados.find(t => t.PorcentajeIva === '21');
        if (iva21) {
          setIvaDefault('21');
        } else if (tiposIVAFormateados.length > 0) {
          setIvaDefault(tiposIVAFormateados[0].PorcentajeIva);
        }
        
        // Procesar tipos de retención
        const tiposRetencionFormateados = retencionRes.data.map(tipo => ({
          ...tipo,
          PorcentajeRetencion: parseFloat(tipo.PorcentajeRetencion).toString()
        }));
        setTiposRetencion(tiposRetencionFormateados);
        setTiposRetencionLoaded(true);
        
        // Buscar retención 0% por defecto
        const retencion0 = tiposRetencionFormateados.find(t => t.PorcentajeRetencion === '0');
        if (retencion0) {
          setRetencionDefault('0');
        } else if (tiposRetencionFormateados.length > 0) {
          setRetencionDefault(tiposRetencionFormateados[0].PorcentajeRetencion);
        }

        // Preparar opciones para selects - CON NUEVO ACREEDOR
        const proveedoresOpts = [
          { 
            value: '4000', 
            label: '➕ NUEVO PROVEEDOR (400000000)',
            isNuevo: true,
            tipoCuenta: 'proveedor'
          },
          { 
            value: '4100', 
            label: '➕ NUEVO ACREEDOR (410000000)',
            isNuevo: true,
            tipoCuenta: 'acreedor'
          },
          ...proveedoresRes.data.map(prov => {
            const cuentaProv = cuentasRes.data.find(p => p.codigo === prov.codigo);
            return {
              value: prov.codigo,
              label: `${prov.codigo} - ${prov.nombre} - Cuenta: ${cuentaProv?.cuenta || '400000000'}`,
              proveedorData: prov,
              cuentaData: cuentaProv,
              tipoCuenta: 'existente'
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
        // Valores por defecto en caso de error
        const defaultValue = 'EM';
        setSerie(defaultValue);
        setAnalitico(defaultValue);
        setCuentaCaja('570000000');
        setCuentaGasto('600000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // Inicializar detalles una vez cargados los tipos
  useEffect(() => {
    if (tiposIVALoaded && tiposRetencionLoaded && detalles.length === 0) {
      setDetalles([{ 
        base: '', 
        tipoIVA: ivaDefault, 
        cuotaIVA: 0,
        retencion: retencionDefault,
        cuotaRetencion: 0,
        importeTotalLinea: 0
      }]);
    }
  }, [tiposIVALoaded, tiposRetencionLoaded, ivaDefault, retencionDefault]);

  // CORREGIDO: Actualizar datos proveedor/acreedor - CON OPCIÓN NUEVO PROVEEDOR Y NUEVO ACREEDOR
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

  // MANEJO DE CAMPOS EDITABLES PARA NUEVO PROVEEDOR/ACREEDOR
  const handleDatosProveedorChange = (field, value) => {
    if (isNuevo) {
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
        if (selectedOption.tipoCuenta === 'proveedor') {
          setDatosCuentaP({
            cif: '',
            nombre: '',
            cp: '',
            cuentaContable: '400000000'
          });
        } else if (selectedOption.tipoCuenta === 'acreedor') {
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

  // MODIFICADO: Manejo de detalles - IVA NO DEDUCIBLE CON RETENCIÓN desde BD
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

  // ✅ CORREGIDO: Retención por defecto desde BD
  const addDetalleLine = () => {
    setDetalles([...detalles, { 
      base: '', 
      tipoIVA: ivaDefault, 
      cuotaIVA: 0,
      retencion: retencionDefault,
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

  // MODIFICADO: Cálculo de totales para IVA no deducible CON RETENCIÓN
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

  // Validación del formulario - AGREGADO CONCEPTO
  const validarFormulario = () => {
    const errores = [];
    
    if (!vencimiento) {
      errores.push('La fecha de vencimiento es obligatoria para este tipo de asiento');
    }
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
    if (isNuevo) {
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
      const vencimientoFormatted = formatFechaForBackend(vencimiento);

      console.log('📅 FECHAS ENVIADAS AL BACKEND:');
      console.log('- Fecha Registro:', fechaRegFormatted);
      console.log('- Fecha Factura:', fechaFacturaFormatted);
      console.log('- Fecha Operación:', fechaOperFormatted);
      console.log('- Vencimiento:', vencimientoFormatted);

      // COMENTARIO COMBINADO: Nº FRA - Concepto (formato corregido)
      const comentarioCombinado = `${concepto}`.trim().substring(0, 40);

      const datosEnvio = {
        // Datos de documento CON FECHAS CORREGIDAS
        serie,
        numDocumento,
        numFRA,
        fechaReg: fechaRegFormatted,
        fechaFactura: fechaFacturaFormatted,
        fechaOper: fechaOperFormatted,
        vencimiento: vencimientoFormatted,
        concepto,
        comentario: comentarioCombinado,
        
        // Datos de proveedor/acreedor - USAR CUENTA CONTABLE REAL
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || (isNuevoAcreedor ? '410000000' : '400000000'),
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp,
          // Añadir campo para identificar si es acreedor
          esAcreedor: isNuevoAcreedor
        },
        
        // Datos específicos
        cuentaGasto,
        analitico,
        
        // Detalles CON RETENCIÓN
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // 🔥 CORREGIDO: Solo el nombre del archivo
        archivo: archivo,
        
        // Totales CON RETENCIÓN
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalRetencion: totales.retencion,
        totalFactura: totales.total
      };

      console.log('📤 Enviando datos FormPage4:', datosEnvio);

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/factura-iva-no-deducible`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        const lineasCreadas = response.data.detalles.lineas;
        const tipo = isNuevoAcreedor ? 'Acreedor' : 'Proveedor';
        alert(`✅ Asiento #${response.data.asiento} - Factura ${tipo} (IVA No Deducible) creado correctamente\nLíneas creadas: ${lineasCreadas}`);
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
    setVencimiento('');
    setDetalles([{ 
      base: '', 
      tipoIVA: ivaDefault, 
      cuotaIVA: 0, 
      retencion: retencionDefault,
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

  // Obtener nombre de la cuenta de proveedor/acreedor
  const getNombreCuentaProveedor = () => {
    if (isNuevoProveedor) {
      return 'Proveedores (Nuevo)';
    } else if (isNuevoAcreedor) {
      return 'Acreedores (Nuevo)';
    } else {
      const proveedor = proveedores.find(p => p.codigo === cuentaP);
      return proveedor ? proveedor.nombre : 'Proveedores';
    }
  };

  return (
    <div className={styles.fp4Container}>
      <div className={styles.fp4Header}>
        <h2>
          <FaFileInvoiceDollar />
          Factura de Proveedor/Acreedor (IVA No Deducible)
        </h2>
        <div className={styles.fp4AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp4Form}>
        {/* Sección de Datos del Documento - ACTUALIZADO */}
        <div className={styles.fp4Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                readOnly
                className={styles.fp4Readonly}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento"
                required
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Nº Factura Proveedor/Acreedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura"
              />
            </div>
          </div>
          
          {/* NUEVO CAMPO: Concepto */}
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
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

          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Registro *</label>
              <input
                type="date"
                value={fechaReg}
                onChange={(e) => setFechaReg(e.target.value)}
                required
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Factura *</label>
              <input
                type="date"
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                required
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Operación</label>
              <input
                type="date"
                value={fechaOper}
                onChange={(e) => setFechaOper(e.target.value)}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Vencimiento *</label>
              <input
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                required
              />
              <small>📅 Esta fecha se guardará exactamente como la seleccione</small>
            </div>
          </div>
        </div>

        {/* Sección de Datos del Proveedor/Acreedor - CON SELECT CON BÚSQUEDA */}
        <div className={styles.fp4Section}>
          <h3>Datos del Proveedor/Acreedor</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
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
              <small>
                Seleccione "Nuevo Proveedor" para cuenta 400000000 o "Nuevo Acreedor" para cuenta 410000000
              </small>
            </div>
          </div>

          {/* CAMPOS DE PROVEEDOR/ACREEDOR - EDITABLES SI ES NUEVO */}
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>CIF/NIF {isNuevo && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                onChange={(e) => handleDatosProveedorChange('cif', e.target.value)}
                readOnly={!isNuevo}
                className={!isNuevo ? styles.fp4Readonly : ''}
                required={isNuevo}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Razón Social {isNuevo && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)}
                readOnly={!isNuevo}
                className={!isNuevo ? styles.fp4Readonly : ''}
                required={isNuevo}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                onChange={(e) => handleDatosProveedorChange('cp', e.target.value)}
                readOnly={!isNuevo}
                className={!isNuevo ? styles.fp4Readonly : ''}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Cuenta Contable Real</label>
              <input 
                type="text" 
                value={datosCuentaP.cuentaContable}
                readOnly
                className={styles.fp4Readonly}
              />
              <small>
                {isNuevoProveedor ? 'Cuenta Proveedores (400000000)' : 
                 isNuevoAcreedor ? 'Cuenta Acreedores (410000000)' : 
                 'Cuenta del proveedor existente'}
              </small>
            </div>
          </div>
        </div>

        {/* Sección de Detalles Económicos - CON SELECT CON BÚSQUEDA */}
        <div className={styles.fp4Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Código Analítico</label>
              <input 
                type="text" 
                value={analitico}
                readOnly
                className={styles.fp4Readonly}
              />
              <small>Valor fijo (igual a Serie)</small>
            </div>
            <div className={styles.fp4FormGroup}>
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

          <div className={styles.fp4Detalles}>
            <h4>Líneas de la Factura:</h4>
            
            {detalles.map((line, i) => (
              <div className={styles.fp4DetalleLinea} key={i}>
                <div className={styles.fp4LineaHeader}>
                  <span>Línea {i + 1}</span>
                  {detalles.length > 1 && (
                    <button 
                      type="button" 
                      className={styles.fp4RemoveBtn}
                      onClick={() => removeDetalleLine(i)}
                    >
                      <FaTrash />
                      Eliminar
                    </button>
                  )}
                </div>
                
                <div className={styles.fp4FormRow}>
                  <div className={styles.fp4FormGroup}>
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
                  
                  <div className={styles.fp4FormGroup}>
                    <label>Tipo IVA</label>
                    <select
                      value={line.tipoIVA}
                      onChange={(e) => handleDetalleChange(i, 'tipoIVA', e.target.value)}
                    >
                      {tiposIVA.map(tipo => (
                        <option key={tipo.CodigoIva} value={tipo.PorcentajeIva}>
                          {tipo.PorcentajeIva}% - {tipo.Iva}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className={styles.fp4FormGroup}>
                    <label>Cuota IVA</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.cuotaIVA.toFixed(2)} 
                      className={styles.fp4Readonly}
                    />
                  </div>
                  
                  {/* Campos de Retención DESDE BASE DE DATOS */}
                  <div className={styles.fp4FormGroup}>
                    <label>% Retención</label>
                    <select
                      value={line.retencion}
                      onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}
                    >
                      {tiposRetencion.map(tipo => (
                        <option key={tipo.CodigoRetencion} value={tipo.PorcentajeRetencion}>
                          {tipo.PorcentajeRetencion}% - {tipo.Retencion}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className={styles.fp4FormGroup}>
                    <label>Cuota Retención</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.cuotaRetencion.toFixed(2)} 
                      className={styles.fp4Readonly}
                    />
                  </div>
                  
                  <div className={styles.fp4FormGroup}>
                    <label>Total Línea</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.importeTotalLinea.toFixed(2)} 
                      className={styles.fp4Readonly}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button type="button" className={styles.fp4AddBtn} onClick={addDetalleLine}>
              <FaPlus />
              Añadir línea de factura
            </button>
          </div>

          {/* Resumen de Totales CON RETENCIÓN */}
          <div className={styles.fp4Totales}>
            <h4>Resumen de Totales:</h4>
            <div className={styles.fp4TotalItem}>
              <span>Base Imponible:</span>
              <span>{totales.base.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4TotalItem}>
              <span>IVA (No Deducible):</span>
              <span>+ {totales.iva.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4TotalItem}>
              <span>Retención:</span>
              <span>- {totales.retencion.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4TotalItem + ' ' + styles.fp4TotalFinal}>
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
        <div className={styles.fp4Section}>
          <h3>Archivo</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Adjuntar Archivo</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp4FileInput}
              />
              <div className={styles.fp4FileInfo}>
                <small>
                  📁 <strong>IMPORTANTE:</strong> El archivo debe estar guardado en:<br />
                  <code>C:\Users\sageinstall.MERIDIANOS-SSCC\Desktop\DocumentosSage\</code>
                </small>
                {archivo && (
                  <div className={styles.fp4FileName}>
                    ✅ Archivo seleccionado: <strong>{archivo}</strong>
                    <br />
                    <small>Ruta completa: C:\Users\sageinstall.MERIDIANOS-SSCC\Desktop\DocumentosSage\{archivo}</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen del Asiento - CORREGIDO: DOS LÍNEAS SEPARADAS */}
        <div className={styles.fp4Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp4Resumen}>
            {/* LÍNEA 1: BASE IMPONIBLE */}
            <div className={styles.fp4ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {getNombreCuentaGasto()}</span>
              <span>{totales.base.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 2: IVA NO DEDUCIBLE - MISMA CUENTA DE GASTO */}
            {totales.iva > 0 && (
              <div className={styles.fp4ResumenItem}>
                <span>DEBE:</span>
                <span>{cuentaGasto} - IVA No Deducible</span>
                <span>{totales.iva.toFixed(2)} €</span>
              </div>
            )}
            
            {/* LÍNEA 3: PROVEEDOR/ACREEDOR */}
            <div className={styles.fp4ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuentaContable} - {getNombreCuentaProveedor()}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 4: RETENCIÓN */}
            {totales.retencion > 0 && (
              <div className={styles.fp4ResumenItem}>
                <span>HABER:</span>
                <span>475100000 - Retenciones Practicadas</span>
                <span>{totales.retencion.toFixed(2)} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className={styles.fp4ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp4CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className={styles.fp4ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp4SubmitBtn} 
            disabled={loading || !cuentaP || !numDocumento || !concepto || !detalles.some(d => d.base && parseFloat(d.base) > 0) || !vencimiento || !cuentaGasto}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage4;