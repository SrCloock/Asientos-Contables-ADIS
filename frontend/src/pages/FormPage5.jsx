// pages/FormPage5.jsx - VERSIÓN COMPLETA Y CORREGIDA
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
  
  // SERIE Y ANALITICO FIJOS desde tabla Clientes
  const [serie, setSerie] = useState('');
  const [analitico, setAnalitico] = useState('');
  
  // CUENTA CAJA desde tabla Clientes
  const [cuentaCaja, setCuentaCaja] = useState('');
  
  // Campos de documento
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
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
  
  // Campos específicos para el pago
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [cuentasGasto, setCuentasGasto] = useState([]);
  
  // Detalles de la factura
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
        
        // SERIE Y ANALITICO FIJOS
        const serieCliente = canalRes.data?.serie || 'EM';
        const analiticoCliente = canalRes.data?.analitico || 'EM';
        setSerie(serieCliente);
        setAnalitico(analiticoCliente);
        
        // CUENTA CAJA
        setCuentaCaja(cuentaCajaRes.data?.cuentaCaja || '570000000');
        
        // Establecer primera cuenta de gasto por defecto si existe
        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        }
        
        console.log(`✅ FormPage5 - Serie: ${serieCliente}, Analítico: ${analiticoCliente}, Caja: ${cuentaCajaRes.data?.cuentaCaja}`);
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        // Valores por defecto en caso de error
        setSerie('EM');
        setAnalitico('EM');
        setCuentaCaja('570000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // Actualizar datos proveedor - USAR CUENTA CONTABLE REAL
  useEffect(() => {
    if (cuentaP) {
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
  }, [cuentaP, proveedores, proveedoresCuentas]);

  // Manejo de detalles
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

  // Cálculo de totales
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
    if (!cuentaP) {
      errores.push('Debe seleccionar un proveedor');
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
      const datosEnvio = {
        // Datos de documento
        serie,
        numDocumento,
        fechaReg,
        concepto,
        comentario: concepto,
        analitico,
        
        // Datos de proveedor
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable,
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp
        },
        
        // Datos específicos del pago
        cuentaGasto,
        cuentaCaja,
        
        // Detalles
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // Totales
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalFactura: totales.total,
        
        // Archivo
        archivo: archivo
      };

      console.log('📤 Enviando datos FormPage5:', datosEnvio);

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/pago-caja-proveedor`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Pago en Caja a Proveedor creado correctamente`);
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
    setConcepto('');
    setDetalles([{ base: '', tipoIVA: '21', cuotaIVA: 0, importeTotalLinea: 0 }]);
    setArchivo(null);
    
    // Restablecer cuenta de gasto a la primera opción
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

  return (
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2>
          <FaHandHoldingUsd />
          Pago en Caja a Proveedor - CORREGIDO
        </h2>
        <div className={styles.fp5AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
          <span>Serie: <strong>{serie}</strong></span>
          <span>Analítico: <strong>{analitico}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <div className={styles.fp5Description}>
        <p>
          <strong>Objetivo:</strong> Registrar compra a proveedor con pago inmediato en caja (IVA INCLUIDO).
        </p>
        <div className={styles.fp5AsientoType}>
          <span><strong>Asiento:</strong> 4 líneas (Gasto → Proveedor Haber → Proveedor Debe → Caja)</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp5Form}>
        {/* Sección de Datos del Documento */}
        <div className={styles.fp5Section}>
          <h3>📄 Datos del Documento</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Serie (Fija del usuario)</label>
              <input 
                type="text" 
                value={serie}
                readOnly
                className={styles.fp5Readonly}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Nº Documento * (Va a NumeroDoc)</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento"
                required
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Fecha de Registro *</label>
              <input
                type="date"
                value={fechaReg}
                onChange={(e) => setFechaReg(e.target.value)}
                required
              />
            </div>
          </div>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Concepto (Opcional, para Comentario)</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del pago"
                className={styles.fp5FullWidth}
              />
            </div>
          </div>
        </div>

        {/* Sección de Datos del Proveedor */}
        <div className={styles.fp5Section}>
          <h3>🏢 Datos del Proveedor</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Seleccionar Proveedor *</label>
              <select
                value={cuentaP}
                onChange={(e) => setCuentaP(e.target.value)}
                required
              >
                <option value="">-- Seleccionar proveedor --</option>
                {proveedores.map(prov => (
                  <option key={prov.codigo} value={prov.codigo}>
                    {prov.codigo} - {prov.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mostrar datos del proveedor seleccionado */}
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>CIF/NIF</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                readOnly
                className={styles.fp5Readonly}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Razón Social</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                readOnly
                className={styles.fp5Readonly}
              />
            </div>
            <div className={styles.fp5FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                readOnly
                className={styles.fp5Readonly}
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

        {/* Sección de Detalles Económicos */}
        <div className={styles.fp5Section}>
          <h3>💰 Detalles Económicos</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Código Analítico (Fijo del usuario)</label>
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
            <h4>Líneas de la Factura (IVA INCLUIDO):</h4>
            
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
        </div>

        {/* Sección de Archivo */}
        <div className={styles.fp5Section}>
          <h3>📎 Archivo Adjunto</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Justificante (Factura, Ticket, etc.)</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp5FileInput}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
                {cuentaGasto} - {cuentasGasto.find(c => c.id === cuentaGasto)?.nombre}
              </span>
              <span className={styles.fp5Importe}>
                {totales.total.toFixed(2)} €
              </span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span className={styles.fp5DebeHaber}>HABER</span>
              <span className={styles.fp5CuentaInfo}>
                {datosCuentaP.cuentaContable} - Proveedores
              </span>
              <span className={styles.fp5Importe}>
                {totales.total.toFixed(2)} €
              </span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span className={styles.fp5DebeHaber}>DEBE</span>
              <span className={styles.fp5CuentaInfo}>
                {datosCuentaP.cuentaContable} - Proveedores
              </span>
              <span className={styles.fp5Importe}>
                {totales.total.toFixed(2)} €
              </span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span className={styles.fp5DebeHaber}>HABER</span>
              <span className={styles.fp5CuentaInfo}>
                {cuentaCaja} - Caja
              </span>
              <span className={styles.fp5Importe}>
                {totales.total.toFixed(2)} €
              </span>
            </div>
          </div>
          
          <div className={styles.fp5InfoBox}>
            <p><strong>✅ Correcciones aplicadas:</strong></p>
            <ul>
              <li>Serie fija: <strong>{serie}</strong> (desde tabla Clientes)</li>
              <li>Analítico fijo: <strong>{analitico}</strong> (desde tabla Clientes)</li>
              <li>Nº Documento va a columna <strong>NumeroDoc</strong></li>
              <li>Cuenta contable real del proveedor: <strong>{datosCuentaP.cuentaContable}</strong></li>
              <li>Cuenta caja del cliente: <strong>{cuentaCaja}</strong></li>
            </ul>
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
            disabled={loading || !cuentaP || !numDocumento || !detalles.some(d => d.base && parseFloat(d.base) > 0) || !cuentaGasto}
          >
            {loading ? '⏳ Procesando...' : '✅ Crear Asiento de Pago'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;