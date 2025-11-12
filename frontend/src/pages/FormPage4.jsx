// pages/FormPage4.jsx - VERSIÓN CORREGIDA
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
  
  // SERIE Y ANALITICO FIJOS desde tabla Clientes
  const [serie, setSerie] = useState('');
  const [analitico, setAnalitico] = useState('');
  
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
    cuentaContable: '' // CAMBIADO: ahora guardamos la cuenta contable real
  });
  
  const isNuevoProveedor = cuentaP === '4000';
  
  // Campos específicos
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Detalles adaptados para IVA no deducible
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
          proveedoresCuentasRes,
          canalRes
        ] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/cuentas/proveedores`, { withCredentials: true }),
          // OBTENER SERIE Y ANALITICO DESDE CLIENTES
          axios.get(`${config.apiBaseUrl}/api/cliente/canal`, { withCredentials: true })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
        setCuentasGasto(gastosRes.data || []);
        setCuentasProveedores(proveedoresCuentasRes.data || []);
        
        // SERIE Y ANALITICO FIJOS desde tabla Clientes
        const serieCliente = canalRes.data?.serie || 'EM';
        const analiticoCliente = canalRes.data?.analitico || 'EM';
        setSerie(serieCliente);
        setAnalitico(analiticoCliente);
        
        console.log(`✅ Serie fija: ${serieCliente}, Analítico fijo: ${analiticoCliente}`);
        
        // Establecer primera cuenta de gasto por defecto si existe
        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        } else {
          setCuentaGasto('600000000');
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        // Valores por defecto en caso de error
        setSerie('EM');
        setAnalitico('EM');
        setCuentaGasto('600000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // CORREGIDO: Actualizar datos proveedor - USAR CUENTA CONTABLE REAL
  useEffect(() => {
    if (cuentaP && cuentaP !== '4000') {
      const proveedor = proveedores.find(p => p.codigo === cuentaP);
      const cuentaProv = proveedoresCuentas.find(p => p.codigo === cuentaP);
      
      if (proveedor) {
        setDatosCuentaP({
          cif: proveedor.cif || '',
          nombre: proveedor.nombre || '',
          cp: proveedor.cp || '',
          cuentaContable: cuentaProv?.cuenta || '400000000' // CUENTA CONTABLE REAL
        });
        console.log(`✅ Proveedor: ${proveedor.nombre}, Cuenta contable: ${cuentaProv?.cuenta}`);
      }
    }
  }, [cuentaP, proveedores, proveedoresCuentas]);

  // Manejo de detalles - IVA NO DEDUCIBLE (sin cambios)
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

  // Cálculo de totales para IVA no deducible
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
    if (!cuentaP && !isNuevoProveedor) {
      errores.push('Debe seleccionar un proveedor');
    }
    if (!cuentaGasto) {
      errores.push('Debe seleccionar una cuenta de gasto');
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
      // COMENTARIO COMBINADO: Nº FRA + Concepto
      const comentarioCombinado = `${numFRA || ''} ${concepto}`.trim().substring(0, 40);

      const datosEnvio = {
        // Datos de documento
        serie, // SERIE FIJA del usuario
        numDocumento, // Para colocar en NumeroDoc
        numFRA,
        fechaReg,
        fechaFactura,
        fechaOper,
        vencimiento,
        concepto, // NUEVO CAMPO OBLIGATORIO
        comentario: comentarioCombinado, // COMENTARIO COMBINADO
        
        // Datos de proveedor - USAR CUENTA CONTABLE REAL
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable || '400000000', // CUENTA CONTABLE REAL
          codigoProveedor: cuentaP, // Código del proveedor para identificarlo
          cif: datosCuentaP.cif,
          nombre: datosCuentaP.nombre,
          cp: datosCuentaP.cp
        },
        
        // Datos específicos
        cuentaGasto,
        analitico, // ANALITICO FIJO del usuario
        
        // Detalles
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // Archivo
        archivo: archivo,
        
        // Totales
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalFactura: totales.total
      };

      console.log('📤 Enviando datos:', datosEnvio);

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/factura-iva-incluido`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`✅ Asiento #${response.data.asiento} - Factura Proveedor (IVA Incluido) creado correctamente`);
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
    setConcepto(''); // LIMPIAR CONCEPTO
    setFechaOper('');
    setVencimiento('');
    setDetalles([{ base: '', tipoIVA: '21', cuotaIVA: 0, importeTotalLinea: 0 }]);
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
          Factura de Proveedor (IVA Incluido) - CORREGIDO
        </h2>
        <div className={styles.fp4AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
          <span>Serie: <strong>{serie}</strong></span>
          <span>Analítico: <strong>{analitico}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp4Form}>
        {/* Sección de Datos del Documento - ACTUALIZADO */}
        <div className={styles.fp4Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Serie (Fija del usuario)</label>
              <input 
                type="text" 
                value={serie}
                readOnly
                className={styles.fp4Readonly}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Nº Documento * (Va a NumeroDoc)</label>
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
              <label>Concepto * (Para Comentario)</label>
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

        {/* Sección de Datos del Proveedor - ELIMINADO NUEVO PROVEEDOR */}
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
                {proveedores.map(prov => (
                  <option key={prov.codigo} value={prov.codigo}>
                    {prov.codigo} - {prov.nombre} - Cuenta: {proveedoresCuentas.find(p => p.codigo === prov.codigo)?.cuenta || '400000000'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SOLO MOSTRAR DATOS DEL PROVEEDOR SELECCIONADO */}
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>CIF/NIF</label>
              <input 
                type="text" 
                value={datosCuentaP.cif}
                readOnly
                className={styles.fp4Readonly}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Razón Social</label>
              <input 
                type="text" 
                value={datosCuentaP.nombre}
                readOnly
                className={styles.fp4Readonly}
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Código Postal</label>
              <input 
                type="text" 
                value={datosCuentaP.cp}
                readOnly
                className={styles.fp4Readonly}
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

        {/* Resto del código se mantiene igual... */}
        {/* Sección de Detalles Económicos */}
        <div className={styles.fp4Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Código Analítico (Fijo del usuario)</label>
              <input 
                type="text" 
                value={analitico}
                readOnly
                className={styles.fp4Readonly}
              />
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
          <div className={styles.fp4InfoBox}>
            <p><strong>📝 Comentario que se guardará:</strong></p>
            <p>"{numFRA} {concepto}".substring(0, 40)</p>
          </div>
          <div className={styles.fp4Resumen}>
            <div className={styles.fp4ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {getNombreCuentaGasto()}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuentaContable} - Proveedores</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
          </div>
          <div className={styles.fp4InfoBox}>
            <p><strong>✅ Correcciones aplicadas:</strong></p>
            <ul>
              <li>Serie fija: <strong>{serie}</strong> (desde tabla Clientes)</li>
              <li>Analítico fijo: <strong>{analitico}</strong> (desde tabla Clientes)</li>
              <li>Nº Documento va a columna <strong>NumeroDoc</strong></li>
              <li>Cuenta contable real del proveedor: <strong>{datosCuentaP.cuentaContable}</strong></li>
              <li>Serie <strong>{serie}</strong> se guarda en tabla Movimientos</li>
            </ul>
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
            {loading ? 'Procesando...' : 'Crear Asiento Corregido'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage4;