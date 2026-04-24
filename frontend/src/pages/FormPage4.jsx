// pages/FormPage4.jsx - Cuota IVA editable (override manual)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFileInvoiceDollar, FaPlus, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../styles/FormPage4.module.css';
import config from '../config/config';

const round2 = (value) => {
  if (isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
};

const FormPage4 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tiposIVA, setTiposIVA] = useState([]);
  const [tiposRetencion, setTiposRetencion] = useState([]);
  const [cuentasGasto, setCuentasGasto] = useState([]);
  const [ivaDefault, setIvaDefault] = useState('21');
  const [retencionDefault, setRetencionDefault] = useState('0');
  const [serie, setSerie] = useState('');
  const [analitico, setAnalitico] = useState('');
  const [cuentaCaja, setCuentaCaja] = useState('');
  const [datosAnaliticos, setDatosAnaliticos] = useState({
    codigoCanal: '', codigoProyecto: '', codigoSeccion: '', codigoDepartamento: '', idDelegacion: ''
  });
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [concepto, setConcepto] = useState('');
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '', cuentaContable: '' });
  const isNuevoProveedor = cuentaP === '4000';
  const isNuevoAcreedor = cuentaP === '4100';
  const isNuevo = isNuevoProveedor || isNuevoAcreedor;
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [archivo, setArchivo] = useState('');
  const [detalles, setDetalles] = useState([]);
  const [proveedoresOptions, setProveedoresOptions] = useState([]);
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);
  const [tiposIVALoaded, setTiposIVALoaded] = useState(false);
  const [tiposRetencionLoaded, setTiposRetencionLoaded] = useState(false);

  // ----------------------------------------------------------------------
  // Efectos (igual que antes, sin cambios)
  // ----------------------------------------------------------------------
  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, { withCredentials: true });
        setNumAsiento(response.data.contador + 1);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    fetchContador();
  }, []);

  useEffect(() => {
    const fetchDatosMaestros = async () => {
      try {
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { withCredentials: true });
        if (sessionRes.data.authenticated) {
          const userData = sessionRes.data.user;
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
        
        const tiposIVAFormateados = ivaRes.data.map(tipo => ({
          ...tipo, PorcentajeIva: parseFloat(tipo.PorcentajeIva).toString()
        }));
        setTiposIVA(tiposIVAFormateados);
        setTiposIVALoaded(true);
        const iva21 = tiposIVAFormateados.find(t => t.PorcentajeIva === '21');
        if (iva21) setIvaDefault('21');
        else if (tiposIVAFormateados.length > 0) setIvaDefault(tiposIVAFormateados[0].PorcentajeIva);
        
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
        
        const proveedoresOpts = [
          { value: '4000', label: '➕ NUEVO PROVEEDOR (40000000)', isNuevo: true, tipoCuenta: 'proveedor' },
          { value: '4100', label: '➕ NUEVO ACREEDOR (41000000)', isNuevo: true, tipoCuenta: 'acreedor' },
          ...proveedoresRes.data.map(prov => {
            const cuentaProv = cuentasRes.data.find(p => p.codigo === prov.codigo);
            return {
              value: prov.codigo,
              label: `${prov.codigo} - ${prov.nombre} - Cuenta: ${cuentaProv?.cuenta || '40000000'}`,
              proveedorData: prov,
              cuentaData: cuentaProv,
              tipoCuenta: 'existente'
            };
          })
        ];
        setProveedoresOptions(proveedoresOpts);
        
        const gastosOpts = gastosRes.data.map(cuenta => ({
          value: cuenta.id, label: `${cuenta.id} - ${cuenta.nombre}`, cuentaData: cuenta
        }));
        setCuentasGastoOptions(gastosOpts);
        if (gastosRes.data.length > 0) setCuentaGasto(gastosRes.data[0].id);
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        setSerie('EM'); setAnalitico('EM'); setCuentaCaja('570000000'); setCuentaGasto('600000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  useEffect(() => {
    if (tiposIVALoaded && tiposRetencionLoaded && detalles.length === 0) {
      const retencionDefaultTipo = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
      setDetalles([{ 
        base: '', tipoIVA: ivaDefault, cuotaIVA: 0, ivaOverride: null,
        retencion: retencionDefault, codigoRetencion: retencionDefaultTipo?.CodigoRetencion || '0',
        cuentaAbonoRetencion: retencionDefaultTipo?.CuentaAbono || '475100000',
        cuotaRetencion: 0, importeTotalLinea: 0
      }]);
    }
  }, [tiposIVALoaded, tiposRetencionLoaded, ivaDefault, retencionDefault]);

  useEffect(() => {
    if (cuentaP) {
      if (cuentaP === '4000') setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '40000000' });
      else if (cuentaP === '4100') setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '41000000' });
      else {
        const proveedor = proveedores.find(p => p.codigo === cuentaP);
        const cuentaProv = proveedoresCuentas.find(p => p.codigo === cuentaP);
        if (proveedor) setDatosCuentaP({
          cif: proveedor.cif || '', nombre: proveedor.nombre || '', cp: proveedor.cp || '',
          cuentaContable: cuentaProv?.cuenta || '40000000'
        });
      }
    }
  }, [cuentaP, proveedores, proveedoresCuentas]);

  // ----------------------------------------------------------------------
  // Manejadores
  // ----------------------------------------------------------------------
  const handleDatosProveedorChange = (field, value) => {
    if (isNuevo) setDatosCuentaP(prev => ({ ...prev, [field]: value }));
  };

  const handleProveedorChange = (selectedOption) => {
    if (selectedOption) {
      setCuentaP(selectedOption.value);
      if (selectedOption.isNuevo) {
        if (selectedOption.tipoCuenta === 'proveedor') setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '40000000' });
        else if (selectedOption.tipoCuenta === 'acreedor') setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '41000000' });
      } else {
        const proveedor = selectedOption.proveedorData;
        const cuentaProv = selectedOption.cuentaData;
        if (proveedor) setDatosCuentaP({
          cif: proveedor.cif || '', nombre: proveedor.nombre || '', cp: proveedor.cp || '',
          cuentaContable: cuentaProv?.cuenta || '40000000'
        });
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
      ...base, border: '1px solid #ccc', borderRadius: '4px', minHeight: '38px', fontSize: '14px',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(0,123,255,0.25)' : 'none',
      borderColor: state.isFocused ? '#80bdff' : '#ccc'
    }),
    menu: (base) => ({ ...base, fontSize: '14px', zIndex: 9999 }),
    option: (base, state) => ({
      ...base, backgroundColor: state.isFocused ? '#e6f3ff' : 'white', color: 'black', fontSize: '14px', cursor: 'pointer'
    }),
    singleValue: (base) => ({ ...base, fontSize: '14px' })
  };

  // --------------------------------------------------------------
  // Manejo de líneas con Cuota IVA editable
  // --------------------------------------------------------------
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
    
    // Si no se está editando la cuota IVA, la recalculamos (a menos que haya un override previo)
    if (field !== 'cuotaIVA') {
      let cuotaIVACalc = round2((baseNum * tipoIVANum) / 100);
      // Si existe un override manual, lo respetamos (no se recalcula)
      if (newDetalles[index].ivaOverride !== null && newDetalles[index].ivaOverride !== undefined) {
        cuotaIVACalc = newDetalles[index].ivaOverride;
      }
      newDetalles[index].cuotaIVA = cuotaIVACalc;
    }
    // Recalcular retención y total
    const cuotaRetencion = round2((baseNum * retencionNum) / 100);
    newDetalles[index].cuotaRetencion = cuotaRetencion;
    const totalLinea = round2(baseNum + newDetalles[index].cuotaIVA - cuotaRetencion);
    newDetalles[index].importeTotalLinea = totalLinea;

    setDetalles(newDetalles);
  };

  // Manejo específico de cambio manual en Cuota IVA
  const handleCuotaIvaChange = (index, value) => {
    const newDetalles = [...detalles];
    const ivaNum = parseFloat(value);
    if (!isNaN(ivaNum) && ivaNum >= 0) {
      newDetalles[index].cuotaIVA = ivaNum;
      newDetalles[index].ivaOverride = ivaNum;
    } else {
      // Si se borra o inválido, recalcular automáticamente
      const baseNum = parseFloat(newDetalles[index].base) || 0;
      const tipoIVANum = parseFloat(newDetalles[index].tipoIVA) || 0;
      const ivaCalc = round2((baseNum * tipoIVANum) / 100);
      newDetalles[index].cuotaIVA = ivaCalc;
      newDetalles[index].ivaOverride = null;
    }
    // Recalcular total con la nueva cuota IVA
    const baseNum = parseFloat(newDetalles[index].base) || 0;
    const retencionNum = parseFloat(newDetalles[index].retencion) || 0;
    const cuotaRetencion = round2((baseNum * retencionNum) / 100);
    newDetalles[index].cuotaRetencion = cuotaRetencion;
    const totalLinea = round2(baseNum + newDetalles[index].cuotaIVA - cuotaRetencion);
    newDetalles[index].importeTotalLinea = totalLinea;
    setDetalles(newDetalles);
  };

  const addDetalleLine = () => {
    const retencionDefaultTipo = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
    setDetalles([...detalles, { 
      base: '', tipoIVA: ivaDefault, cuotaIVA: 0, ivaOverride: null,
      retencion: retencionDefault, codigoRetencion: retencionDefaultTipo?.CodigoRetencion || '0',
      cuentaAbonoRetencion: retencionDefaultTipo?.CuentaAbono || '475100000',
      cuotaRetencion: 0, importeTotalLinea: 0
    }]);
  };

  const removeDetalleLine = (index) => {
    if (detalles.length > 1) {
      const newDetalles = [...detalles];
      newDetalles.splice(index, 1);
      setDetalles(newDetalles);
    }
  };

  const calcularTotales = () => {
    let baseSum = 0, ivaSum = 0, retSum = 0, totalSum = 0;
    detalles.forEach(detalle => {
      const base = parseFloat(detalle.base) || 0;
      const iva = parseFloat(detalle.cuotaIVA) || 0;
      const ret = parseFloat(detalle.cuotaRetencion) || 0;
      let totalLinea = parseFloat(detalle.importeTotalLinea) || 0;
      if (base > 0) {
        baseSum = round2(baseSum + base);
        ivaSum = round2(ivaSum + iva);
        retSum = round2(retSum + ret);
        totalSum = round2(totalSum + totalLinea);
      }
    });
    return { base: baseSum, iva: ivaSum, retencion: retSum, total: totalSum };
  };

  const totales = calcularTotales();

  const validarFormulario = () => {
    const errores = [];
    if (!vencimiento) errores.push('La fecha de vencimiento es obligatoria');
    if (!numDocumento.trim()) errores.push('El número de documento es obligatorio');
    if (!concepto.trim()) errores.push('El concepto es obligatorio');
    if (!cuentaP) errores.push('Debe seleccionar un proveedor/acreedor');
    if (!cuentaGasto) errores.push('Debe seleccionar una cuenta de gasto');
    if (isNuevo) {
      if (!datosCuentaP.cif.trim()) errores.push('El CIF/NIF es obligatorio para nuevo proveedor/acreedor');
      if (!datosCuentaP.nombre.trim()) errores.push('La razón social es obligatoria');
    }
    const lineasValidas = detalles.filter(d => d.base && parseFloat(d.base) > 0);
    if (lineasValidas.length === 0) errores.push('Debe ingresar al menos una línea con base imponible > 0');
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
      const vencimientoFormatted = formatFechaForBackend(vencimiento);
      const comentarioCorto = concepto.trim().substring(0, 40);

      const detallesEnvio = detalles
        .filter(d => d.base && parseFloat(d.base) > 0)
        .map(d => ({
          base: parseFloat(d.base),
          tipoIVA: d.tipoIVA,
          retencion: d.retencion,
          codigoRetencion: d.codigoRetencion,
          cuentaAbonoRetencion: d.cuentaAbonoRetencion,
          cuotaIVA: parseFloat(d.cuotaIVA),
          ivaOverride: d.ivaOverride !== null ? d.ivaOverride : null
        }));

      const datosEnvio = {
        serie, numDocumento, numFRA,
        fechaReg: fechaRegFormatted, fechaFactura: fechaFacturaFormatted, fechaOper: fechaOperFormatted,
        vencimiento: vencimientoFormatted, concepto, comentario: comentarioCorto,
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || (isNuevoAcreedor ? '41000000' : '40000000'),
          codigoProveedor: cuentaP, cif: datosCuentaP.cif, nombre: datosCuentaP.nombre, cp: datosCuentaP.cp,
          esAcreedor: isNuevoAcreedor
        },
        cuentaGasto, analitico, detalles: detallesEnvio, archivo,
        totalBase: totales.base, totalIVA: totales.iva, totalRetencion: totales.retencion, totalFactura: totales.total
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/factura-iva-no-deducible`, datosEnvio, { withCredentials: true });
      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} creado correctamente`);
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
    setVencimiento('');
    setArchivo('');
    const retencionDefaultTipo = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
    setDetalles([{ 
      base: '', tipoIVA: ivaDefault, cuotaIVA: 0, ivaOverride: null,
      retencion: retencionDefault, codigoRetencion: retencionDefaultTipo?.CodigoRetencion || '0',
      cuentaAbonoRetencion: retencionDefaultTipo?.CuentaAbono || '475100000',
      cuotaRetencion: 0, importeTotalLinea: 0
    }]);
    if (cuentasGastoOptions.length > 0) setCuentaGasto(cuentasGastoOptions[0].value);
    const fetchNewContador = async () => {
      try {
        const response = await axios.get(`${config.apiBaseUrl}/api/contador`, { withCredentials: true });
        setNumAsiento(response.data.contador + 1);
      } catch (error) { console.error('Error obteniendo contador:', error); }
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

  // ----------------------------------------------------------------------
  // Renderizado
  // ----------------------------------------------------------------------
  return (
    <div className={styles.fp4Container}>
      <div className={styles.fp4Header}>
        <h2><FaFileInvoiceDollar /> Factura de Proveedor/Acreedor (IVA No Deducible)</h2>
        <div className={styles.fp4AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp4Form}>
        {/* Datos del Documento */}
        <div className={styles.fp4Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Serie</label>
              <input type="text" value={serie} readOnly className={styles.fp4Readonly} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Nº Documento *</label>
              <input type="text" value={numDocumento} onChange={(e) => setNumDocumento(e.target.value)} required />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Nº Factura Proveedor/Acreedor</label>
              <input type="text" value={numFRA} onChange={(e) => setNumFRA(e.target.value)} />
            </div>
          </div>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Concepto *</label>
              <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
            </div>
          </div>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Registro *</label>
              <input type="date" value={fechaReg} onChange={(e) => setFechaReg(e.target.value)} required />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Factura *</label>
              <input type="date" value={fechaFactura} onChange={(e) => setFechaFactura(e.target.value)} required />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Operación</label>
              <input type="date" value={fechaOper} onChange={(e) => setFechaOper(e.target.value)} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Vencimiento *</label>
              <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Proveedor/Acreedor */}
        <div className={styles.fp4Section}>
          <h3>Datos del Proveedor/Acreedor</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
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
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>CIF/NIF {isNuevo && '*'}</label>
              <input type="text" value={datosCuentaP.cif} onChange={(e) => handleDatosProveedorChange('cif', e.target.value)} readOnly={!isNuevo} className={!isNuevo ? styles.fp4Readonly : ''} required={isNuevo} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Razón Social {isNuevo && '*'}</label>
              <input type="text" value={datosCuentaP.nombre} onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)} readOnly={!isNuevo} className={!isNuevo ? styles.fp4Readonly : ''} required={isNuevo} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Código Postal</label>
              <input type="text" value={datosCuentaP.cp} onChange={(e) => handleDatosProveedorChange('cp', e.target.value)} readOnly={!isNuevo} className={!isNuevo ? styles.fp4Readonly : ''} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Cuenta Contable Real</label>
              <input type="text" value={datosCuentaP.cuentaContable} readOnly className={styles.fp4Readonly} />
            </div>
          </div>
        </div>

        {/* Detalles Económicos */}
        <div className={styles.fp4Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Código Analítico</label>
              <input type="text" value={analitico} readOnly className={styles.fp4Readonly} />
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
                    <button type="button" className={styles.fp4RemoveBtn} onClick={() => removeDetalleLine(i)}>
                      <FaTrash /> Eliminar
                    </button>
                  )}
                </div>
                <div className={styles.fp4FormRow}>
                  <div className={styles.fp4FormGroup}>
                    <label>Base Imponible *</label>
                    <input type="number" step="0.01" min="0" value={line.base} onChange={(e) => handleDetalleChange(i, 'base', e.target.value)} required />
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Tipo IVA</label>
                    <select value={line.tipoIVA} onChange={(e) => handleDetalleChange(i, 'tipoIVA', e.target.value)}>
                      {tiposIVA.map(tipo => (
                        <option key={tipo.CodigoIva} value={tipo.PorcentajeIva}>{tipo.PorcentajeIva}% - {tipo.Iva}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Cuota IVA *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.cuotaIVA.toFixed(2)}
                      onChange={(e) => handleCuotaIvaChange(i, e.target.value)}
                      className={styles.fp4Editable}
                    />
                    <small>Puede editar manualmente la cuota de IVA</small>
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>% Retención</label>
                    <select value={line.retencion} onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}>
                      {tiposRetencion.map(tipo => (
                        <option key={tipo.CodigoRetencion} value={tipo.PorcentajeRetencion}>
                          {tipo.PorcentajeRetencion}% - {tipo.Retencion} (Cuenta: {tipo.CuentaAbono})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Cuota Retención</label>
                    <input type="number" step="0.01" readOnly value={line.cuotaRetencion.toFixed(2)} className={styles.fp4Readonly} />
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Total Línea</label>
                    <input type="number" step="0.01" readOnly value={line.importeTotalLinea.toFixed(2)} className={styles.fp4Readonly} />
                  </div>
                </div>
                {line.retencion !== '0' && line.cuentaAbonoRetencion && (
                  <div className={styles.fp4RetencionInfo}>
                    <small>📝 Retención {line.retencion}% - Cuenta de abono: <strong>{line.cuentaAbonoRetencion}</strong></small>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className={styles.fp4AddBtn} onClick={addDetalleLine}>
              <FaPlus /> Añadir línea
            </button>
          </div>

          <div className={styles.fp4Totales}>
            <h4>Resumen de Totales:</h4>
            <div className={styles.fp4TotalItem}><span>Base Imponible:</span><span>{totales.base.toFixed(2)} €</span></div>
            <div className={styles.fp4TotalItem}><span>IVA (No Deducible):</span><span>+ {totales.iva.toFixed(2)} €</span></div>
            <div className={styles.fp4TotalItem}><span>Retención:</span><span>- {totales.retencion.toFixed(2)} €</span></div>
            <div className={`${styles.fp4TotalItem} ${styles.fp4TotalFinal}`}>
              <span><strong>TOTAL A PAGAR:</strong></span>
              <span><strong>{totales.total.toFixed(2)} €</strong></span>
            </div>
          </div>
        </div>

        {/* Archivo Adjunto */}
        <div className={styles.fp4Section}>
          <h3>Archivo Adjunto</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Ruta Completa del Archivo</label>
              <input type="text" value={archivo} onChange={(e) => setArchivo(e.target.value)} placeholder="Ej: C:\Carpeta\archivo.pdf" className={styles.fp4FileInput} />
              <div className={styles.fp4FileInfo}>
                <small>📁 <strong>INGRESE LA RUTA COMPLETA</strong> del archivo PDF.<br /><em>Ejemplo: C:\Documentos\Facturas\factura123.pdf</em></small>
                {archivo && <div className={styles.fp4FileName}>✅ Ruta ingresada: <strong>{archivo}</strong></div>}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen del Asiento */}
        <div className={styles.fp4Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp4Resumen}>
            <div className={styles.fp4ResumenItem}><span>DEBE:</span><span>{cuentaGasto} - {getNombreCuentaGasto()}</span><span>{totales.base.toFixed(2)} €</span></div>
            {totales.iva > 0 && <div className={styles.fp4ResumenItem}><span>DEBE:</span><span>{cuentaGasto} - IVA No Deducible</span><span>{totales.iva.toFixed(2)} €</span></div>}
            <div className={styles.fp4ResumenItem}><span>HABER:</span><span>{datosCuentaP.cuentaContable} - {getNombreCuentaProveedor()}</span><span>{totales.total.toFixed(2)} €</span></div>
            {totales.retencion > 0 && <div className={styles.fp4ResumenItem}><span>HABER:</span><span>{getCuentaRetencion()} - Retenciones Practicadas</span><span>{totales.retencion.toFixed(2)} €</span></div>}
          </div>
        </div>

        <div className={styles.fp4ButtonGroup}>
          <button type="button" className={styles.fp4CancelBtn} onClick={() => window.history.back()} disabled={loading}>Cancelar</button>
          <button type="button" className={styles.fp4ClearBtn} onClick={resetForm} disabled={loading}>Limpiar</button>
          <button type="submit" className={styles.fp4SubmitBtn} disabled={loading || !cuentaP || !numDocumento || !concepto || !detalles.some(d => d.base && parseFloat(d.base) > 0) || !vencimiento || !cuentaGasto}>
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage4;