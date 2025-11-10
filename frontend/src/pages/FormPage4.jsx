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
  
  // Campos de documento (igual que FormPage1)
  const [serie, setSerie] = useState(user?.serie || 'EM');
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  
  // Campos de proveedor (igual que FormPage1)
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '', cuenta: '' });
  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');
  const isNuevoProveedor = cuentaP === '4000';
  
  // Campos específicos
  const [cuentaGasto, setCuentaGasto] = useState('600000000');
  const [analitico, setAnalitico] = useState(user?.analitico || 'EM');
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

  // Cuentas disponibles
  const CUENTAS_GASTO = [
    { id: '600000000', nombre: 'Compras de mercaderías' },
    { id: '601000000', nombre: 'Compras de materias primas' },
    { id: '602000000', nome: 'Compras de otros aprovisionamientos' },
    { id: '621000000', nombre: 'Arrendamientos y cánones' },
    { id: '622000000', nombre: 'Reparaciones y conservación' },
    { id: '623000000', nombre: 'Servicios de profesionales independientes' },
    { id: '624000000', nombre: 'Transportes' },
    { id: '625000000', nombre: 'Primas de seguros' },
    { id: '626000000', nombre: 'Servicios bancarios y similares' },
    { id: '627000000', nombre: 'Publicidad, propaganda y relaciones públicas' },
    { id: '628000000', nombre: 'Suministros' },
    { id: '629000000', nombre: 'Otros servicios' }
  ];

  // Efectos (igual que FormPage1)
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
    const fetchProveedores = async () => {
      try {
        const [proveedoresRes, cuentasRes] = await Promise.all([
          axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true })
        ]);
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
      } catch (error) {
        console.error('Error cargando proveedores:', error);
      }
    };
    fetchProveedores();
  }, []);

  // Actualizar datos proveedor (igual que FormPage1)
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

  // Manejo de archivos
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Guardamos la ruta completa como se solicita
      setArchivo(`C:\\Users\\${user?.usuario || 'Usuario'}\\Desktop\\${file.name}`);
    }
  };

  // Envío del formulario - Usaremos el endpoint existente con adaptaciones
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!cuentaP || !numDocumento || !detalles.some(d => d.base && parseFloat(d.base) > 0)) {
      alert('Por favor complete los campos obligatorios');
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
        
        // Flag para indicar que es IVA no deducible
        ivaNoDeducible: true,
        
        // Totales
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalFactura: totales.total
      };

      // Usamos el endpoint existente con adaptación para IVA no deducible
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
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="EM, FAC, etc."
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
              <label>Vencimiento</label>
              <input
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
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
                <input 
                  type="text" 
                  value={inputCuenta}
                  onChange={(e) => setInputCuenta(e.target.value)}
                  placeholder="400000000"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sección de Detalles Económicos */}
        <div className={styles.fp4Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Código Analítico</label>
              <input 
                type="text" 
                value={analitico}
                onChange={(e) => setAnalitico(e.target.value)}
                placeholder="EM, etc."
              />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Cuenta de Gasto *</label>
              <select
                value={cuentaGasto}
                onChange={(e) => setCuentaGasto(e.target.value)}
                required
              >
                {CUENTAS_GASTO.map((cuenta) => (
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
              <span>{cuentaGasto} - {CUENTAS_GASTO.find(c => c.id === cuentaGasto)?.nombre}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp4ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuenta} - Proveedores</span>
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
            disabled={loading || !cuentaP || !numDocumento || !detalles.some(d => d.base && parseFloat(d.base) > 0)}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage4;