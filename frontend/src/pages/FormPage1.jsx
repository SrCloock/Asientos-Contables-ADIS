import React, { useState, useEffect } from 'react';
import styles from '../styles/FormPage1.module.css';
import axios from 'axios';

const cuentasPredefinidas = {
  '400000001': { cif: 'A12345678', nombre: 'Proveedor A', cp: '28001' },
  '400000002': { cif: 'B87654321', nombre: 'Proveedor B', cp: '08001' },
  '400000003': { cif: 'C11112222', nombre: 'Proveedor C', cp: '46001' }
};

const nombresCuenta = {
  '400000001': 'Proveedor A',
  '400000002': 'Proveedor B', 
  '400000003': 'Proveedor C',
  '400000000': 'Nuevo Proveedor'
};

const CUENTAS_GASTO = [
  { id: '600000000', nombre: 'Compras generales' },
  { id: '600100000', nombre: 'Servicios externos' },
  { id: '600200000', nombre: 'Suministros' },
  { id: '600300000', nombre: 'Gastos varios' }
];

const FormPage1 = () => {
  const [tipo, setTipo] = useState('factura');
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '' });
  const [pagoEfectivo, setPagoEfectivo] = useState(false);
  const [cuentaGasto, setCuentaGasto] = useState('600000000');

  // Campos de factura
  const [numeroFactura, setNumeroFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState('');
  const [fechaOperacion, setFechaOperacion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [serie, setSerie] = useState('EM');

  const [detalles, setDetalles] = useState([
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '19', cuotaRetencion: 0 }
  ]);

  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');

  const isNuevoProveedor = cuentaP === '400000000';

  // Cálculos automáticos
  const baseTotal = detalles.reduce((sum, det) => sum + (parseFloat(det.base) || 0), 0);
  const ivaTotal = detalles.reduce((sum, det) => sum + (parseFloat(det.cuotaIVA) || 0), 0);
  const retencionTotal = detalles.reduce((sum, det) => sum + (parseFloat(det.cuotaRetencion) || 0), 0);
  const totalFactura = baseTotal + ivaTotal - retencionTotal;

  useEffect(() => {
    // Establecer fechas por defecto
    const today = new Date().toISOString().split('T')[0];
    if (!fechaFactura) setFechaFactura(today);
    if (!fechaOperacion) setFechaOperacion(today);
    if (!fechaVencimiento) {
      const vencimiento = new Date();
      vencimiento.setDate(vencimiento.getDate() + 60);
      setFechaVencimiento(vencimiento.toISOString().split('T')[0]);
    }
  }, []);

  useEffect(() => {
    if (cuentaP && cuentaP !== '400000000') {
      const datos = cuentasPredefinidas[cuentaP] || { cif: '', nombre: '', cp: '' };
      setDatosCuentaP(datos);
      setInputCuenta(cuentaP);
      setInputCIF(datos.cif);
      setInputNombre(datos.nombre);
      setInputCP(datos.cp);
      setPagoEfectivo(false);
      return;
    }

    if (isNuevoProveedor) {
      setDatosCuentaP({ cif: '', nombre: '', cp: '' });
      setInputCuenta('400000000');
      return;
    }

    // Autocompletar
    const foundKey = Object.keys(cuentasPredefinidas).find((key) => {
      const { cif, nombre } = cuentasPredefinidas[key];
      return (
        key === inputCuenta ||
        cif.toLowerCase().includes(inputCIF.toLowerCase()) ||
        nombre.toLowerCase().includes(inputNombre.toLowerCase())
      );
    });

    if (foundKey) {
      const datos = cuentasPredefinidas[foundKey];
      setCuentaP(foundKey);
      setDatosCuentaP(datos);
      setInputCIF(datos.cif);
      setInputNombre(datos.nombre);
      setInputCP(datos.cp);
    } else {
      setDatosCuentaP({ cif: inputCIF, nombre: inputNombre, cp: inputCP });
    }
  }, [cuentaP, inputCuenta, inputCIF, inputNombre, inputCP]);

  const handleCuentaPChange = (e) => {
    const val = e.target.value;
    setCuentaP(val);
    setInputCuenta(val);
    if (val !== '400000000') {
      setPagoEfectivo(false);
    }
  };

  const handleInputCuenta = (e) => {
    setInputCuenta(e.target.value);
    setCuentaP('');
  };

  const handleInputCIF = (e) => {
    setInputCIF(e.target.value);
    setCuentaP('');
  };

  const handleInputNombre = (e) => {
    setInputNombre(e.target.value);
    setCuentaP('');
  };

  const handleInputCP = (e) => {
    setInputCP(e.target.value);
    setCuentaP('');
  };

  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles];
    newDetalles[index][field] = value;

    const baseNum = parseFloat(newDetalles[index].base);
    const tipoIVANum = parseFloat(newDetalles[index].tipoIVA);
    const retencionNum = parseFloat(newDetalles[index].retencion);

    if (!isNaN(baseNum)) {
      newDetalles[index].cuotaIVA = (baseNum * tipoIVANum) / 100;
      newDetalles[index].cuotaRetencion = (baseNum * retencionNum) / 100;
    } else {
      newDetalles[index].cuotaIVA = 0;
      newDetalles[index].cuotaRetencion = 0;
    }
    setDetalles(newDetalles);
  };

  const addDetalle = () => {
    setDetalles([...detalles, { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '19', cuotaRetencion: 0 }]);
  };

  const removeDetalle = (index) => {
    if (detalles.length > 1) {
      const newDetalles = detalles.filter((_, i) => i !== index);
      setDetalles(newDetalles);
    }
  };

  const handleSubmit = async () => {
    if (!cuentaP || !numeroFactura || !fechaFactura) {
      alert('Por favor, complete los campos obligatorios: Cuenta Proveedor, Nº Factura y Fecha Factura');
      return;
    }

    if (baseTotal <= 0) {
      alert('La base imponible debe ser mayor que 0');
      return;
    }

    const asientoData = {
      ejercicio: new Date().getFullYear(),
      codigoEmpresa: '9999',
      serie: serie,
      numeroDocumento: numeroFactura,
      fechaRegistro: new Date().toISOString().split('T')[0],
      fechaFactura,
      fechaOperacion: fechaOperacion || fechaFactura,
      fechaVencimiento: fechaVencimiento || calcularVencimiento(fechaFactura, 60),
      
      proveedor: {
        cuenta: cuentaP,
        cif: datosCuentaP.cif,
        nombre: datosCuentaP.nombre,
        cp: datosCuentaP.cp
      },
      
      detalles: detalles.map(det => ({
        base: parseFloat(det.base) || 0,
        tipoIVA: parseFloat(det.tipoIVA) || 0,
        cuotaIVA: parseFloat(det.cuotaIVA) || 0,
        retencion: parseFloat(det.retencion) || 0,
        cuotaRetencion: parseFloat(det.cuotaRetencion) || 0
      })),
      
      // Resumen calculado
      baseTotal,
      ivaTotal,
      retencionTotal,
      totalFactura,
      
      cuentaGasto,
      pagoEfectivo
    };

    try {
      const response = await axios.post('http://localhost:5000/api/factura', asientoData);
      if (response.data.success) {
        alert(`Asiento contable generado correctamente. Nº Asiento: ${response.data.data.asiento}`);
        // Limpiar formulario
        setDetalles([{ base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '19', cuotaRetencion: 0 }]);
        setNumeroFactura('');
        setCuentaP('');
      } else {
        alert('Error al generar el asiento: ' + response.data.message);
      }
    } catch (error) {
      alert('Error de conexión: ' + error.message);
    }
  };

  const calcularVencimiento = (fecha, dias) => {
    const date = new Date(fecha);
    date.setDate(date.getDate() + dias);
    return date.toISOString().split('T')[0];
  };

  const handleClear = () => {
    setDetalles([{ base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '19', cuotaRetencion: 0 }]);
    setNumeroFactura('');
    setCuentaP('');
    setInputCuenta('');
    setInputCIF('');
    setInputNombre('');
    setInputCP('');
    setFechaFactura(new Date().toISOString().split('T')[0]);
    setFechaOperacion(new Date().toISOString().split('T')[0]);
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + 60);
    setFechaVencimiento(vencimiento.toISOString().split('T')[0]);
  };

  return (
    <div className={styles.formulario1Container}>
      <h2>Factura Recibida / Gasto</h2>

      {/* Sección de Tipo de Documento */}
      <div className={styles.section}>
        <h3>Tipo de Documento</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="factura">Factura Recibida</option>
              <option value="gasto">Gasto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sección de Datos del Documento */}
      <div className={styles.section}>
        <h3>Datos del Documento</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Serie</label>
            <input type="text" value={serie} onChange={(e) => setSerie(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label>Nº Factura *</label>
            <input 
              type="text" 
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
              required 
            />
          </div>
          <div className={styles.formGroup}>
            <label>F. Factura *</label>
            <input 
              type="date" 
              value={fechaFactura}
              onChange={(e) => setFechaFactura(e.target.value)}
              required 
            />
          </div>
          <div className={styles.formGroup}>
            <label>F. Operación</label>
            <input 
              type="date" 
              value={fechaOperacion}
              onChange={(e) => setFechaOperacion(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Vencimiento</label>
            <input 
              type="date" 
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Sección de Proveedor */}
      <div className={styles.section}>
        <h3>Proveedor</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Cuenta Proveedor *</label>
            <select value={cuentaP} onChange={handleCuentaPChange} required>
              <option value="">Seleccionar</option>
              {Object.entries(nombresCuenta).map(([key, nombre]) => (
                <option key={key} value={key}>
                  {key} - {nombre}
                </option>
              ))}
            </select>
          </div>

          {isNuevoProveedor && (
            <>
              <div className={styles.formGroup}>
                <label>CIF *</label>
                <input
                  type="text"
                  value={inputCIF}
                  onChange={handleInputCIF}
                  placeholder="CIF proveedor"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Nombre *</label>
                <input
                  type="text"
                  value={inputNombre}
                  onChange={handleInputNombre}
                  placeholder="Nombre proveedor"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>CP</label>
                <input
                  type="text"
                  value={inputCP}
                  onChange={handleInputCP}
                  placeholder="Código Postal"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sección de Detalles Económicos */}
      <div className={styles.section}>
        <h3>Detalles Económicos</h3>
        <div className={styles.dualGrid}>
          <div>
            <div className={styles.formGroup}>
              <label>Cuenta de Gasto</label>
              <select value={cuentaGasto} onChange={(e) => setCuentaGasto(e.target.value)}>
                {CUENTAS_GASTO.map(cuenta => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.id} - {cuenta.nombre}
                  </option>
                ))}
              </select>
            </div>

            {detalles.map((line, i) => (
              <div className={`${styles.formRow} ${styles.detalleLinea}`} key={i}>
                <div className={styles.formGroup}>
                  <label>Base {i + 1}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={line.base}
                    onChange={(e) => handleDetalleChange(i, 'base', e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
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
                <div className={styles.formGroup}>
                  <label>Cuota IVA</label>
                  <input type="number" readOnly value={line.cuotaIVA.toFixed(2)} />
                </div>
                <div className={styles.formGroup}>
                  <label>Retención</label>
                  <select
                    value={line.retencion}
                    onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}
                  >
                    <option value="19">19%</option>
                    <option value="15">15%</option>
                    <option value="7">7%</option>
                    <option value="0">0%</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Cuota Ret.</label>
                  <input type="number" readOnly value={line.cuotaRetencion.toFixed(2)} />
                </div>
                <div className={styles.formGroup}>
                  <button 
                    type="button" 
                    className={styles.removeBtn}
                    onClick={() => removeDetalle(i)}
                    disabled={detalles.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            
            <button type="button" className={styles.addBtn} onClick={addDetalle}>
              + Añadir línea
            </button>
          </div>

          <div className={styles.derecha}>
            {/* Resumen del asiento */}
            <div className={styles.resumen}>
              <h4>Resumen del Asiento</h4>
              <div className={styles.resumenItem}>
                <span>Base Imponible:</span>
                <strong>{baseTotal.toFixed(2)} €</strong>
              </div>
              <div className={styles.resumenItem}>
                <span>IVA:</span>
                <strong>{ivaTotal.toFixed(2)} €</strong>
              </div>
              <div className={styles.resumenItem}>
                <span>Retención:</span>
                <strong>{retencionTotal.toFixed(2)} €</strong>
              </div>
              <div className={styles.resumenItem}>
                <span>Total Factura:</span>
                <strong>{totalFactura.toFixed(2)} €</strong>
              </div>
            </div>

            {isNuevoProveedor && (
              <>
                <div className={styles.formGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={pagoEfectivo}
                      onChange={(e) => setPagoEfectivo(e.target.checked)}
                    />{' '}
                    Se ha pagado en efectivo
                  </label>
                </div>

                {pagoEfectivo && (
                  <div className={styles.formGroup}>
                    <label>Cuenta Caja</label>
                    <input type="text" value="570000000" readOnly />
                  </div>
                )}
              </>
            )}

            <div className={`${styles.formGroup} ${styles.wide}`}>
              <label>Adjuntar archivo</label>
              <input type="file" />
            </div>
          </div>
        </div>
      </div>

      {/* Botones finales */}
      <div className={styles.buttonGroup}>
        <button type="button" className={styles.cancelBtn} onClick={() => window.history.back()}>
          Cancelar
        </button>
        <button type="button" className={styles.clearBtn} onClick={handleClear}>
          Limpiar
        </button>
        <button type="button" className={styles.submitBtn} onClick={handleSubmit}>
          Generar Asiento
        </button>
      </div>
    </div>
  );
};

export default FormPage1;