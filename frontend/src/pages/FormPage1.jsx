import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from '../styles/FormPage1.module.css';

const FormPage1 = ({ user }) => {
  // Estado para el número de asiento
  const [numAsiento, setNumAsiento] = useState('');
  
  // Estados principales del formulario
  const [tipo, setTipo] = useState('factura');
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '' });
  const [pagoEfectivo, setPagoEfectivo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState([]);

  // Estados para inputs de búsqueda/autocompletado
  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');

  // Estados para datos del documento - usando datos del usuario
  const [serie, setSerie] = useState(user?.serie || 'EM');
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [analitico, setAnalitico] = useState(user?.analitico || 'EM');
  const [archivo, setArchivo] = useState(null);

  // Estado para las líneas de detalle
  const [detalles, setDetalles] = useState([
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 }
  ]);

  const isNuevoProveedor = cuentaP === '4000';

  // Obtener siguiente número de asiento al cargar el componente
  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/contador');
        setNumAsiento(response.data.contador);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    
    fetchContador();
  }, []);

  // Cargar proveedores desde la base de datos
  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/proveedores');
        setProveedores(response.data || []);
      } catch (error) {
        console.error('Error cargando proveedores:', error);
        setProveedores([]);
      }
    };
    
    fetchProveedores();
  }, []);

  // Efecto para autocompletar datos del proveedor
  useEffect(() => {
    if (cuentaP && cuentaP !== '4000') {
      const proveedor = proveedores.find(p => p.codigo === cuentaP);
      if (proveedor) {
        setDatosCuentaP({
          cif: proveedor.cif || '',
          nombre: proveedor.nombre || '',
          cp: proveedor.cp || ''
        });
        setInputCIF(proveedor.cif || '');
        setInputNombre(proveedor.nombre || '');
        setInputCP(proveedor.cp || '');
      }
      setPagoEfectivo(false);
      return;
    }

    if (isNuevoProveedor) {
      setDatosCuentaP({ cif: '', nombre: '', cp: '' });
      setInputCIF('');
      setInputNombre('');
      setInputCP('');
      return;
    }

    // Autocompletar basado en inputs
    const proveedorEncontrado = proveedores.find(p => 
      p.codigo === inputCuenta || 
      (p.cif && p.cif.toLowerCase().includes(inputCIF.toLowerCase())) || 
      (p.nombre && p.nombre.toLowerCase().includes(inputNombre.toLowerCase()))
    );

    if (proveedorEncontrado) {
      setCuentaP(proveedorEncontrado.codigo);
      setDatosCuentaP({
        cif: proveedorEncontrado.cif || '',
        nombre: proveedorEncontrado.nombre || '',
        cp: proveedorEncontrado.cp || ''
      });
    } else {
      setDatosCuentaP({ cif: inputCIF, nombre: inputNombre, cp: inputCP });
    }
  }, [cuentaP, inputCuenta, inputCIF, inputNombre, inputCP, proveedores]);

  // Manejadores de cambios
  const handleCuentaPChange = (e) => {
    const val = e.target.value;
    setCuentaP(val);
    setInputCuenta(val);
    if (val !== '4000') {
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

    const baseNum = parseFloat(newDetalles[index].base) || 0;
    const tipoIVANum = parseFloat(newDetalles[index].tipoIVA) || 0;
    const retencionNum = parseFloat(newDetalles[index].retencion) || 0;

    if (!isNaN(baseNum)) {
      newDetalles[index].cuotaIVA = (baseNum * tipoIVANum) / 100;
      newDetalles[index].cuotaRetencion = (baseNum * retencionNum) / 100;
    } else {
      newDetalles[index].cuotaIVA = 0;
      newDetalles[index].cuotaRetencion = 0;
    }
    setDetalles(newDetalles);
  };

  const addDetalleLine = () => {
    setDetalles([...detalles, { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 }]);
  };

  const removeDetalleLine = (index) => {
    if (detalles.length > 1) {
      const newDetalles = [...detalles];
      newDetalles.splice(index, 1);
      setDetalles(newDetalles);
    }
  };

  const handleDateInput = (e) => {
    const input = e.target;
    if (!input.value) return;
    const parts = input.value.split('-');
    if (parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
    }
    input.value = parts.map((p, i) => (i === 0 ? parts[0] : p)).join('-');
  };

  const handleFileChange = (e) => {
    setArchivo(e.target.files[0]);
  };

  // Calcular totales
  const calcularTotales = () => {
    return detalles.reduce((acc, detalle) => {
      const base = parseFloat(detalle.base) || 0;
      const iva = parseFloat(detalle.cuotaIVA) || 0;
      const retencion = parseFloat(detalle.cuotaRetencion) || 0;
      
      return {
        base: acc.base + base,
        iva: acc.iva + iva,
        retencion: acc.retencion + retencion,
        total: acc.total + base + iva - retencion
      };
    }, { base: 0, iva: 0, retencion: 0, total: 0 });
  };

  const totales = calcularTotales();

  // Reiniciar formulario después de éxito
  const resetForm = () => {
    setCuentaP('');
    setInputCuenta('');
    setInputCIF('');
    setInputNombre('');
    setInputCP('');
    setNumDocumento('');
    setFechaReg(new Date().toISOString().split('T')[0]);
    setFechaFactura(new Date().toISOString().split('T')[0]);
    setFechaOper('');
    setVencimiento('');
    setNumFRA('');
    setDetalles([{ base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 }]);
    setArchivo(null);
    setPagoEfectivo(false);
    
    // Obtener nuevo número de asiento
    const fetchNewContador = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/contador');
        setNumAsiento(response.data.contador);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
      }
    };
    
    fetchNewContador();
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const asientoData = {
        tipo,
        serie,
        numDocumento,
        fechaReg: fechaReg || new Date().toISOString().split('T')[0],
        fechaFactura: fechaFactura || new Date().toISOString().split('T')[0],
        fechaOper: fechaOper || new Date().toISOString().split('T')[0],
        vencimiento: vencimiento || new Date().toISOString().split('T')[0],
        numFRA,
        proveedor: {
          cuentaProveedor: cuentaP,
          cif: inputCIF,
          nombre: inputNombre,
          cp: inputCP
        },
        pagoEfectivo,
        analitico,
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0),
        usuario: user?.UsuarioLogicNet || 'admin',
        totales
      };

      const response = await axios.post('http://localhost:5000/api/asiento/factura', asientoData);
      
      if (response.data.success) {
        alert(`✅ Asiento contable #${response.data.asiento} creado correctamente`);
        resetForm();
      } else {
        alert('❌ Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento:', error);
      
      if (error.response?.data?.error) {
        alert('❌ Error al crear el asiento: ' + error.response.data.error);
      } else if (error.code === 'ERR_NETWORK') {
        alert('❌ Error de conexión. Verifica que el servidor backend esté ejecutándose.');
      } else {
        alert('❌ Error al crear el asiento. Verifica la conexión y los datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.fp1Container}>
      <div className={styles.fp1Header}>
        <h2>📋 Factura Recibida / Gasto</h2>
        <div className={styles.fp1AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.UsuarioLogicNet}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp1Form}>
        <div className={styles.fp1Section}>
          <h3>📄 Tipo de Documento</h3>
          <div className={styles.fp1FormRow}>
            <div className={styles.fp1FormGroup}>
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="factura">Factura Recibida</option>
                <option value="gasto">Gasto</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.fp1Section}>
          <h3>📅 Datos del Documento</h3>
          <div className={styles.fp1FormRow}>
            <div className={styles.fp1FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie} 
                onChange={(e) => setSerie(e.target.value)}
                readOnly 
              />
            </div>
            <div className={styles.fp1FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                required 
              />
            </div>
            <div className={styles.fp1FormGroup}>
              <label>F. Registro *</label>
              <input 
                type="date" 
                value={fechaReg}
                onChange={(e) => setFechaReg(e.target.value)}
                onInput={handleDateInput}
                required 
              />
            </div>
            <div className={styles.fp1FormGroup}>
              <label>F. Factura *</label>
              <input 
                type="date" 
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                onInput={handleDateInput}
                required 
              />
            </div>
            <div className={styles.fp1FormGroup}>
              <label>F. Operación</label>
              <input 
                type="date" 
                value={fechaOper}
                onChange={(e) => setFechaOper(e.target.value)}
                onInput={handleDateInput}
              />
            </div>
            <div className={styles.fp1FormGroup}>
              <label>Vencimiento</label>
              <input 
                type="date" 
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                onInput={handleDateInput}
              />
            </div>
          </div>
        </div>

        <div className={styles.fp1Section}>
          <h3>🏢 Proveedor</h3>
          <div className={styles.fp1FormRow}>
            <div className={styles.fp1FormGroup}>
              <label>Nº FRA</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura"
              />
            </div>

            <div className={styles.fp1FormGroup}>
              <label>Buscar Cuenta</label>
              <input
                type="text"
                value={inputCuenta}
                onChange={handleInputCuenta}
                placeholder="Buscar por código..."
                list="cuentas-list"
              />
              <datalist id="cuentas-list">
                {proveedores
                  .filter(proveedor => 
                    proveedor.codigo.startsWith(inputCuenta) ||
                    (proveedor.nombre && proveedor.nombre.toLowerCase().includes(inputCuenta.toLowerCase()))
                  )
                  .map(proveedor => (
                    <option key={proveedor.codigo} value={proveedor.codigo}>
                      {proveedor.codigo} - {proveedor.nombre}
                    </option>
                  ))}
              </datalist>
            </div>

            <div className={styles.fp1FormGroup}>
              <label>Seleccionar Cuenta *</label>
              <select value={cuentaP} onChange={handleCuentaPChange} required>
                <option value="">-- Seleccionar proveedor --</option>
                {proveedores.map(proveedor => (
                  <option key={proveedor.codigo} value={proveedor.codigo}>
                    {proveedor.codigo} - {proveedor.nombre}
                  </option>
                ))}
                <option value="4000">➕ Nuevo Proveedor</option>
              </select>
            </div>

            {isNuevoProveedor && (
              <>
                <div className={styles.fp1FormGroup}>
                  <label>CIF *</label>
                  <input
                    type="text"
                    value={inputCIF}
                    onChange={handleInputCIF}
                    placeholder="CIF proveedor"
                    required
                  />
                </div>
                <div className={styles.fp1FormGroup}>
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={inputNombre}
                    onChange={handleInputNombre}
                    placeholder="Nombre proveedor"
                    required
                  />
                </div>
                <div className={styles.fp1FormGroup}>
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

        <div className={styles.fp1Section}>
          <h3>💰 Detalles Económicos</h3>
          <div className={styles.fp1DualGrid}>
            <div className={styles.fp1LeftColumn}>
              <div className={styles.fp1FormGroup}>
                <label>Analítico</label>
                <input 
                  type="text" 
                  value={analitico} 
                  onChange={(e) => setAnalitico(e.target.value)}
                  readOnly 
                />
              </div>

              {detalles.map((line, i) => (
                <div className={styles.fp1DetalleLinea} key={i}>
                  <div className={styles.fp1FormRow}>
                    <div className={styles.fp1FormGroup}>
                      <label>Base {i + 1} *</label>
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
                    <div className={styles.fp1FormGroup}>
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
                    <div className={styles.fp1FormGroup}>
                      <label>Cuota IVA</label>
                      <input 
                        type="number" 
                        step="0.01"
                        readOnly 
                        value={line.cuotaIVA.toFixed(2)} 
                        className={styles.fp1Readonly}
                      />
                    </div>
                    <div className={styles.fp1FormGroup}>
                      <label>Retención</label>
                      <select
                        value={line.retencion}
                        onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}
                      >
                        <option value="15">15%</option>
                        <option value="7">7%</option>
                        <option value="1">1%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                    <div className={styles.fp1FormGroup}>
                      <label>Cuota Ret.</label>
                      <input 
                        type="number" 
                        step="0.01"
                        readOnly 
                        value={line.cuotaRetencion.toFixed(2)} 
                        className={styles.fp1Readonly}
                      />
                    </div>
                    <div className={styles.fp1FormGroup}>
                      <label>Acción</label>
                      <button 
                        type="button" 
                        className={styles.fp1RemoveBtn}
                        onClick={() => removeDetalleLine(i)}
                        disabled={detalles.length <= 1}
                        title="Eliminar línea"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" className={styles.fp1AddBtn} onClick={addDetalleLine}>
                ➕ Añadir línea
              </button>

              {/* Resumen de totales */}
              <div className={styles.fp1Totales}>
                <h4>📊 Totales:</h4>
                <div className={styles.fp1TotalItem}>
                  <span>Base Imponible:</span>
                  <span>{totales.base.toFixed(2)} €</span>
                </div>
                <div className={styles.fp1TotalItem}>
                  <span>IVA:</span>
                  <span>{totales.iva.toFixed(2)} €</span>
                </div>
                <div className={styles.fp1TotalItem}>
                  <span>Retención:</span>
                  <span>-{totales.retencion.toFixed(2)} €</span>
                </div>
                <div className={styles.fp1TotalItem + ' ' + styles.fp1TotalFinal}>
                  <span>Total:</span>
                  <span>{totales.total.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            <div className={styles.fp1RightColumn}>
              {isNuevoProveedor && (
                <div className={styles.fp1FormGroup}>
                  <label className={styles.fp1CheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={pagoEfectivo}
                      onChange={(e) => setPagoEfectivo(e.target.checked)}
                    />
                    <span>💵 Se ha pagado en efectivo</span>
                  </label>
                </div>
              )}

              {isNuevoProveedor && pagoEfectivo && (
                <div className={styles.fp1FormGroup}>
                  <label>Cuenta Caja</label>
                  <input type="text" value="570000000" readOnly className={styles.fp1Readonly} />
                </div>
              )}

              <div className={styles.fp1FormGroup}>
                <label>📎 Adjuntar archivo</label>
                <input 
                  type="file" 
                  onChange={handleFileChange}
                  className={styles.fp1FileInput}
                />
                {archivo && (
                  <span className={styles.fp1FileName}>{archivo.name}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTONES FINALES */}
        <div className={styles.fp1ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp1CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            ❌ Cancelar
          </button>
          <button 
            type="button" 
            className={styles.fp1ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            🧹 Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp1SubmitBtn} 
            disabled={loading || totales.total <= 0}
          >
            {loading ? '⏳ Procesando...' : '💾 Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage1;