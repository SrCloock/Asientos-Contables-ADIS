// pages/FormPage5.jsx - VERSIÓN COMPLETA CORREGIDA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCashRegister, FaPlus, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

const FormPage5 = ({ user }) => {
  // Estados base
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // NUEVO: Estados para tipos desde BD
  const [tiposIVA, setTiposIVA] = useState([]);
  const [tiposRetencion, setTiposRetencion] = useState([]);
  const [cuentasGasto, setCuentasGasto] = useState([]);
  
  // Estados para valores por defecto
  const [ivaDefault, setIvaDefault] = useState('21');
  const [retencionDefault, setRetencionDefault] = useState('0');
  
  // Estados de carga
  const [tiposIVALoaded, setTiposIVALoaded] = useState(false);
  const [tiposRetencionLoaded, setTiposRetencionLoaded] = useState(false);
  
  // Datos analíticos
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
  const [archivo, setArchivo] = useState(''); // Cambiado de null a string vacío
  
  // Detalles con valores desde BD
  const [detalles, setDetalles] = useState([]);

  // Estados para react-select
  const [proveedoresOptions, setProveedoresOptions] = useState([]);
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);

  // ✅ CORREGIDO: Contador +1 en useEffect
  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, {
          withCredentials: true
        });
        // ✅ CONTADOR + 1
        setNumAsiento(response.data.contador + 1);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    fetchContador();
  }, []);

  // ✅ Efecto para cargar TODOS los datos maestros
  useEffect(() => {
    const fetchDatosMaestros = async () => {
      try {
        // Obtener datos de la sesión
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { 
          withCredentials: true 
        });

        if (sessionRes.data.authenticated) {
          const userData = sessionRes.data.user;
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

        // Cargar TODOS los datos maestros en paralelo
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
        
        // ✅ Procesar tipos de IVA desde BD
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
        
        // ✅ Procesar tipos de retención desde BD CON CUENTAABONO
        const tiposRetencionFormateados = retencionRes.data.map(tipo => ({
          ...tipo,
          PorcentajeRetencion: parseFloat(tipo.PorcentajeRetencion).toString(),
          CuentaAbono: tipo.CuentaAbono || '475100000'
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

        // Preparar opciones para selects
        const proveedoresOpts = [
          { 
            value: '4000', 
            label: '➕ NUEVO PROVEEDOR (40000000)',
            isNuevo: true,
            tipo: 'proveedor'
          },
          { 
            value: '4100', 
            label: '➕ NUEVO ACREEDOR (41000000)',
            isNuevo: true,
            tipo: 'acreedor'
          },
          ...proveedoresRes.data.map(prov => {
            const cuentaProv = cuentasRes.data.find(p => p.codigo === prov.codigo);
            return {
              value: prov.codigo,
              label: `${prov.codigo} - ${prov.nombre} - Cuenta: ${cuentaProv?.cuenta || '40000000'}`,
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

        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        setSerie('');
        setAnalitico('');
        setCuentaCaja('');
        setCuentaGasto('');
      }
    };
    fetchDatosMaestros();
  }, []);

  // ✅ Inicializar detalles una vez cargados los tipos
  useEffect(() => {
    if (tiposIVALoaded && tiposRetencionLoaded && detalles.length === 0) {
      const retencionDefaultTipo = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
      
      setDetalles([{ 
        base: '', 
        tipoIVA: ivaDefault, 
        cuotaIVA: 0,
        retencion: retencionDefault,
        codigoRetencion: retencionDefaultTipo?.CodigoRetencion || '0',
        cuentaAbonoRetencion: retencionDefaultTipo?.CuentaAbono || '475100000',
        cuotaRetencion: 0,
        importeTotalLinea: 0
      }]);
    }
  }, [tiposIVALoaded, tiposRetencionLoaded, ivaDefault, retencionDefault, detalles.length]);

  // ✅ Actualizar datos proveedor/acreedor
  useEffect(() => {
    if (cuentaP) {
      if (cuentaP === '4000') {
        setDatosCuentaP({
          cif: '',
          nombre: '',
          cp: '',
          cuentaContable: '40000000'
        });
      } else if (cuentaP === '4100') {
        setDatosCuentaP({
          cif: '',
          nombre: '',
          cp: '',
          cuentaContable: '40000000'
        });
      } else {
        const proveedor = proveedores.find(p => p.codigo === cuentaP);
        const cuentaProv = proveedoresCuentas.find(p => p.codigo === cuentaP);
        
        if (proveedor) {
          setDatosCuentaP({
            cif: proveedor.cif || '',
            nombre: proveedor.nombre || '',
            cp: proveedor.cp || '',
            cuentaContable: cuentaProv?.cuenta || '40000000'
          });
        }
      }
    }
  }, [cuentaP, proveedores, proveedoresCuentas]);

  // ✅ Manejo de campos editables
  const handleDatosProveedorChange = (field, value) => {
    if (isNuevoProveedor || isNuevoAcreedor) {
      setDatosCuentaP(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // ✅ Manejo de selects
  const handleProveedorChange = (selectedOption) => {
    if (selectedOption) {
      setCuentaP(selectedOption.value);
      
      if (selectedOption.isNuevo) {
        if (selectedOption.value === '4000') {
          setDatosCuentaP({
            cif: '',
            nombre: '',
            cp: '',
            cuentaContable: '40000000'
          });
        } else if (selectedOption.value === '4100') {
          setDatosCuentaP({
            cif: '',
            nombre: '',
            cp: '',
            cuentaContable: '40000000'
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
            cuentaContable: cuentaProv?.cuenta || '40000000'
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

  // MODIFICADO: Manejo de detalles - CON CUENTA DE ABONO DE RETENCIÓN
  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;

    // Si cambia el porcentaje de retención, actualizar la cuenta de abono
    if (field === 'retencion') {
      const tipoRetencion = tiposRetencion.find(t => t.PorcentajeRetencion === value);
      if (tipoRetencion) {
        newDetalles[index].codigoRetencion = tipoRetencion.CodigoRetencion;
        newDetalles[index].cuentaAbonoRetencion = tipoRetencion.CuentaAbono;
      }
    }

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

  // ✅ CORREGIDO: Añadir línea con cuenta de abono correcta
  const addDetalleLine = () => {
    const retencionDefaultTipo = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
    
    setDetalles([...detalles, { 
      base: '', 
      tipoIVA: ivaDefault, 
      cuotaIVA: 0,
      retencion: retencionDefault,
      codigoRetencion: retencionDefaultTipo?.CodigoRetencion || '0',
      cuentaAbonoRetencion: retencionDefaultTipo?.CuentaAbono || '475100000',
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

  // 📅 CORRECCIÓN: Función para formatear fechas en el frontend
  const formatFechaForBackend = (fechaString) => {
    if (!fechaString) return '';
    
    const fecha = new Date(fechaString);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Envío del formulario - ACTUALIZADO
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

      // ✅ CORRECCIÓN: Comentario usando solo concepto
      const comentarioCorto = `${concepto}`.trim().substring(0, 40);

      const datosEnvio = {
        // Datos de documento CON FECHAS CORREGIDAS
        serie,
        numDocumento,
        numFRA,
        fechaReg: fechaRegFormatted,
        fechaFactura: fechaFacturaFormatted,
        fechaOper: fechaOperFormatted,
        concepto,
        comentario: comentarioCorto, // ✅ CORREGIDO: Solo concepto
        
        // Datos de proveedor/acreedor
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || (isNuevoAcreedor ? '40000000' : '40000000'),
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp,
          esAcreedor: isNuevoAcreedor
        },
        
        // Datos específicos
        cuentaGasto,
        analitico,
        cuentaCaja,
        
        // Detalles CON RETENCIÓN Y CUENTA DE ABONO
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // ✅ CORREGIDO: Ruta completa del archivo
        archivo: archivo,
        
        // Totales
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalRetencion: totales.retencion,
        totalFactura: totales.total
      };

      console.log('📤 Enviando datos FormPage5:', datosEnvio);

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/pago-proveedor`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        const lineasCreadas = response.data.detalles.lineas;
        const tipo = isNuevoAcreedor ? 'Acreedor' : 'Proveedor';
        const cuentaRetencion = response.data.detalles.cuentaRetencion || '475100000';
        alert(`✅ Asiento #${response.data.asiento} - Pago ${tipo} creado correctamente\nLíneas creadas: ${lineasCreadas}\nCuenta Retención: ${cuentaRetencion}`);
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
    setArchivo('');
    
    // Reiniciar detalles con valores por defecto
    const retencionDefaultTipo = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
    setDetalles([{ 
      base: '', 
      tipoIVA: ivaDefault, 
      cuotaIVA: 0,
      retencion: retencionDefault,
      codigoRetencion: retencionDefaultTipo?.CodigoRetencion || '0',
      cuentaAbonoRetencion: retencionDefaultTipo?.CuentaAbono || '475100000',
      cuotaRetencion: 0,
      importeTotalLinea: 0
    }]);
    
    // Restablecer cuenta de gasto
    if (cuentasGastoOptions.length > 0) {
      setCuentaGasto(cuentasGastoOptions[0].value);
    }
    
    // ✅ CORREGIDO: Obtener nuevo contador y sumar 1
    const fetchNewContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, { 
          withCredentials: true 
        });
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

  // Obtener cuenta de retención
  const getCuentaRetencion = () => {
    if (detalles.length > 0 && detalles[0].cuentaAbonoRetencion) {
      return detalles[0].cuentaAbonoRetencion;
    }
    return '475100000';
  };

  return (
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2>
          <FaCashRegister />
          Pago Proveedor/Acreedor
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
                placeholder="Número de factura"
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

        {/* Sección de Datos del Proveedor/Acreedor */}
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
              <small>
                Seleccione "Nuevo Proveedor" para cuenta 40000000 o "Nuevo Acreedor" para cuenta 40000000
              </small>
            </div>
          </div>

          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>CIF/NIF {(isNuevoProveedor || isNuevoAcreedor) && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                onChange={(e) => handleDatosProveedorChange('cif', e.target.value)}
                readOnly={!(isNuevoProveedor || isNuevoAcreedor)}
                className={!(isNuevoProveedor || isNuevoAcreedor) ? styles.fp5Readonly : ''}
                required={isNuevoProveedor || isNuevoAcreedor}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Razón Social {(isNuevoProveedor || isNuevoAcreedor) && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)}
                readOnly={!(isNuevoProveedor || isNuevoAcreedor)}
                className={!(isNuevoProveedor || isNuevoAcreedor) ? styles.fp5Readonly : ''}
                required={isNuevoProveedor || isNuevoAcreedor}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                onChange={(e) => handleDatosProveedorChange('cp', e.target.value)}
                readOnly={!(isNuevoProveedor || isNuevoAcreedor)}
                className={!(isNuevoProveedor || isNuevoAcreedor) ? styles.fp5Readonly : ''}
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
                {isNuevoProveedor ? 'Cuenta Proveedores (40000000)' : 
                 isNuevoAcreedor ? 'Cuenta Acreedores (40000000)' : 
                 'Cuenta del proveedor existente'}
              </small>
            </div>
          </div>
        </div>

        {/* Sección de Detalles Económicos */}
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
                      {tiposIVA.map(tipo => (
                        <option key={tipo.CodigoIva} value={tipo.PorcentajeIva}>
                          {tipo.PorcentajeIva}% - {tipo.Iva}
                        </option>
                      ))}
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
                  
                  {/* Campos de Retención CON CUENTA ABONO */}
                  <div className={styles.fp5FormGroup}>
                    <label>% Retención</label>
                    <select
                      value={line.retencion}
                      onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}
                    >
                      {tiposRetencion.map(tipo => (
                        <option key={tipo.CodigoRetencion} value={tipo.PorcentajeRetencion}>
                          {tipo.PorcentajeRetencion}% - {tipo.Retencion} (Cuenta: {tipo.CuentaAbono})
                        </option>
                      ))}
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
                
                {/* Información adicional de retención */}
                {line.retencion !== '0' && line.cuentaAbonoRetencion && (
                  <div className={styles.fp5RetencionInfo}>
                    <small>
                      📝 Retención {line.retencion}% - Cuenta de abono: <strong>{line.cuentaAbonoRetencion}</strong>
                    </small>
                  </div>
                )}
              </div>
            ))}
            
            <button type="button" className={styles.fp5AddBtn} onClick={addDetalleLine}>
              <FaPlus />
              Añadir línea de factura
            </button>
          </div>

          {/* Resumen de Totales */}
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

        {/* ✅ Sección de Archivo */}
        <div className={styles.fp5Section}>
          <h3>Archivo Adjunto</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Ruta Completa del Archivo</label>
              <input
                type="text"
                value={archivo}
                onChange={(e) => setArchivo(e.target.value)}
                placeholder="Ej: C:\Carpeta\Subcarpeta\archivo.pdf"
                className={styles.fp5FileInput}
              />
              <div className={styles.fp5FileInfo}>
                <small>
                  📁 <strong>INGRESE LA RUTA COMPLETA</strong> donde se encuentra el archivo PDF.<br />
                  <em>Ejemplo: C:\Documentos\Facturas\factura123.pdf</em>
                </small>
                {archivo && (
                  <div className={styles.fp5FileName}>
                    ✅ Ruta ingresada: <strong>{archivo}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen del Asiento - CORREGIDO CON CUENTA DE RETENCIÓN CORRECTA */}
        <div className={styles.fp5Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            {/* LÍNEA 1: PROVEEDOR HABER (FACTURA) */}
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuentaContable} - {getNombreCuentaProveedor()}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 2: GASTO DEBE (BASE) */}
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {getNombreCuentaGasto()}</span>
              <span>{totales.base.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 3: GASTO DEBE (IVA) */}
            {totales.iva > 0 && (
              <div className={styles.fp5ResumenItem}>
                <span>DEBE:</span>
                <span>{cuentaGasto} - IVA</span>
                <span>{totales.iva.toFixed(2)} €</span>
              </div>
            )}
            
            {/* LÍNEA 4: CAJA HABER (PAGO) */}
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>{cuentaCaja} - Caja</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 5: PROVEEDOR DEBE (PAGO) */}
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{datosCuentaP.cuentaContable} - {getNombreCuentaProveedor()}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            
            {/* LÍNEA 6: RETENCIÓN HABER CON CUENTA CORRECTA */}
            {totales.retencion > 0 && (
              <div className={styles.fp5ResumenItem}>
                <span>HABER:</span>
                <span>{getCuentaRetencion()} - Retenciones Practicadas</span>
                <span>{totales.retencion.toFixed(2)} €</span>
              </div>
            )}
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
            {loading ? 'Procesando...' : 'Crear Asiento de Pago'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;