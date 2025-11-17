// pages/FormPage4.jsx - VERSIÓN ACTUALIZADA CON DATOS ANALÍTICOS AUTOMÁTICOS
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFileInvoiceDollar, FaPlus, FaTrash } from 'react-icons/fa';
import styles from '../styles/FormPage4.module.css';
import config from '../config/config';

const FormPage4 = ({ user }) => {
  // Estados del FormPage1
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Nuevos estados para datos maestros
  const [cuentasGasto, setCuentasGasto] = useState([]);
  const [cuentasProveedores, setCuentasProveedores] = useState([]);
  
  // DATOS ANALÍTICOS FIJOS desde tabla Clientes (sesión)
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
  const [vencimiento, setVencimiento] = useState('');
  
  // NUEVO CAMPO: Concepto obligatorio
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
  
  // Detalles adaptados para IVA no deducible CON RETENCIÓN
  const [detalles, setDetalles] = useState([
    { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      retencion: '15',
      cuotaRetencion: 0,
      importeTotalLinea: 0
    }
  ]);

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
          // Serie = CodigoCanal
          // Analítico = Serie (mismo valor que CodigoCanal)
          const serieValue = userData.codigoCanal || 'EM';
          setSerie(serieValue);
          setAnalitico(serieValue); // Analítico igual a Serie
          setCuentaCaja(userData.cuentaCaja || '570000000');
          
          setDatosAnaliticos({
            codigoCanal: userData.codigoCanal || '',
            codigoProyecto: userData.codigoProyecto || '',
            codigoSeccion: userData.codigoSeccion || '',
            codigoDepartamento: userData.codigoDepartamento || '',
            idDelegacion: userData.idDelegacion || ''
          });

          console.log('✅ Datos analíticos cargados:', {
            serie: serieValue,
            analitico: serieValue, // Mismo valor que serie
            cuentaCaja: userData.cuentaCaja,
            proyecto: userData.codigoProyecto,
            seccion: userData.codigoSeccion,
            departamento: userData.codigoDepartamento,
            delegacion: userData.idDelegacion
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
          console.log(`✅ Proveedor: ${proveedor.nombre}, Cuenta contable: ${cuentaProv?.cuenta}`);
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

  // MODIFICADO: Manejo de detalles - IVA NO DEDUCIBLE CON RETENCIÓN
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

  const addDetalleLine = () => {
    setDetalles([...detalles, { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      retencion: '15',
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

  // Manejo de archivos
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(`C:\\Users\\${user?.usuario || 'Usuario'}\\Desktop\\${file.name}`);
    }
  };

  // Envío del formulario - ACTUALIZADO CON NUEVOS CAMPOS
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errores = validarFormulario();
    if (errores.length > 0) {
      alert('Errores en el formulario:\n• ' + errores.join('\n• '));
      return;
    }

    setLoading(true);

    try {
      // COMENTARIO COMBINADO: Nº FRA - Concepto (formato corregido)
      const comentarioCombinado = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);

      const datosEnvio = {
        // Datos de documento
        serie,
        numDocumento,
        numFRA,
        fechaReg,
        fechaFactura,
        fechaOper,
        vencimiento,
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
        analitico, // Ahora es igual a serie
        
        // Detalles CON RETENCIÓN
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // Archivo
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
        alert(`✅ Asiento #${response.data.asiento} - Factura Proveedor (IVA Incluido) creado correctamente\nLíneas creadas: ${lineasCreadas}`);
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
      tipoIVA: '21', 
      cuotaIVA: 0, 
      retencion: '15',
      cuotaRetencion: 0,
      importeTotalLinea: 0 
    }]);
    setArchivo(null);
    
    // Restablecer cuenta de gasto
    if (cuentasGasto.length > 0) {
      setCuentaGasto(cuentasGasto[0].id);
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

  return (
    <div className={styles.fp4Container}>
      <div className={styles.fp4Header}>
        <h2>
          <FaFileInvoiceDollar />
          Factura de Proveedor
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
              <label>Nº Factura Proveedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor"
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
                placeholder="Descripción del gasto/proveedor"
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
            </div>
          </div>
        </div>

        {/* Sección de Datos del Proveedor - CON OPCIÓN NUEVO PROVEEDOR */}
        <div className={styles.fp4Section}>
          <h3>Datos del Proveedor</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
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
                    {prov.codigo} - {prov.nombre} - Cuenta: {proveedoresCuentas.find(p => p.codigo === prov.codigo)?.cuenta || '400000000'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CAMPOS DE PROVEEDOR - EDITABLES SI ES NUEVO */}
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>CIF/NIF {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                onChange={(e) => handleDatosProveedorChange('cif', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp4Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Razón Social {isNuevoProveedor && '*'}</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                onChange={(e) => handleDatosProveedorChange('nombre', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp4Readonly : ''}
                required={isNuevoProveedor}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                onChange={(e) => handleDatosProveedorChange('cp', e.target.value)}
                readOnly={!isNuevoProveedor}
                className={!isNuevoProveedor ? styles.fp4Readonly : ''}
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
            </div>
          </div>
        </div>

        {/* Sección de Detalles Económicos - CON RETENCIÓN AÑADIDA */}
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
                      <option value="21">21% General</option>
                      <option value="10">10% Reducido</option>
                      <option value="4">4% Superreducido</option>
                      <option value="0">0% Exento</option>
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
                  
                  {/* Campos de Retención */}
                  <div className={styles.fp4FormGroup}>
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
              <span>IVA:</span>
              <span>+ {totales.iva.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4TotalItem}>
              <span>Retención:</span>
              <span>- {totales.retencion.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4TotalItem + ' ' + styles.fp4TotalFinal}>
              <span>
                <strong>TOTAL FACTURA:</strong>
              </span>
              <span>
                <strong>{totales.total.toFixed(2)} €</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Sección de Archivo */}
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
              {archivo && (
                <span className={styles.fp4FileName}>{archivo}</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumen del Asiento - ACTUALIZADO */}
        <div className={styles.fp4Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp4Resumen}>
            <div className={styles.fp4ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {getNombreCuentaGasto()}</span>
              <span>{totales.base.toFixed(2)} €</span>
            </div>
            {totales.iva > 0 && (
              <div className={styles.fp4ResumenItem}>
                <span>DEBE:</span>
                <span>629000000 - IVA No Deducible</span>
                <span>{totales.iva.toFixed(2)} €</span>
              </div>
            )}
            <div className={styles.fp4ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuentaContable} - Proveedores</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
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