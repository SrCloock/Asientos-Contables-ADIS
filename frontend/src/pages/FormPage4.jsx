// pages/FormPage4.jsx
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
  const [canalCliente, setCanalCliente] = useState({ serie: 'EM', analitico: 'EM' });
  
  // Campos de documento
  const [serie, setSerie] = useState('EM');
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  
  // Campos de proveedor
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '', cuenta: '' });
  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');
  const isNuevoProveedor = cuentaP === '4000';
  
  // Campos específicos
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [analitico, setAnalitico] = useState('EM');
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
          axios.get(`${config.apiBaseUrl}/api/cliente/canal`, { withCredentials: true })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
        setCuentasGasto(gastosRes.data || []);
        setCuentasProveedores(proveedoresCuentasRes.data || []);
        setCanalCliente(canalRes.data || { serie: 'EM', analitico: 'EM' });
        
        // Establecer valores por defecto del canal
        setSerie(canalRes.data?.serie || 'EM');
        setAnalitico(canalRes.data?.analitico || 'EM');
        
        // Establecer primera cuenta de gasto por defecto si existe
        if (gastosRes.data && gastosRes.data.length > 0) {
          setCuentaGasto(gastosRes.data[0].id);
        } else {
          // Si no hay cuentas de gasto, usar una por defecto
          setCuentaGasto('600000000');
        }
        
      } catch (error) {
        console.error('Error cargando datos maestros:', error);
        // En caso de error, establecer valores por defecto
        setSerie('EM');
        setAnalitico('EM');
        setCuentaGasto('600000000');
      }
    };
    fetchDatosMaestros();
  }, []);

  // Actualizar datos proveedor
  useEffect(() => {
    if (cuentaP && cuentaP !== '4000') {
      const proveedor = proveedores.find(p => p.codigo === cuentaP);
      const cuentaProv = proveedoresCuentas.find(p => p.codigo === cuentaP);
      
      if (proveedor) {
        setDatosCuentaP({
          cif: proveedor.cif || '',
          nombre: proveedor.nombre || '',
          cp: proveedor.cp || '',
          cuenta: cuentaProv?.cuenta || '400000000'
        });
      }
    } else if (cuentaP === '4000') {
      setDatosCuentaP({
        cif: inputCIF,
        nombre: inputNombre,
        cp: inputCP,
        cuenta: inputCuenta || '400000000'
      });
    }
  }, [cuentaP, proveedores, proveedoresCuentas, inputCIF, inputNombre, inputCP, inputCuenta]);

  // Manejo de detalles - IVA NO DEDUCIBLE
  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;

    const baseNum = parseFloat(newDetalles[index].base) || 0;
    const tipoIVANum = parseFloat(newDetalles[index].tipoIVA) || 0;
    
    if (!isNaN(baseNum) && baseNum >= 0) {
      const cuotaIVA = (baseNum * tipoIVANum) / 100;
      newDetalles[index].cuotaIVA = cuotaIVA;
      // En IVA no deducible, el total de la línea es base + IVA (todo va al gasto)
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
          total: acc.total + base + iva  // Base + IVA todo va al gasto
        };
      }
      return acc;
    }, { base: 0, iva: 0, total: 0 });
  };

  const totales = calcularTotales();

  // Validación del formulario
  const validarFormulario = () => {
    const errores = [];
    
    if (!vencimiento) {
      errores.push('La fecha de vencimiento es obligatoria para este tipo de asiento');
    }
    if (!numDocumento.trim()) {
      errores.push('El número de documento es obligatorio');
    }
    if (!cuentaP && !isNuevoProveedor) {
      errores.push('Debe seleccionar un proveedor');
    }
    if (isNuevoProveedor) {
      if (!inputCIF.trim()) errores.push('El CIF del nuevo proveedor es obligatorio');
      if (!inputNombre.trim()) errores.push('El nombre del nuevo proveedor es obligatorio');
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
        numFRA,
        fechaReg,
        fechaFactura,
        fechaOper,
        vencimiento,
        
        // Datos de proveedor
        proveedor: {
          cuentaProveedor: isNuevoProveedor ? '400000000' : cuentaP,
          cif: isNuevoProveedor ? inputCIF : datosCuentaP.cif,
          nombre: isNuevoProveedor ? inputNombre : datosCuentaP.nombre,
          cp: isNuevoProveedor ? inputCP : datosCuentaP.cp
        },
        
        // Datos específicos
        cuentaGasto,
        analitico,
        
        // Detalles adaptados para IVA no deducible
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // Archivo - solo la ruta
        archivo: archivo,
        
        // Totales
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalFactura: totales.total
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/factura-iva-incluido`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`Asiento #${response.data.asiento} - Factura Proveedor (IVA Incluido) creado correctamente`);
        resetForm();
      } else {
        alert('Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento:', error);
      alert('Error al crear el asiento: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCuentaP('');
    setDatosCuentaP({ cif: '', nombre: '', cp: '', cuenta: '' });
    setInputCuenta('');
    setInputCIF('');
    setInputNombre('');
    setInputCP('');
    setNumDocumento('');
    setNumFRA('');
    setFechaOper('');
    setVencimiento('');
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

  // Obtener nombre de la cuenta seleccionada
  const getNombreCuentaGasto = () => {
    const cuenta = cuentasGasto.find(c => c.id === cuentaGasto);
    return cuenta ? cuenta.nombre : '';
  };

  // Obtener nombre de la cuenta de proveedor seleccionada
  const getNombreCuentaProveedor = () => {
    const cuenta = cuentasProveedores.find(c => c.id === datosCuentaP.cuenta);
    return cuenta ? cuenta.nombre : 'Proveedores';
  };

  return (
    <div className={styles.fp4Container}>
      <div className={styles.fp4Header}>
        <h2>
          <FaFileInvoiceDollar />
          Factura de Proveedor (IVA Incluido)
        </h2>
        <div className={styles.fp4AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp4Form}>
        {/* Sección de Datos del Documento */}
        <div className={styles.fp4Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Serie (No editable)</label>
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

        {/* Sección de Datos del Proveedor */}
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
                    {prov.codigo} - {prov.nombre}
                  </option>
                ))}
                <option value="4000">-- NUEVO PROVEEDOR --</option>
              </select>
            </div>
          </div>

          {!isNuevoProveedor ? (
            // Mostrar datos del proveedor seleccionado
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
                <label>Cuenta Contable</label>
                <input 
                  type="text" 
                  value={datosCuentaP.cuenta}
                  readOnly
                  className={styles.fp4Readonly}
                />
              </div>
            </div>
          ) : (
            // Campos para nuevo proveedor
            <div className={styles.fp4FormRow}>
              <div className={styles.fp4FormGroup}>
                <label>CIF/NIF *</label>
                <input 
                  type="text" 
                  value={inputCIF}
                  onChange={(e) => setInputCIF(e.target.value)}
                  placeholder="CIF/NIF del proveedor"
                  required
                />
              </div>
              <div className={styles.fp4FormGroup}>
                <label>Razón Social *</label>
                <input 
                  type="text" 
                  value={inputNombre}
                  onChange={(e) => setInputNombre(e.target.value)}
                  placeholder="Nombre del proveedor"
                  required
                />
              </div>
              <div className={styles.fp4FormGroup}>
                <label>Código Postal</label>
                <input 
                  type="text" 
                  value={inputCP}
                  onChange={(e) => setInputCP(e.target.value)}
                  placeholder="Código postal"
                />
              </div>
              <div className={styles.fp4FormGroup}>
                <label>Cuenta Contable</label>
                <select
                  value={inputCuenta}
                  onChange={(e) => setInputCuenta(e.target.value)}
                >
                  <option value="">Seleccionar cuenta</option>
                  {cuentasProveedores.map(cuenta => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.id} - {cuenta.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Sección de Detalles Económicos */}
        <div className={styles.fp4Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Código Analítico (No editable)</label>
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

        {/* Resumen del Asiento */}
        <div className={styles.fp4Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp4Resumen}>
            <div className={styles.fp4ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {getNombreCuentaGasto()}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuenta} - {getNombreCuentaProveedor()}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
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
            disabled={loading || !cuentaP || !numDocumento || !detalles.some(d => d.base && parseFloat(d.base) > 0) || !vencimiento || !cuentaGasto}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage4;