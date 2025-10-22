import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from '../styles/FormPage1.module.css';

const FormPage1 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [tipo, setTipo] = useState('factura');
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '' });
  const [pagoEfectivo, setPagoEfectivo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');
  const [serie, setSerie] = useState(user?.serie || 'EM');
  const [numDocumento, setNumDocumento] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [analitico, setAnalitico] = useState(user?.analitico || 'EM');
  const [archivo, setArchivo] = useState(null);
  const [detalles, setDetalles] = useState([
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 }
  ]);

  const isNuevoProveedor = cuentaP === '4000';

  useEffect(() => {
    const fetchContador = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/contador', {
          withCredentials: true
        });
        setNumAsiento(response.data.contador);
      } catch (error) {
        console.error('Error obteniendo contador:', error);
        alert('Error al obtener el número de asiento. Verifique la conexión.');
      }
    };
    
    fetchContador();
  }, []);

  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const [proveedoresRes, cuentasRes] = await Promise.all([
          axios.get('http://localhost:5000/api/proveedores', {
            withCredentials: true
          }),
          axios.get('http://localhost:5000/api/proveedores/cuentas', {
            withCredentials: true
          })
        ]);
        
        setProveedores(proveedoresRes.data || []);
        setProveedoresCuentas(cuentasRes.data || []);
      } catch (error) {
        console.error('Error cargando proveedores:', error);
        setProveedores([]);
        setProveedoresCuentas([]);
      }
    };
    
    fetchProveedores();
  }, []);

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

  const validarDatos = () => {
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
    
    detalles.forEach((linea, index) => {
      if (linea.base && parseFloat(linea.base) <= 0) {
        errores.push(`La línea ${index + 1} tiene base imponible inválida`);
      }
    });
    
    if (errores.length > 0) {
      alert('Errores en el formulario:\n' + errores.join('\n• '));
      return false;
    }
    
    return true;
  };

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

  const calcularTotales = () => {
    return detalles.reduce((acc, detalle) => {
      const base = parseFloat(detalle.base) || 0;
      const iva = parseFloat(detalle.cuotaIVA) || 0;
      const retencion = parseFloat(detalle.cuotaRetencion) || 0;
      
      if (base > 0) {
        return {
          base: acc.base + base,
          iva: acc.iva + iva,
          retencion: acc.retencion + retencion,
          total: acc.total + base + iva - retencion
        };
      }
      return acc;
    }, { base: 0, iva: 0, retencion: 0, total: 0 });
  };

  const totales = calcularTotales();

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
    
    const fetchNewContador = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/contador', {
          withCredentials: true
        });
        setNumAsiento(response.data.contador);
      } catch (error) {
        console.error('Error actualizando contador:', error);
      }
    };
    
    fetchNewContador();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarDatos()) {
      return;
    }
    
    setLoading(true);

    try {
      const detallesFiltrados = detalles.filter(d => d.base && parseFloat(d.base) > 0);
      
      const asientoData = {
        tipo,
        serie,
        numDocumento,
        fechaReg: fechaReg || new Date().toISOString().split('T')[0],
        fechaFactura: fechaFactura || new Date().toISOString().split('T')[0],
        fechaOper: fechaOper || fechaFactura || new Date().toISOString().split('T')[0],
        vencimiento: vencimiento || '',
        numFRA,
        proveedor: {
          cuentaProveedor: cuentaP || '400000000',
          cif: inputCIF,
          nombre: inputNombre,
          cp: inputCP
        },
        pagoEfectivo,
        analitico,
        detalles: detallesFiltrados,
        usuario: user?.usuario || user?.UsuarioLogicNet || 'admin'
      };

      const response = await axios.post('http://localhost:5000/api/asiento/factura', asientoData, {
        withCredentials: true
      });
      
      if (response.data.success) {
        const mensaje = `Asiento contable #${response.data.asiento} creado correctamente\n\n` +
                       `Detalles:\n` +
                       `• Base imponible: ${response.data.detalles.base.toFixed(2)}€\n` +
                       `• IVA: ${response.data.detalles.iva.toFixed(2)}€\n` +
                       `• Retención: ${response.data.detalles.retencion.toFixed(2)}€\n` +
                       `• Total: ${response.data.detalles.total.toFixed(2)}€\n` +
                       `• Líneas: ${response.data.detalles.lineas}`;
        
        alert(mensaje);
        resetForm();
      } else {
        alert('Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento:', error);
      
      let mensajeError = 'Error al crear el asiento.';
      
      if (error.response?.data?.error) {
        mensajeError += '\n' + error.response.data.error;
        if (error.response.data.detalles) {
          mensajeError += '\n' + error.response.data.detalles;
        }
      } else if (error.code === 'ERR_NETWORK') {
        mensajeError = 'Error de conexión. Verifique que el servidor backend esté ejecutándose en el puerto 5000.';
      } else if (error.message) {
        mensajeError += '\n' + error.message;
      }
      
      alert(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.fp1Container}>
      <div className={styles.fp1Header}>
        <h2>Factura Recibida / Gasto</h2>
        <div className={styles.fp1AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario || user?.UsuarioLogicNet}</strong></span>
          <span>Empresa: <strong>9999</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp1Form}>
        <div className={styles.fp1Section}>
          <h3>Tipo de Documento</h3>
          <div className={styles.fp1FormRow}>
            <div className={styles.fp1FormGroup}>
              <label>Tipo de Documento *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} required>
                <option value="factura">Factura Recibida (Cuenta 600)</option>
                <option value="gasto">Gasto (Cuenta 622)</option>
              </select>
              <small>{tipo === 'factura' ? 'Cuenta 600000000 - Compras' : 'Cuenta 622000000 - Servicios'}</small>
            </div>
          </div>
        </div>

        <div className={styles.fp1Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp1FormRow}>
            <div className={styles.fp1FormGroup}>
              <label>Serie *</label>
              <input 
                type="text" 
                value={serie} 
                onChange={(e) => setSerie(e.target.value)}
                required
                placeholder="EJ: EM, FAC, etc."
              />
            </div>
            
            <div className={styles.fp1FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                required
                placeholder="Número de factura"
              />
            </div>
            
            <div className={styles.fp1FormGroup}>
              <label>Nº FRA Proveedor</label>
              <input 
                type="text" 
                value={numFRA}
                onChange={(e) => setNumFRA(e.target.value)}
                placeholder="Número de factura del proveedor"
              />
            </div>
          </div>
          
          <div className={styles.fp1FormRow}>
            <div className={styles.fp1FormGroup}>
              <label>Fecha Registro *</label>
              <input 
                type="date" 
                value={fechaReg}
                onChange={(e) => setFechaReg(e.target.value)}
                onInput={handleDateInput}
                required 
              />
            </div>
            
            <div className={styles.fp1FormGroup}>
              <label>Fecha Factura *</label>
              <input 
                type="date" 
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                onInput={handleDateInput}
                required 
              />
            </div>
            
            <div className={styles.fp1FormGroup}>
              <label>Fecha Operación</label>
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
          <h3>Datos del Proveedor</h3>
          
          <div className={styles.fp1FormRow}>
            <div className={styles.fp1FormGroup}>
              <label>Buscar Proveedor</label>
              <input
                type="text"
                value={inputCuenta}
                onChange={handleInputCuenta}
                placeholder="Buscar por código o nombre..."
                list="cuentas-list"
              />
              <datalist id="cuentas-list">
                {proveedores.map(proveedor => (
                  <option key={proveedor.codigo} value={proveedor.codigo}>
                    {proveedor.codigo} - {proveedor.nombre}
                  </option>
                ))}
              </datalist>
            </div>

            <div className={styles.fp1FormGroup}>
              <label>Seleccionar Proveedor *</label>
              <select value={cuentaP} onChange={handleCuentaPChange} required>
                <option value="">-- Seleccionar proveedor existente --</option>
                {proveedores.map(proveedor => (
                  <option key={proveedor.codigo} value={proveedor.codigo}>
                    {proveedor.codigo} - {proveedor.nombre} ({proveedor.cif})
                  </option>
                ))}
                <option value="4000">NUEVO PROVEEDOR (Cuenta 400)</option>
              </select>
            </div>
          </div>

          <div className={styles.fp1FormRow}>
            {isNuevoProveedor ? (
              <>
                <div className={styles.fp1FormGroup}>
                  <label>CIF/NIF *</label>
                  <input
                    type="text"
                    value={inputCIF}
                    onChange={handleInputCIF}
                    placeholder="A12345678"
                    required
                  />
                </div>
                
                <div className={styles.fp1FormGroup}>
                  <label>Razón Social *</label>
                  <input
                    type="text"
                    value={inputNombre}
                    onChange={handleInputNombre}
                    placeholder="Nombre del proveedor"
                    required
                  />
                </div>
                
                <div className={styles.fp1FormGroup}>
                  <label>Código Postal</label>
                  <input
                    type="text"
                    value={inputCP}
                    onChange={handleInputCP}
                    placeholder="28001"
                  />
                </div>
                
                <div className={styles.fp1FormGroup}>
                  <label className={styles.fp1CheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={pagoEfectivo}
                      onChange={(e) => setPagoEfectivo(e.target.checked)}
                    />
                    <span>Pago en efectivo (Cuenta 570)</span>
                  </label>
                </div>
              </>
            ) : cuentaP ? (
              <>
                <div className={styles.fp1FormGroup}>
                  <label>CIF/NIF</label>
                  <input type="text" value={datosCuentaP.cif} readOnly className={styles.fp1Readonly} />
                </div>
                
                <div className={styles.fp1FormGroup}>
                  <label>Razón Social</label>
                  <input type="text" value={datosCuentaP.nombre} readOnly className={styles.fp1Readonly} />
                </div>
                
                <div className={styles.fp1FormGroup}>
                  <label>C.P.</label>
                  <input type="text" value={datosCuentaP.cp} readOnly className={styles.fp1Readonly} />
                </div>
                
                <div className={styles.fp1FormGroup}>
                  <label>Cuenta Contable</label>
                  <input 
                    type="text" 
                    value="400000000" 
                    readOnly 
                    className={styles.fp1Readonly}
                    title="Cuenta de proveedores por defecto"
                  />
                </div>
              </>
            ) : (
              <div className={styles.fp1InfoBox}>
                <p>Seleccione un proveedor existente o cree uno nuevo</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.fp1Section}>
          <h3>Detalles Económicos</h3>
          
          <div className={styles.fp1DualGrid}>
            <div className={styles.fp1LeftColumn}>
              <div className={styles.fp1FormGroup}>
                <label>Código Analítico</label>
                <input 
                  type="text" 
                  value={analitico} 
                  onChange={(e) => setAnalitico(e.target.value)}
                  readOnly 
                  className={styles.fp1Readonly}
                />
                <small>Centro de coste asignado al usuario</small>
              </div>

              <div className={styles.fp1DetallesContainer}>
                <h4>Líneas de Detalle:</h4>
                
                {detalles.map((line, i) => (
                  <div className={styles.fp1DetalleLinea} key={i}>
                    <div className={styles.fp1LineaHeader}>
                      <span>Línea {i + 1}</span>
                      {detalles.length > 1 && (
                        <button 
                          type="button" 
                          className={styles.fp1RemoveBtn}
                          onClick={() => removeDetalleLine(i)}
                          title="Eliminar línea"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                    
                    <div className={styles.fp1FormRow}>
                      <div className={styles.fp1FormGroup}>
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
                      
                      <div className={styles.fp1FormGroup}>
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
                        <label>% Retención</label>
                        <select
                          value={line.retencion}
                          onChange={(e) => handleDetalleChange(i, 'retencion', e.target.value)}
                        >
                          <option value="15">15% Profesional</option>
                          <option value="7">7% Reducido</option>
                          <option value="1">1% Especial</option>
                          <option value="0">0% Sin retención</option>
                        </select>
                      </div>
                      
                      <div className={styles.fp1FormGroup}>
                        <label>Cuota Retención</label>
                        <input 
                          type="number" 
                          step="0.01"
                          readOnly 
                          value={line.cuotaRetencion.toFixed(2)} 
                          className={styles.fp1Readonly}
                        />
                      </div>
                    </div>
                    
                    <div className={styles.fp1LineaTotal}>
                      <strong>Total línea: {
                        ((parseFloat(line.base) || 0) + 
                         (parseFloat(line.cuotaIVA) || 0) - 
                         (parseFloat(line.cuotaRetencion) || 0)).toFixed(2)
                      } €</strong>
                    </div>
                  </div>
                ))}
                
                <button type="button" className={styles.fp1AddBtn} onClick={addDetalleLine}>
                  Añadir otra línea
                </button>
              </div>

              <div className={styles.fp1Totales}>
                <h4>Resumen de Totales:</h4>
                <div className={styles.fp1TotalItem}>
                  <span>Base Imponible:</span>
                  <span>{totales.base.toFixed(2)} €</span>
                </div>
                <div className={styles.fp1TotalItem}>
                  <span>IVA:</span>
                  <span>+ {totales.iva.toFixed(2)} €</span>
                </div>
                <div className={styles.fp1TotalItem}>
                  <span>Retención:</span>
                  <span>- {totales.retencion.toFixed(2)} €</span>
                </div>
                <div className={styles.fp1TotalItem + ' ' + styles.fp1TotalFinal}>
                  <span>
                    <strong>TOTAL FACTURA:</strong>
                  </span>
                  <span>
                    <strong>{totales.total.toFixed(2)} €</strong>
                  </span>
                </div>
                
                {totales.total > 0 && (
                  <div className={styles.fp1Desglose}>
                    <small>Desglose contable:</small>
                    <small>• Proveedor (400): {totales.total.toFixed(2)}€ HABER</small>
                    <small>• {tipo === 'factura' ? 'Compra (600)' : 'Gasto (622)'}: {totales.base.toFixed(2)}€ DEBE</small>
                    {totales.iva > 0 && <small>• IVA (472): {totales.iva.toFixed(2)}€ DEBE</small>}
                    {totales.retencion > 0 && <small>• Retención (4751): {totales.retencion.toFixed(2)}€ HABER</small>}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.fp1RightColumn}>
              {isNuevoProveedor && pagoEfectivo && (
                <div className={styles.fp1InfoBox}>
                  <h4>Pago en Efectivo</h4>
                  <p>Se utilizará la cuenta <strong>570000000</strong> para el pago en efectivo.</p>
                </div>
              )}

              <div className={styles.fp1FormGroup}>
                <label>Adjuntar archivo (Opcional)</label>
                <input 
                  type="file" 
                  onChange={handleFileChange}
                  className={styles.fp1FileInput}
                  accept=".pdf,.jpg,.png,.doc,.docx"
                />
                {archivo && (
                  <div className={styles.fp1FileInfo}>
                    <span className={styles.fp1FileName}>{archivo.name}</span>
                    <small>Tamaño: {(archivo.size / 1024).toFixed(2)} KB</small>
                  </div>
                )}
              </div>

              <div className={styles.fp1InfoBox}>
                <h4>Información del Asiento</h4>
                <p><strong>Número:</strong> #{numAsiento}</p>
                <p><strong>Ejercicio:</strong> 2025</p>
                <p><strong>Empresa:</strong> 9999</p>
                <p><strong>Usuario:</strong> {user?.usuario || user?.UsuarioLogicNet}</p>
                <p><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.fp1ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp1CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className={styles.fp1ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp1SubmitBtn} 
            disabled={loading || !numDocumento || (!cuentaP && !isNuevoProveedor) || totales.total <= 0}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage1;