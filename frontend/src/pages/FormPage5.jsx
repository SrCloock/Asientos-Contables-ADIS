// pages/FormPage5.jsx - VERSIÓN COMPLETA CON NUEVO PROVEEDOR
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHandHoldingUsd, FaPlus, FaTrash } from 'react-icons/fa';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

const FormPage5 = ({ user }) => {
  // Estados
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
  
  // Campos de documento (IGUALES A FORMPAGE4 excepto vencimiento)
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
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [cuentasGasto, setCuentasGasto] = useState([]);
  
  // Detalles de la factura SIN RETENCIÓN
  const [detalles, setDetalles] = useState([
    { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
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
        
        console.log(`✅ FormPage5 - Serie: ${serieConC} (base: ${serieCliente}), Analítico: ${analiticoCliente}, Caja: ${cuentaCajaRes.data?.cuentaCaja}`);
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        setSerie('CEM');
        setAnalitico('EM');
        setCuentaCaja('570000000');
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

  // Manejo de detalles SIN RETENCIÓN
  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;

    const baseNum = parseFloat(newDetalles[index].base) || 0;
    const tipoIVANum = parseFloat(newDetalles[index].tipoIVA) || 0;
    
    if (!isNaN(baseNum) && baseNum >= 0) {
      const cuotaIVA = (baseNum * tipoIVANum) / 100;
      newDetalles[index].cuotaIVA = cuotaIVA;
      newDetalles[index].importeTotalLinea = baseNum + cuotaIVA;
    } else {
      newDetalles[index].cuotaIVA = 0;
      newDetalles[index].importeTotalLinea = 0;
    }
    
    setDetalles(newDetalles);
  };

  const addDetalleLine = () => {
    setDetalles([...detalles, { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
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

  // Cálculo de totales SIN RETENCIÓN
  const calcularTotales = () => {
    return detalles.reduce((acc, detalle) => {
      const base = parseFloat(detalle.base) || 0;
      const iva = parseFloat(detalle.cuotaIVA) || 0;
      
      if (base > 0) {
        return {
          base: acc.base + base,
          iva: acc.iva + iva,
          total: acc.total + base + iva
        };
      }
      return acc;
    }, { base: 0, iva: 0, total: 0 });
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
      // COMENTARIO COMBINADO: Nº FRA - Concepto (formato corregido)
      const comentarioCombinado = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);

      const datosEnvio = {
        // Datos de documento (IGUALES A FORMPAGE4)
        serie,
        numDocumento,
        numFRA,
        fechaReg,
        fechaFactura,
        fechaOper,
        concepto,
        comentario: comentarioCombinado,
        
        // Datos de proveedor
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
        cuentaCaja,
        
        // Detalles SIN RETENCIÓN
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // Archivo
        archivo: archivo,
        
        // Totales SIN RETENCIÓN
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalFactura: totales.total
      };

      console.log('📤 Enviando datos FormPage5:', datosEnvio);

      const response = await axios.post(
        `${config.apiBaseUrl}/api/asiento/compra-pago`, 
        datosEnvio, 
        { withCredentials: true }
      );

      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Compra con Pago creado correctamente`);
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
    setDetalles([{ 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      importeTotalLinea: 0 
    }]);
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

  // Obtener nombre de la cuenta seleccionada
  const getNombreCuentaGasto = () => {
    const cuenta = cuentasGasto.find(c => c.id === cuentaGasto);
    return cuenta ? cuenta.nombre : '';
  };

  return (
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2>
          <FaHandHoldingUsd />
          Compra con Pago Inmediato - CON NUEVO PROVEEDOR
        </h2>
        <div className={styles.fp5AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
          <span>Serie: <strong>{serie}</strong> (base: {serieBase})</span>
          <span>Analítico: <strong>{analitico}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp5Form}>
        {/* Sección de Datos del Documento - IGUAL A FORMPAGE4 */}
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
              <label>Nº Factura Proveedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor"
              />
            </div>
          </div>
          
          {/* Campo Concepto */}
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

        {/* Sección de Datos del Proveedor - CON OPCIÓN NUEVO PROVEEDOR */}
        <div className={styles.fp5Section}>
          <h3>Datos del Proveedor</h3>
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
                    {prov.codigo} - {prov.nombre} - Cuenta: {proveedoresCuentas.find(p => p.codigo === prov.codigo)?.cuenta || '400000000'}
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

        {/* Sección de Detalles Económicos SIN RETENCIÓN */}
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
            </div>
            <div className={styles.fp5FormGroup}>
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

          {/* Resumen de Totales SIN RETENCIÓN */}
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
            <div className={styles.fp5TotalItem + ' ' + styles.fp5TotalFinal}>
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
              {archivo && (
                <span className={styles.fp5FileName}>{archivo}</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumen del Asiento SIN RETENCIÓN */}
        <div className={styles.fp5Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {getNombreCuentaGasto()}</span>
              <span>{totales.base.toFixed(2)} €</span>
            </div>
            {totales.iva > 0 && (
              <div className={styles.fp5ResumenItem}>
                <span>DEBE:</span>
                <span>472000000 - IVA Soportado</span>
                <span>{totales.iva.toFixed(2)} €</span>
              </div>
            )}
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuentaContable} - Proveedores</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            {/* Línea de pago en caja */}
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{datosCuentaP.cuentaContable} - Proveedores</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>{cuentaCaja} - Caja</span>
              <span>{totales.total.toFixed(2)} €</span>
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
            {loading ? 'Procesando...' : 'Crear Asiento de Compra con Pago'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;