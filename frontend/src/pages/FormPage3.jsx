import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaExchangeAlt, FaPlus, FaTrash, FaCheck, FaTimes, FaFileInvoice, FaMoneyBill } from 'react-icons/fa';
import styles from '../styles/FormPage3.module.css';
import config from '../config/config';

const FormPage3 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  
  // Datos de la factura
  const [cuentaProveedor, setCuentaProveedor] = useState('');
  const [datosProveedor, setDatosProveedor] = useState({ cif: '', nombre: '', cp: '' });
  const [serieFactura, setSerieFactura] = useState('FAC');
  const [numDocumentoFactura, setNumDocumentoFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  
  // Datos del pago
  const [tipoPago, setTipoPago] = useState('banco');
  const [conceptoPago, setConceptoPago] = useState('');
  
  // Detalles de la factura
  const [detalles, setDetalles] = useState([
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '0', cuotaRetencion: 0 }
  ]);

  // Cuentas disponibles
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

  const [cuentaGastoSeleccionada, setCuentaGastoSeleccionada] = useState('600000000');

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
        const response = await axios.get(`${config.apiBaseUrl}/api/proveedores`, {
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
      retencion: '0', 
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

    if (!cuentaProveedor) errores.push('Debe seleccionar un proveedor');
    if (!numDocumentoFactura) errores.push('Número de documento de factura requerido');
    if (!conceptoPago) errores.push('Concepto del pago requerido');
    
    const lineasValidas = detalles.filter(d => d.base && parseFloat(d.base) > 0);
    if (lineasValidas.length === 0) errores.push('Debe ingresar al menos una línea de factura con base mayor a 0');

    if (!fechaVencimiento) errores.push('Fecha de vencimiento requerida para el pago');

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
        tipoOperacion: 'compra-pago',
        factura: {
          proveedor: {
            cuentaProveedor: cuentaProveedor,
            cif: datosProveedor.cif,
            nombre: datosProveedor.nombre
          },
          serie: serieFactura,
          numDocumento: numDocumentoFactura,
          fechaFactura: fechaFactura,
          detalles: detallesFiltrados,
          cuentaGasto: cuentaGastoSeleccionada
        },
        pago: {
          tipoPago: tipoPago,
          concepto: conceptoPago,
          fechaVencimiento: fechaVencimiento
        },
        usuario: user?.usuario || 'admin'
      };

      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/compra-pago`, asientoData, {
        withCredentials: true
      });
      
      if (response.data.success) {
        alert(`Asiento Compra+Pago #${response.data.asiento} creado correctamente`);
        resetForm();
      } else {
        alert('Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento compra+pago:', error);
      alert('Error al crear el asiento: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCuentaProveedor('');
    setDatosProveedor({ cif: '', nombre: '', cp: '' });
    setNumDocumentoFactura('');
    setConceptoPago('');
    setFechaVencimiento('');
    setDetalles([{ base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '0', cuotaRetencion: 0 }]);
    setCuentaGastoSeleccionada('600000000');
    
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

  // Actualizar datos del proveedor cuando se selecciona uno
  useEffect(() => {
    if (cuentaProveedor) {
      const proveedor = proveedores.find(p => p.codigo === cuentaProveedor);
      if (proveedor) {
        setDatosProveedor({
          cif: proveedor.cif || '',
          nombre: proveedor.nombre || '',
          cp: proveedor.cp || ''
        });
      }
    }
  }, [cuentaProveedor, proveedores]);

  return (
    <div className={styles.fp3Container}>
      <div className={styles.fp3Header}>
        <h2>
          <FaExchangeAlt />
          Asiento de Compra y Pago a Proveedor
        </h2>
        <div className={styles.fp3AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp3Form}>
        
        <div className={styles.fp3Section}>
          <h3>
            <FaFileInvoice />
            Datos del Proveedor y Factura
          </h3>
          
          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Proveedor *</label>
              <select
                value={cuentaProveedor}
                onChange={(e) => setCuentaProveedor(e.target.value)}
                required
              >
                <option value="">-- Seleccionar proveedor --</option>
                {proveedores.map(proveedor => (
                  <option key={proveedor.codigo} value={proveedor.codigo}>
                    {proveedor.codigo} - {proveedor.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fp3FormGroup}>
              <label>CIF Proveedor</label>
              <input 
                type="text" 
                value={datosProveedor.cif}
                readOnly
                className={styles.fp3Readonly}
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Nombre Proveedor</label>
              <input 
                type="text" 
                value={datosProveedor.nombre}
                readOnly
                className={styles.fp3Readonly}
              />
            </div>
          </div>

          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Serie Factura</label>
              <input 
                type="text" 
                value={serieFactura}
                onChange={(e) => setSerieFactura(e.target.value)}
                placeholder="FAC, EM, etc."
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Nº Documento Factura *</label>
              <input 
                type="text" 
                value={numDocumentoFactura}
                onChange={(e) => setNumDocumentoFactura(e.target.value)}
                placeholder="Número de factura"
                required
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Fecha Factura *</label>
              <input
                type="date"
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.fp3Section}>
          <h3>Detalles de la Factura</h3>
          
          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Cuenta de Gasto *</label>
              <select
                value={cuentaGastoSeleccionada}
                onChange={(e) => setCuentaGastoSeleccionada(e.target.value)}
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

          <div className={styles.fp3Detalles}>
            <h4>Líneas de la Factura:</h4>
            
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
                      <FaTrash />
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
                      <option value="21">21% General</option>
                      <option value="10">10% Reducido</option>
                      <option value="4">4% Superreducido</option>
                      <option value="0">0% Exento</option>
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
                      <option value="0">0% Sin retención</option>
                      <option value="15">15% Profesional</option>
                      <option value="7">7% Reducido</option>
                      <option value="1">1% Especial</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            
            <button type="button" className={styles.fp3AddBtn} onClick={addDetalleLine}>
              <FaPlus />
              Añadir línea de factura
            </button>
          </div>
        </div>

        <div className={styles.fp3Section}>
          <h3>
            <FaMoneyBill />
            Datos del Pago
          </h3>
          
          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Tipo de Pago *</label>
              <select
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value)}
                required
              >
                <option value="banco">Pago por Banco (572)</option>
                <option value="caja">Pago por Caja (570)</option>
              </select>
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Concepto del Pago *</label>
              <input 
                type="text" 
                value={conceptoPago}
                onChange={(e) => setConceptoPago(e.target.value)}
                placeholder="Ej: Pago factura compra"
                required
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Fecha Vencimiento *</label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.fp3FormRow}>
            <div className={styles.fp3FormGroup}>
              <label>Cuenta Proveedor</label>
              <input 
                type="text" 
                value="400000000"
                readOnly 
                className={styles.fp3Readonly}
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Cuenta IVA</label>
              <input 
                type="text" 
                value="472000000"
                readOnly 
                className={styles.fp3Readonly}
              />
            </div>

            <div className={styles.fp3FormGroup}>
              <label>Cuenta de Pago</label>
              <input 
                type="text" 
                value={tipoPago === 'caja' ? '570000000' : '572000000'}
                readOnly 
                className={styles.fp3Readonly}
              />
            </div>
          </div>
        </div>

        <div className={styles.fp3Resumen}>
          <h4>Resumen de la Factura</h4>
          
          <div className={styles.fp3Totales}>
            <div className={styles.fp3TotalItem}>
              <span>Base Imponible:</span>
              <span>{totalesFactura.base.toFixed(2)} €</span>
            </div>
            <div className={styles.fp3TotalItem}>
              <span>IVA:</span>
              <span>{totalesFactura.iva.toFixed(2)} €</span>
            </div>
            <div className={styles.fp3TotalItem}>
              <span>Retención:</span>
              <span>{totalesFactura.retencion.toFixed(2)} €</span>
            </div>
            <div className={styles.fp3TotalItem + ' ' + styles.fp3TotalFinal}>
              <span>Total Factura:</span>
              <span>{totalesFactura.total.toFixed(2)} €</span>
            </div>
          </div>
        </div>

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
            disabled={loading || validarFormulario().length > 0}
          >
            {loading ? 'Procesando...' : 'Crear Asiento Compra+Pago'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage3;