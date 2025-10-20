import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from '../styles/FormPage3.module.css';

const FormPage3 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState([]);

  // Estados para la sección de INGRESO
  const [tipoIngreso, setTipoIngreso] = useState('caja');
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('');
  const [importeIngreso, setImporteIngreso] = useState('');
  const [conceptoIngreso, setConceptoIngreso] = useState('');
  const [serieIngreso, setSerieIngreso] = useState('ING');
  const [numDocumentoIngreso, setNumDocumentoIngreso] = useState('');

  // Estados para la sección de FACTURA
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '' });
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [serieFactura, setSerieFactura] = useState('FAC');
  const [numDocumentoFactura, setNumDocumentoFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados para detalles de factura
  const [detalles, setDetalles] = useState([
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 }
  ]);

  const CUENTAS_INGRESO = [
    { id: '705000000', nombre: 'Prestaciones de servicios' },
    { id: '700000000', nombre: 'Ventas de mercaderías' },
    { id: '701000000', nombre: 'Ventas de productos terminados' },
    { id: '759000000', nombre: 'Ingresos por arrendamientos' },
    { id: '762000000', nombre: 'Ingresos por servicios profesionales' },
    { id: '769000000', nombre: 'Otros ingresos de gestión' }
  ];

  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/contador', {
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
        const response = await axios.get('http://localhost:5000/api/proveedores', {
          withCredentials: true
        });
        setProveedores(response.data || []);
      } catch (error) {
        console.error('Error cargando proveedores:', error);
      }
    };
    
    fetchProveedores();
  }, []);

  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;

    const baseNum = parseFloat(newDetalles[index].base) || 0;
    const tipoIVANum = parseFloat(newDetalles[index].tipoIVA) || 0;
    const retencionNum = parseFloat(newDetalles[index].retencion) || 0;

    if (!isNaN(baseNum) && baseNum >= 0) {
      newDetalles[index].cuotaIVA = (baseNum * tipoIVANum) / 100;
      newDetalles[index].cuotaRetencion = (baseNum * retencionNum) / 100;
    } else {
      newDetalles[index].cuotaIVA = 0;
      newDetalles[index].cuotaRetencion = 0;
    }
    
    setDetalles(newDetalles);
  };

  const addDetalleLine = () => {
    setDetalles([...detalles, { 
      base: '', 
      tipoIVA: '21', 
      cuotaIVA: 0, 
      retencion: '15', 
      cuotaRetencion: 0 
    }]);
  };

  const removeDetalleLine = (index) => {
    if (detalles.length > 1) {
      const newDetalles = [...detalles];
      newDetalles.splice(index, 1);
      setDetalles(newDetalles);
    }
  };

  const calcularTotalesFactura = () => {
    return detalles.reduce((acc, detalle) => {
      const base = parseFloat(detalle.base) || 0;
      const iva = parseFloat(detalle.cuotaIVA) || 0;
      const retencion = parseFloat(detalle.cuotaRetencion) || 0;
      
      if (base > 0) {
        return {
          base: acc.base + base,
          iva: acc.iva + iva,
          retencion: acc.retencion + retencion,
          total: acc.total + base + iva
        };
      }
      return acc;
    }, { base: 0, iva: 0, retencion: 0, total: 0 });
  };

  const totalesFactura = calcularTotalesFactura();

  const validarFormulario = () => {
    const errores = [];

    if (!cuentaSeleccionada) errores.push('Debe seleccionar una cuenta de ingreso');
    if (!importeIngreso || parseFloat(importeIngreso) <= 0) errores.push('Importe de ingreso inválido');
    if (!conceptoIngreso) errores.push('Concepto de ingreso requerido');
    if (!numDocumentoIngreso) errores.push('Número de documento de ingreso requerido');
    
    if (!cuentaP) errores.push('Debe seleccionar un proveedor');
    if (!numDocumentoFactura) errores.push('Número de documento de factura requerido');
    
    const lineasValidas = detalles.filter(d => d.base && parseFloat(d.base) > 0);
    if (lineasValidas.length === 0) errores.push('Debe ingresar al menos una línea de factura con base mayor a 0');

    if (Math.abs(totalesFactura.total - parseFloat(importeIngreso || 0)) > 0.01) {
      errores.push(`Los importes no coinciden: Factura ${totalesFactura.total.toFixed(2)} vs Ingreso ${parseFloat(importeIngreso || 0).toFixed(2)}`);
    }

    return errores;
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
      const detallesFiltrados = detalles.filter(d => d.base && parseFloat(d.base) > 0);
      
      const asientoData = {
        tipoIngreso,
        ingreso: {
          cuentaSeleccionada,
          importe: parseFloat(importeIngreso),
          concepto: conceptoIngreso,
          serie: serieIngreso,
          numDocumento: numDocumentoIngreso
        },
        factura: {
          proveedor: {
            cuentaProveedor: cuentaP,
            cif: inputCIF,
            nombre: inputNombre
          },
          serie: serieFactura,
          numDocumento: numDocumentoFactura,
          fechaFactura: fechaFactura,
          detalles: detallesFiltrados
        },
        usuario: user?.usuario || 'admin'
      };

      const response = await axios.post('http://localhost:5000/api/asiento/doble', asientoData, {
        withCredentials: true
      });
      
      if (response.data.success) {
        alert(`Asiento Doble #${response.data.asiento} creado correctamente`);
        resetForm();
      } else {
        alert('Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento doble:', error);
      alert('Error al crear el asiento: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCuentaSeleccionada('');
    setImporteIngreso('');
    setConceptoIngreso('');
    setNumDocumentoIngreso('');
    setCuentaP('');
    setInputCIF('');
    setInputNombre('');
    setNumDocumentoFactura('');
    setDetalles([{ base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 }]);
    
    const fetchNewContador = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/contador', {
          withCredentials: true
        });
        setNumAsiento(response.data.contador);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    
    fetchNewContador();
  };

  return (
    <div className={styles.fp3Container}>
      <div className={styles.fp3Header}>
        <h2>Asiento Doble: Ingreso para Pagar Factura</h2>
        <div className={styles.fp3AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp3Form}>
        
        {/* SECCIÓN INGRESO */}
        <div className={styles.fp3Section}>
          <h3>📥 Parte de Ingreso</h3>
          
          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Tipo de Ingreso *</label>
              <select
                value={tipoIngreso}
                onChange={(e) => setTipoIngreso(e.target.value)}
                required
              >
                <option value="caja">Ingreso en Caja (570)</option>
                <option value="cliente">Ingreso por Cliente (430)</option>
              </select>
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Cuenta de Ingreso *</label>
              <select
                value={cuentaSeleccionada}
                onChange={(e) => setCuentaSeleccionada(e.target.value)}
                required
              >
                <option value="">-- Seleccionar cuenta --</option>
                {CUENTAS_INGRESO.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.id} - {cuenta.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Importe *</label>
              <input 
                type="number" 
                step="0.01"
                min="0.01"
                value={importeIngreso}
                onChange={(e) => setImporteIngreso(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={conceptoIngreso}
                onChange={(e) => setConceptoIngreso(e.target.value)}
                placeholder="Descripción del ingreso"
                required
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serieIngreso}
                onChange={(e) => setSerieIngreso(e.target.value)}
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumentoIngreso}
                onChange={(e) => setNumDocumentoIngreso(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN FACTURA */}
        <div className={styles.fp3Section}>
          <h3>📤 Parte de Factura</h3>
          
          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Seleccionar Proveedor *</label>
              <select value={cuentaP} onChange={(e) => setCuentaP(e.target.value)} required>
                <option value="">-- Seleccionar proveedor --</option>
                {proveedores.map(proveedor => (
                  <option key={proveedor.codigo} value={proveedor.codigo}>
                    {proveedor.codigo} - {proveedor.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Serie Factura</label>
              <input 
                type="text" 
                value={serieFactura}
                onChange={(e) => setSerieFactura(e.target.value)}
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Nº Factura *</label>
              <input 
                type="text" 
                value={numDocumentoFactura}
                onChange={(e) => setNumDocumentoFactura(e.target.value)}
                required
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Fecha Factura</label>
              <input
                type="date"
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
              />
            </div>
          </div>

          {/* DETALLES DE FACTURA */}
          <div className={styles.fp3Detalles}>
            <h4>Líneas de Factura:</h4>
            
            {detalles.map((line, i) => (
              <div className={styles.fp3DetalleLinea} key={i}>
                <div className={styles.fp3LineaHeader}>
                  <span>Línea {i + 1}</span>
                  {detalles.length > 1 && (
                    <button 
                      type="button" 
                      className={styles.fp3RemoveBtn}
                      onClick={() => removeDetalleLine(i)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                
                <div className={styles.fp3FormRow}>
                  <div className={styles.fp3FormGroup}>
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
                  
                  <div className={styles.fp3FormGroup}>
                    <label>Tipo IVA</label>
                    <select
                      value={line.tipoIVA}
                      onChange={(e) => handleDetalleChange(i, 'tipoIVA', e.target.value)}
                    >
                      <option value="21">21%</option>
                      <option value="10">10%</option>
                      <option value="4">4%</option>
                      <option value="0">0%</option>
                    </select>
                  </div>
                  
                  <div className={styles.fp3FormGroup}>
                    <label>Cuota IVA</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.cuotaIVA.toFixed(2)} 
                      className={styles.fp3Readonly}
                    />
                  </div>
                  
                  <div className={styles.fp3FormGroup}>
                    <label>% Retención</label>
                    <select
                      value={line.retencion}
                      onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}
                    >
                      <option value="15">15%</option>
                      <option value="7">7%</option>
                      <option value="0">0%</option>
                    </select>
                  </div>
                  
                  <div className={styles.fp3FormGroup}>
                    <label>Cuota Retención</label>
                    <input 
                      type="number" 
                      step="0.01"
                      readOnly 
                      value={line.cuotaRetencion.toFixed(2)} 
                      className={styles.fp3Readonly}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button type="button" onClick={addDetalleLine} className={styles.fp3AddBtn}>
              + Añadir Línea
            </button>
          </div>

          {/* RESUMEN */}
          <div className={styles.fp3Resumen}>
            <h4>Resumen:</h4>
            <div className={styles.fp3Totales}>
              <div>Total Base: <strong>{totalesFactura.base.toFixed(2)}€</strong></div>
              <div>Total IVA: <strong>{totalesFactura.iva.toFixed(2)}€</strong></div>
              <div>Total Factura: <strong>{totalesFactura.total.toFixed(2)}€</strong></div>
              <div>Importe Ingreso: <strong>{parseFloat(importeIngreso || 0).toFixed(2)}€</strong></div>
              <div className={totalesFactura.total.toFixed(2) === parseFloat(importeIngreso || 0).toFixed(2) ? styles.fp3Coincide : styles.fp3NoCoincide}>
                {totalesFactura.total.toFixed(2) === parseFloat(importeIngreso || 0).toFixed(2) ? '✓ Importes coinciden' : '✗ Importes no coinciden'}
              </div>
            </div>
          </div>
        </div>

        {/* BOTONES */}
        <div className={styles.fp3ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp3CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className={styles.fp3ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp3SubmitBtn} 
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Crear Asiento Doble'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage3;