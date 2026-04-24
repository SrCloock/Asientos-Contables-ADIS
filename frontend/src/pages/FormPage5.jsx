// pages/FormPage5.jsx - VERSIÓN COMPLETA CORREGIDA (redondeo + retención)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCashRegister, FaPlus, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

// Función de redondeo a 2 decimales (half-up)
const round2 = (value) => {
  if (isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
};

const FormPage5 = ({ user }) => {
  // Estados base
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Tipos desde BD
  const [tiposIVA, setTiposIVA] = useState([]);
  const [tiposRetencion, setTiposRetencion] = useState([]);
  const [cuentasGasto, setCuentasGasto] = useState([]);
  
  // Valores por defecto
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
  const [archivo, setArchivo] = useState('');
  
  // Detalles
  const [detalles, setDetalles] = useState([]);
  
  // Opciones para react-select
  const [proveedoresOptions, setProveedoresOptions] = useState([]);
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);

  // ✅ Contador +1
  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, {
          withCredentials: true
        });
        setNumAsiento(response.data.contador + 1);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    fetchContador();
  }, []);

  // Cargar datos maestros
  useEffect(() => {
    const fetchDatosMaestros = async () => {
      try {
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { withCredentials: true });
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

        const [proveedoresRes, cuentasRes, gastosRes, ivaRes, retencionRes] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/tipos-iva`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/tipos-retencion`, { withCredentials: true })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
        setCuentasGasto(gastosRes.data || []);
        
        // Tipos IVA
        const tiposIVAFormateados = ivaRes.data.map(tipo => ({
          ...tipo,
          PorcentajeIva: parseFloat(tipo.PorcentajeIva).toString()
        }));
        setTiposIVA(tiposIVAFormateados);
        setTiposIVALoaded(true);
        const iva21 = tiposIVAFormateados.find(t => t.PorcentajeIva === '21');
        if (iva21) setIvaDefault('21');
        else if (tiposIVAFormateados.length > 0) setIvaDefault(tiposIVAFormateados[0].PorcentajeIva);
        
        // Tipos retención
        const tiposRetencionFormateados = retencionRes.data.map(tipo => ({
          ...tipo,
          PorcentajeRetencion: parseFloat(tipo.PorcentajeRetencion).toString(),
          CuentaAbono: tipo.CuentaAbono || '475100000'
        }));
        setTiposRetencion(tiposRetencionFormateados);
        setTiposRetencionLoaded(true);
        const retencion0 = tiposRetencionFormateados.find(t => t.PorcentajeRetencion === '0');
        if (retencion0) setRetencionDefault('0');
        else if (tiposRetencionFormateados.length > 0) setRetencionDefault(tiposRetencionFormateados[0].PorcentajeRetencion);
        
        // Opciones proveedores
        const proveedoresOpts = [
          { value: '4000', label: '➕ NUEVO PROVEEDOR (40000000)', isNuevo: true, tipo: 'proveedor' },
          { value: '4100', label: '➕ NUEVO ACREEDOR (41000000)', isNuevo: true, tipo: 'acreedor' },
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
        
        // Opciones cuentas gasto
        const gastosOpts = gastosRes.data.map(cuenta => ({
          value: cuenta.id,
          label: `${cuenta.id} - ${cuenta.nombre}`,
          cuentaData: cuenta
        }));
        setCuentasGastoOptions(gastosOpts);
        if (gastosRes.data && gastosRes.data.length > 0) setCuentaGasto(gastosRes.data[0].id);
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

  // Inicializar detalles
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
  }, [tiposIVALoaded, tiposRetencionLoaded, ivaDefault, retencionDefault]);

  // Actualizar datos proveedor/acreedor
  useEffect(() => {
    if (cuentaP) {
      if (cuentaP === '4000' || cuentaP === '4100') {
        setDatosCuentaP({
          cif: '',
          nombre: '',
          cp: '',
          cuentaContable: '40000000' // ambos usan 40000000 según el original
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

  const handleDatosProveedorChange = (field, value) => {
    if (isNuevoProveedor || isNuevoAcreedor) {
      setDatosCuentaP(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleProveedorChange = (selectedOption) => {
    if (selectedOption) {
      setCuentaP(selectedOption.value);
      if (selectedOption.isNuevo) {
        setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '40000000' });
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
    if (selectedOption) setCuentaGasto(selectedOption.value);
    else setCuentaGasto('');
  };

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
    menu: (base) => ({ ...base, fontSize: '14px', zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? '#e6f3ff' : 'white',
      color: 'black',
      fontSize: '14px',
      cursor: 'pointer'
    }),
    singleValue: (base) => ({ ...base, fontSize: '14px' })
  };

  // ✅ Manejo de detalles con redondeo
  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;
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
      const cuotaIVA = round2((baseNum * tipoIVANum) / 100);
      const cuotaRetencion = round2((baseNum * retencionNum) / 100);
      newDetalles[index].cuotaIVA = cuotaIVA;
      newDetalles[index].cuotaRetencion = cuotaRetencion;
      newDetalles[index].importeTotalLinea = round2(baseNum + cuotaIVA - cuotaRetencion);
    } else {
      newDetalles[index].cuotaIVA = 0;
      newDetalles[index].cuotaRetencion = 0;
      newDetalles[index].importeTotalLinea = 0;
    }
    setDetalles(newDetalles);
  };

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

  // Cálculo de totales con redondeo acumulado
  const calcularTotales = () => {
    return detalles.reduce((acc, detalle) => {
      const base = parseFloat(detalle.base) || 0;
      const iva = parseFloat(detalle.cuotaIVA) || 0;
      const retencion = parseFloat(detalle.cuotaRetencion) || 0;
      if (base > 0) {
        return {
          base: round2(acc.base + base),
          iva: round2(acc.iva + iva),
          retencion: round2(acc.retencion + retencion),
          total: round2(acc.total + base + iva - retencion)
        };
      }
      return acc;
    }, { base: 0, iva: 0, retencion: 0, total: 0 });
  };

  const totales = calcularTotales();

  const validarFormulario = () => {
    const errores = [];
    if (!numDocumento.trim()) errores.push('Número de documento obligatorio');
    if (!concepto.trim()) errores.push('Concepto obligatorio');
    if (!cuentaP) errores.push('Debe seleccionar proveedor/acreedor');
    if (!cuentaGasto) errores.push('Debe seleccionar cuenta de gasto');
    if (isNuevoProveedor || isNuevoAcreedor) {
      if (!datosCuentaP.cif.trim()) errores.push('CIF/NIF obligatorio para nuevo proveedor/acreedor');
      if (!datosCuentaP.nombre.trim()) errores.push('Razón social obligatoria');
    }
    const lineasValidas = detalles.filter(d => d.base && parseFloat(d.base) > 0);
    if (lineasValidas.length === 0) errores.push('Debe ingresar al menos una línea con base > 0');
    return errores;
  };

  const formatFechaForBackend = (fechaString) => {
    if (!fechaString) return '';
    const fecha = new Date(fechaString);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errores = validarFormulario();
    if (errores.length > 0) {
      alert('Errores en el formulario:\n• ' + errores.join('\n• '));
      return;
    }
    setLoading(true);
    try {
      const fechaRegFormatted = formatFechaForBackend(fechaReg);
      const fechaFacturaFormatted = formatFechaForBackend(fechaFactura);
      const fechaOperFormatted = formatFechaForBackend(fechaOper);
      const comentarioCorto = concepto.trim().substring(0, 40);

      const datosEnvio = {
        serie,
        numDocumento,
        numFRA,
        fechaReg: fechaRegFormatted,
        fechaFactura: fechaFacturaFormatted,
        fechaOper: fechaOperFormatted,
        concepto,
        comentario: comentarioCorto,
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || '40000000',
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp,
          esAcreedor: isNuevoAcreedor
        },
        cuentaGasto,
        analitico,
        cuentaCaja,
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        archivo,
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalRetencion: totales.retencion,
        totalFactura: totales.total
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/pago-proveedor`, datosEnvio, { withCredentials: true });
      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Pago creado correctamente`);
        resetForm();
      } else {
        alert('❌ Error: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento:', error);
      alert('❌ Error: ' + (error.response?.data?.error || error.message));
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
    if (cuentasGastoOptions.length > 0) setCuentaGasto(cuentasGastoOptions[0].value);
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

  const getNombreCuentaGasto = () => {
    const cuenta = cuentasGasto.find(c => c.id === cuentaGasto);
    return cuenta ? cuenta.nombre : '';
  };

  const getNombreCuentaProveedor = () => {
    if (isNuevoProveedor) return 'Proveedores (Nuevo)';
    if (isNuevoAcreedor) return 'Acreedores (Nuevo)';
    const proveedor = proveedores.find(p => p.codigo === cuentaP);
    return proveedor ? proveedor.nombre : 'Proveedores';
  };

  const getCuentaRetencion = () => {
    if (detalles.length > 0 && detalles[0].cuentaAbonoRetencion) return detalles[0].cuentaAbonoRetencion;
    return '475100000';
  };

  return (
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2><FaCashRegister /> Pago Proveedor/Acreedor</h2>
        <div className={styles.fp5AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp5Form}>
        {/* Datos del Documento */}
        <div className={styles.fp5Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Serie</label>
              <input type="text" value={serie} readOnly className={styles.fp5Readonly} />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Nº Documento *</label>
              <input type="text" value={numDocumento} onChange={(e) => setNumDocumento(e.target.value)} required />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Nº Factura Proveedor/Acreedor</label>
              <input type="text" value={numFRA} onChange={(e) => setNumFRA(e.target.value)} />
            </div>
          </div>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Concepto *</label>
              <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
            </div>
          </div>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Fecha de Registro *</label>
              <input type="date" value={fechaReg} onChange={(e) => setFechaReg(e.target.value)} required />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Fecha de Factura *</label>
              <input type="date" value={fechaFactura} onChange={(e) => setFechaFactura(e.target.value)} required />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Fecha de Operación</label>
              <input type="date" value={fechaOper} onChange={(e) => setFechaOper(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Proveedor/Acreedor */}
        <div className={styles.fp5Section}>
          <h3>Datos del Proveedor/Acreedor</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Seleccionar Proveedor/Acreedor *</label>
              <Select
                options={proveedoresOptions}
                value={proveedoresOptions.find(option => option.value === cuentaP)}
                onChange={handleProveedorChange}
                placeholder="Buscar o seleccionar..."
                isSearchable
                styles={customStyles}
                required
              />
              <small>Seleccione "Nuevo Proveedor" (40000000) o "Nuevo Acreedor" (41000000)</small>
            </div>
          </div>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>CIF/NIF {(isNuevoProveedor || isNuevoAcreedor) && '*'}</label>
              <input type="text" value={datosCuentaP.cif} onChange={(e) => handleDatosProveedorChange('cif', e.target.value)} readOnly={!(isNuevoProveedor || isNuevoAcreedor)} className={!(isNuevoProveedor || isNuevoAcreedor) ? styles.fp5Readonly : ''} required={isNuevoProveedor || isNuevoAcreedor} />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Razón Social {(isNuevoProveedor || isNuevoAcreedor) && '*'}</label>
              <input type="text" value={datosCuentaP.nombre} onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)} readOnly={!(isNuevoProveedor || isNuevoAcreedor)} className={!(isNuevoProveedor || isNuevoAcreedor) ? styles.fp5Readonly : ''} required={isNuevoProveedor || isNuevoAcreedor} />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Código Postal</label>
              <input type="text" value={datosCuentaP.cp} onChange={(e) => handleDatosProveedorChange('cp', e.target.value)} readOnly={!(isNuevoProveedor || isNuevoAcreedor)} className={!(isNuevoProveedor || isNuevoAcreedor) ? styles.fp5Readonly : ''} />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Cuenta Contable Real</label>
              <input type="text" value={datosCuentaP.cuentaContable} readOnly className={styles.fp5Readonly} />
              <small>{isNuevoProveedor ? 'Cuenta Proveedores (40000000)' : isNuevoAcreedor ? 'Cuenta Acreedores (40000000)' : 'Cuenta del proveedor existente'}</small>
            </div>
          </div>
        </div>

        {/* Detalles Económicos */}
        <div className={styles.fp5Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Código Analítico</label>
              <input type="text" value={analitico} readOnly className={styles.fp5Readonly} />
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
                    <button type="button" className={styles.fp5RemoveBtn} onClick={() => removeDetalleLine(i)}>
                      <FaTrash /> Eliminar
                    </button>
                  )}
                </div>
                <div className={styles.fp5FormRow}>
                  <div className={styles.fp5FormGroup}>
                    <label>Base Imponible *</label>
                    <input type="number" step="0.01" min="0" value={line.base} onChange={(e) => handleDetalleChange(i, 'base', e.target.value)} required />
                  </div>
                  <div className={styles.fp5FormGroup}>
                    <label>Tipo IVA</label>
                    <select value={line.tipoIVA} onChange={(e) => handleDetalleChange(i, 'tipoIVA', e.target.value)}>
                      {tiposIVA.map(tipo => (
                        <option key={tipo.CodigoIva} value={tipo.PorcentajeIva}>{tipo.PorcentajeIva}% - {tipo.Iva}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fp5FormGroup}>
                    <label>Cuota IVA</label>
                    <input type="number" step="0.01" readOnly value={line.cuotaIVA.toFixed(2)} className={styles.fp5Readonly} />
                  </div>
                  <div className={styles.fp5FormGroup}>
                    <label>% Retención</label>
                    <select value={line.retencion} onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}>
                      {tiposRetencion.map(tipo => (
                        <option key={tipo.CodigoRetencion} value={tipo.PorcentajeRetencion}>
                          {tipo.PorcentajeRetencion}% - {tipo.Retencion} (Cuenta: {tipo.CuentaAbono})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fp5FormGroup}>
                    <label>Cuota Retención</label>
                    <input type="number" step="0.01" readOnly value={line.cuotaRetencion.toFixed(2)} className={styles.fp5Readonly} />
                  </div>
                  <div className={styles.fp5FormGroup}>
                    <label>Total Línea</label>
                    <input type="number" step="0.01" readOnly value={line.importeTotalLinea.toFixed(2)} className={styles.fp5Readonly} />
                  </div>
                </div>
                {line.retencion !== '0' && line.cuentaAbonoRetencion && (
                  <div className={styles.fp5RetencionInfo}>
                    <small>📝 Retención {line.retencion}% - Cuenta de abono: <strong>{line.cuentaAbonoRetencion}</strong></small>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className={styles.fp5AddBtn} onClick={addDetalleLine}>
              <FaPlus /> Añadir línea
            </button>
          </div>

          <div className={styles.fp5Totales}>
            <h4>Resumen de Totales:</h4>
            <div className={styles.fp5TotalItem}><span>Base Imponible:</span><span>{totales.base.toFixed(2)} €</span></div>
            <div className={styles.fp5TotalItem}><span>IVA:</span><span>+ {totales.iva.toFixed(2)} €</span></div>
            <div className={styles.fp5TotalItem}><span>Retención:</span><span>- {totales.retencion.toFixed(2)} €</span></div>
            <div className={`${styles.fp5TotalItem} ${styles.fp5TotalFinal}`}>
              <span><strong>TOTAL A PAGAR:</strong></span>
              <span><strong>{totales.total.toFixed(2)} €</strong></span>
            </div>
          </div>
        </div>

        {/* Archivo */}
        <div className={styles.fp5Section}>
          <h3>Archivo Adjunto</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Ruta Completa del Archivo</label>
              <input type="text" value={archivo} onChange={(e) => setArchivo(e.target.value)} placeholder="Ej: C:\Carpeta\archivo.pdf" className={styles.fp5FileInput} />
              <div className={styles.fp5FileInfo}>
                <small>📁 <strong>INGRESE LA RUTA COMPLETA</strong> del archivo PDF.<br /><em>Ejemplo: C:\Documentos\Facturas\factura123.pdf</em></small>
                {archivo && <div className={styles.fp5FileName}>✅ Ruta ingresada: <strong>{archivo}</strong></div>}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen del Asiento */}
        <div className={styles.fp5Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            <div className={styles.fp5ResumenItem}><span>HABER:</span><span>{datosCuentaP.cuentaContable} - {getNombreCuentaProveedor()}</span><span>{totales.total.toFixed(2)} €</span></div>
            <div className={styles.fp5ResumenItem}><span>DEBE:</span><span>{cuentaGasto} - {getNombreCuentaGasto()}</span><span>{totales.base.toFixed(2)} €</span></div>
            {totales.iva > 0 && <div className={styles.fp5ResumenItem}><span>DEBE:</span><span>{cuentaGasto} - IVA</span><span>{totales.iva.toFixed(2)} €</span></div>}
            <div className={styles.fp5ResumenItem}><span>HABER:</span><span>{cuentaCaja} - Caja</span><span>{totales.total.toFixed(2)} €</span></div>
            <div className={styles.fp5ResumenItem}><span>DEBE:</span><span>{datosCuentaP.cuentaContable} - {getNombreCuentaProveedor()}</span><span>{totales.total.toFixed(2)} €</span></div>
            {totales.retencion > 0 && <div className={styles.fp5ResumenItem}><span>HABER:</span><span>{getCuentaRetencion()} - Retenciones Practicadas</span><span>{totales.retencion.toFixed(2)} €</span></div>}
          </div>
        </div>

        <div className={styles.fp5ButtonGroup}>
          <button type="button" className={styles.fp5CancelBtn} onClick={() => window.history.back()} disabled={loading}>Cancelar</button>
          <button type="button" className={styles.fp5ClearBtn} onClick={resetForm} disabled={loading}>Limpiar</button>
          <button type="submit" className={styles.fp5SubmitBtn} disabled={loading || !cuentaP || !numDocumento || !concepto || !detalles.some(d => d.base && parseFloat(d.base) > 0) || !cuentaGasto}>
            {loading ? 'Procesando...' : 'Crear Asiento de Pago'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;