// pages/FormPage5.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHandHoldingUsd, FaPlus, FaTrash } from 'react-icons/fa';
import styles from '../styles/FormPage5.module.css';
import config from '../config/config';

const FormPage5 = ({ user }) => {
  // Estados del FormPage1 (documento y proveedor)
  const [numAsiento, setNumAsiento] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Campos de documento (igual que FormPage1)
  const [serie, setSerie] = useState(user?.serie || 'PAG');
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [archivo, setArchivo] = useState(null);
  
  // Campos de proveedor (igual que FormPage1)
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '', cuenta: '' });
  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');
  const isNuevoProveedor = cuentaP === '4000';
  
  // Campos específicos para el pago - AÑADIDOS
  const [cuentaGasto, setCuentaGasto] = useState('600000000');
  const [analitico, setAnalitico] = useState(user?.analitico || 'EM');
  
  // Detalles de la factura - AÑADIDOS
  const [detalles, setDetalles] = useState([
    { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0,
      importeTotalLinea: 0
    }
  ]);

  // Cuentas disponibles - AÑADIDAS
  const CUENTAS_GASTO = [
    { id: '600000000', nombre: 'Compras de mercaderías' },
    { id: '601000000', nombre: 'Compras de materias primas' },
    { id: '602000000', nombre: 'Compras de otros aprovisionamientos' },
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

  // Manejo de detalles - IVA NO DEDUCIBLE - AÑADIDO
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

  // Cálculo de totales para IVA no deducible - AÑADIDO
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

  // Validación del formulario - AÑADIDA
  const validarFormulario = () => {
    const errores = [];
    
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
        
        // Datos de proveedor
        proveedor: {
          cuentaProveedor: isNuevoProveedor ? '400000000' : cuentaP,
          cif: isNuevoProveedor ? inputCIF : datosCuentaP.cif,
          nombre: isNuevoProveedor ? inputNombre : datosCuentaP.nombre,
          cp: isNuevoProveedor ? inputCP : datosCuentaP.cp
        },
        
        // Datos específicos del pago - AÑADIDOS
        cuentaGasto,
        analitico,
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        
        // Totales - AÑADIDOS
        totalBase: totales.base,
        totalIVA: totales.iva,
        totalFactura: totales.total,
        
        // Archivo
        archivo: archivo
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/pago-caja-proveedor`, datosEnvio, {
        withCredentials: true
      });

      if (response.data.success) {
        alert(`Asiento #${response.data.asiento} - Pago en Caja a Proveedor creado correctamente`);
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
    setConcepto('');
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
    <div className={styles.fp5Container}>
      <div className={styles.fp5Header}>
        <h2>
          <FaHandHoldingUsd />
          Pago en Caja a Proveedor
        </h2>
        <div className={styles.fp5AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
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
                onChange={(e) => setSerie(e.target.value)}
                placeholder="PAG, etc."
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
              <label>Fecha de Registro *</label>
              <input
                type="date"
                value={fechaReg}
                onChange={(e) => setFechaReg(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Sección de Datos del Proveedor */}
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
                <label>Cuenta Contable</label>
                <input 
                  type="text" 
                  value={datosCuentaP.cuenta}
                  readOnly
                  className={styles.fp5Readonly}
                />
              </div>
            </div>
          ) : (
            // Campos para nuevo proveedor
            <div className={styles.fp5FormRow}>
              <div className={styles.fp5FormGroup}>
                <label>CIF/NIF *</label>
                <input 
                  type="text" 
                  value={inputCIF}
                  onChange={(e) => setInputCIF(e.target.value)}
                  placeholder="CIF/NIF del proveedor"
                  required
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Razón Social *</label>
                <input 
                  type="text" 
                  value={inputNombre}
                  onChange={(e) => setInputNombre(e.target.value)}
                  placeholder="Nombre del proveedor"
                  required
                />
              </div>
              <div className={styles.fp5FormGroup}>
                <label>Código Postal</label>
                <input 
                  type="text" 
                  value={inputCP}
                  onChange={(e) => setInputCP(e.target.value)}
                  placeholder="Código postal"
                />
              </div>
              <div className={styles.fp5FormGroup}>
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

        {/* Sección de Detalles Económicos - AÑADIDA */}
        <div className={styles.fp5Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Código Analítico</label>
              <input 
                type="text" 
                value={analitico}
                onChange={(e) => setAnalitico(e.target.value)}
                placeholder="EM, etc."
              />
            </div>
            <div className={styles.fp5FormGroup}>
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
        </div>

        {/* Sección de Concepto */}
        <div className={styles.fp5Section}>
          <h3>Concepto del Pago</h3>
          <div className={styles.fp5FormRow}>
            <div className={styles.fp5FormGroup}>
              <label>Concepto</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Pago factura pendiente"
              />
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

        {/* Resumen del Asiento */}
        <div className={styles.fp5Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp5Resumen}>
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{cuentaGasto} - {CUENTAS_GASTO.find(c => c.id === cuentaGasto)?.nombre}</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>{datosCuentaP.cuenta} - Proveedores</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span>DEBE:</span>
              <span>{datosCuentaP.cuenta} - Proveedores</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5ResumenItem}>
              <span>HABER:</span>
              <span>570000000 - Caja</span>
              <span>{totales.total.toFixed(2)} €</span>
            </div>
            <div className={styles.fp5InfoBox}>
              <p><strong>Nota:</strong> Este asiento registra la compra y el pago inmediato en caja. No se genera vencimiento.</p>
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
            disabled={loading || !cuentaP || !numDocumento || !detalles.some(d => d.base && parseFloat(d.base) > 0)}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage5;