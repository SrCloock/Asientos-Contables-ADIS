import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFileInvoiceDollar, FaPlus, FaTrash } from 'react-icons/fa';
import Select from 'react-select';
import styles from '../../styles/FormPage4.module.css';
import config from '../../config/config';
import { useFormShared } from '../../hooks/useFormShared';
import { round2, formatFechaForBackend, customStyles } from '../../utils/formUtils';

const Form4 = () => {
  const {
    numAsiento, refreshContador,
    serieBase,
    cuentaCaja,
    tiposIVA, ivaDefault, tiposIVALoaded,
    tiposRetencion, retencionDefault, tiposRetencionLoaded,
    cuentasGasto, cuentasGastoOptions,
    proveedores, proveedoresCuentas, proveedoresOptions
  } = useFormShared({ loadProveedores: true, loadCuentasGasto: true });

  // Form4: serie without 'C' prefix
  const serie = serieBase;
  const analitico = serieBase;

  const [loading, setLoading] = useState(false);
  const [numDocumento, setNumDocumento] = useState('');
  const [numFRA, setNumFRA] = useState('');
  const [fechaReg, setFechaReg] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [fechaOper, setFechaOper] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [concepto, setConcepto] = useState('');
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '', cuentaContable: '' });
  const [cuentaGasto, setCuentaGasto] = useState('');
  const [archivo, setArchivo] = useState('');
  const [detalles, setDetalles] = useState([]);

  const isNuevoProveedor = cuentaP === '4000';
  const isNuevoAcreedor = cuentaP === '4100';
  const isNuevo = isNuevoProveedor || isNuevoAcreedor;

  useEffect(() => {
    if (tiposIVALoaded && tiposRetencionLoaded && detalles.length === 0) {
      const ret = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
      setDetalles([{
        base: '', tipoIVA: ivaDefault, cuotaIVA: 0, ivaOverride: null,
        retencion: retencionDefault, codigoRetencion: ret?.CodigoRetencion || '0',
        cuentaAbonoRetencion: ret?.CuentaAbono || '',
        cuotaRetencion: 0, importeTotalLinea: 0
      }]);
    }
  }, [tiposIVALoaded, tiposRetencionLoaded, ivaDefault, retencionDefault]);

  useEffect(() => {
    if (!cuentaP) return;
    if (cuentaP === '4000' || cuentaP === '4100') {
      setDatosCuentaP(p => ({ ...p, cuentaContable: '' }));
    } else {
      const prov = proveedores.find(p => p.codigo === cuentaP);
      const cp = proveedoresCuentas.find(p => p.codigo === cuentaP);
      if (prov) setDatosCuentaP({ cif: prov.cif || '', nombre: prov.nombre || '', cp: prov.cp || '', cuentaContable: cp?.cuenta || '' });
    }
  }, [cuentaP, proveedores, proveedoresCuentas]);

  const handleProveedorChange = (opt) => {
    if (!opt) { setCuentaP(''); setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '' }); return; }
    setCuentaP(opt.value);
    if (opt.isNuevo) {
      setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '' });
    } else if (opt.proveedorData) {
      const p = opt.proveedorData;
      setDatosCuentaP({ cif: p.cif || '', nombre: p.nombre || '', cp: p.cp || '', cuentaContable: opt.cuentaData?.cuenta || '' });
    }
  };

  const handleDetalleChange = (i, field, value) => {
    const nd = [...detalles];
    nd[i][field] = value;
    if (field === 'retencion') {
      const t = tiposRetencion.find(t => t.PorcentajeRetencion === value);
      if (t) { nd[i].codigoRetencion = t.CodigoRetencion; nd[i].cuentaAbonoRetencion = t.CuentaAbono; }
    }
    const base = parseFloat(nd[i].base) || 0;
    const tIVA = parseFloat(nd[i].tipoIVA) || 0;
    const ret = parseFloat(nd[i].retencion) || 0;
    if (field !== 'cuotaIVA') {
      nd[i].cuotaIVA = nd[i].ivaOverride !== null ? nd[i].ivaOverride : round2(base * tIVA / 100);
    }
    nd[i].cuotaRetencion = round2(base * ret / 100);
    nd[i].importeTotalLinea = round2(base + nd[i].cuotaIVA - nd[i].cuotaRetencion);
    setDetalles(nd);
  };

  const handleCuotaIvaChange = (i, value) => {
    const nd = [...detalles];
    const n = parseFloat(value);
    if (!isNaN(n) && n >= 0) { nd[i].cuotaIVA = n; nd[i].ivaOverride = n; }
    else { nd[i].cuotaIVA = round2((parseFloat(nd[i].base) || 0) * (parseFloat(nd[i].tipoIVA) || 0) / 100); nd[i].ivaOverride = null; }
    nd[i].cuotaRetencion = round2((parseFloat(nd[i].base) || 0) * (parseFloat(nd[i].retencion) || 0) / 100);
    nd[i].importeTotalLinea = round2((parseFloat(nd[i].base) || 0) + nd[i].cuotaIVA - nd[i].cuotaRetencion);
    setDetalles(nd);
  };

  const addLine = () => {
    const ret = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
    setDetalles([...detalles, {
      base: '', tipoIVA: ivaDefault, cuotaIVA: 0, ivaOverride: null,
      retencion: retencionDefault, codigoRetencion: ret?.CodigoRetencion || '0',
      cuentaAbonoRetencion: ret?.CuentaAbono || '', cuotaRetencion: 0, importeTotalLinea: 0
    }]);
  };

  const removeLine = (i) => { if (detalles.length > 1) { const nd = [...detalles]; nd.splice(i, 1); setDetalles(nd); } };

  const calcularTotales = () => {
    return detalles.reduce((acc, d) => {
      const base = parseFloat(d.base) || 0;
      if (base > 0) {
        acc.base = round2(acc.base + base);
        acc.iva = round2(acc.iva + (parseFloat(d.cuotaIVA) || 0));
        acc.retencion = round2(acc.retencion + (parseFloat(d.cuotaRetencion) || 0));
        acc.total = round2(acc.total + (parseFloat(d.importeTotalLinea) || 0));
      }
      return acc;
    }, { base: 0, iva: 0, retencion: 0, total: 0 });
  };

  const totales = calcularTotales();

  const resetForm = () => {
    setCuentaP(''); setDatosCuentaP({ cif: '', nombre: '', cp: '', cuentaContable: '' });
    setNumDocumento(''); setNumFRA(''); setConcepto(''); setFechaOper(''); setVencimiento(''); setArchivo('');
    const ret = tiposRetencion.find(t => t.PorcentajeRetencion === retencionDefault);
    setDetalles([{ base: '', tipoIVA: ivaDefault, cuotaIVA: 0, ivaOverride: null,
      retencion: retencionDefault, codigoRetencion: ret?.CodigoRetencion || '0',
      cuentaAbonoRetencion: ret?.CuentaAbono || '', cuotaRetencion: 0, importeTotalLinea: 0 }]);
    refreshContador();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errores = [];
    if (!numDocumento.trim()) errores.push('El número de documento es obligatorio');
    if (!concepto.trim()) errores.push('El concepto es obligatorio');
    if (!cuentaP) errores.push('Debe seleccionar un proveedor/acreedor');
    if (!cuentaGasto) errores.push('Debe seleccionar una cuenta de gasto');
    if (isNuevo && !datosCuentaP.cif.trim()) errores.push('CIF/NIF obligatorio para nuevo proveedor/acreedor');
    if (isNuevo && !datosCuentaP.nombre.trim()) errores.push('Razón social obligatoria');
    if (!datosCuentaP.cuentaContable.trim()) errores.push('La cuenta contable del proveedor/acreedor es obligatoria');
    if (!detalles.some(d => d.base && parseFloat(d.base) > 0)) errores.push('Debe ingresar al menos una línea con base > 0');
    if (errores.length > 0) { alert('Errores:\n• ' + errores.join('\n• ')); return; }

    setLoading(true);
    try {
      const response = await axios.post(`${config.apiBaseUrl}/api/asiento/factura-iva-no-deducible`, {
        serie, numDocumento, numFRA,
        fechaReg: formatFechaForBackend(fechaReg),
        fechaFactura: formatFechaForBackend(fechaFactura),
        fechaOper: formatFechaForBackend(fechaOper),
        vencimiento: vencimiento ? formatFechaForBackend(vencimiento) : '',
        concepto, analitico,
        proveedor: {
          cuentaProveedor: datosCuentaP.cuentaContable,
          codigoProveedor: cuentaP,
          cif: datosCuentaP.cif, nombre: datosCuentaP.nombre, cp: datosCuentaP.cp,
          esAcreedor: isNuevoAcreedor
        },
        cuentaGasto, archivo,
        detalles: detalles.filter(d => d.base && parseFloat(d.base) > 0).map(d => ({
          base: parseFloat(d.base), tipoIVA: d.tipoIVA, retencion: d.retencion,
          codigoRetencion: d.codigoRetencion, cuentaAbonoRetencion: d.cuentaAbonoRetencion,
          cuotaIVA: parseFloat(d.cuotaIVA), ivaOverride: d.ivaOverride
        })),
        totalBase: totales.base, totalIVA: totales.iva, totalRetencion: totales.retencion, totalFactura: totales.total
      }, { withCredentials: true });

      if (response.data.success) { alert(`✅ Asiento #${response.data.asiento} creado correctamente`); resetForm(); }
      else alert('❌ Error: ' + response.data.message);
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const getNombreCuentaGasto = () => cuentasGasto.find(c => c.id === cuentaGasto)?.nombre || '';
  const getNombreCuentaProveedor = () => {
    if (isNuevoProveedor) return 'Proveedores (Nuevo)';
    if (isNuevoAcreedor) return 'Acreedores (Nuevo)';
    return proveedores.find(p => p.codigo === cuentaP)?.nombre || 'Proveedores';
  };
  const getCuentaRetencion = () => detalles[0]?.cuentaAbonoRetencion || '';

  return (
    <div className={styles.fp4Container}>
      <div className={styles.fp4Header}>
        <h2><FaFileInvoiceDollar /> Factura de Proveedor/Acreedor (IVA No Deducible)</h2>
        <div className={styles.fp4AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Serie: <strong>{serie}</strong></span>
          <span>Caja: <strong>{cuentaCaja}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp4Form}>
        <div className={styles.fp4Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Serie</label>
              <input type="text" value={serie} readOnly className={styles.fp4Readonly} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Nº Documento *</label>
              <input type="text" value={numDocumento} onChange={e => setNumDocumento(e.target.value)} required />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Nº Factura Proveedor/Acreedor</label>
              <input type="text" value={numFRA} onChange={e => setNumFRA(e.target.value)} />
            </div>
          </div>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Concepto *</label>
              <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} required />
            </div>
          </div>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Registro *</label>
              <input type="date" value={fechaReg} onChange={e => setFechaReg(e.target.value)} required />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Factura *</label>
              <input type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)} required />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Fecha de Operación</label>
              <input type="date" value={fechaOper} onChange={e => setFechaOper(e.target.value)} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Vencimiento</label>
              <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} />
            </div>
          </div>
        </div>

        <div className={styles.fp4Section}>
          <h3>Datos del Proveedor/Acreedor</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Seleccionar Proveedor/Acreedor *</label>
              <Select options={proveedoresOptions} value={proveedoresOptions.find(o => o.value === cuentaP) || null}
                onChange={handleProveedorChange} placeholder="Buscar o seleccionar..." isSearchable styles={customStyles} />
              <small>Seleccione un proveedor existente o "Nuevo Proveedor/Acreedor"</small>
            </div>
          </div>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>CIF/NIF {isNuevo && '*'}</label>
              <input type="text" value={datosCuentaP.cif}
                onChange={e => isNuevo && setDatosCuentaP(p => ({ ...p, cif: e.target.value }))}
                readOnly={!isNuevo} className={!isNuevo ? styles.fp4Readonly : ''} required={isNuevo} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Razón Social {isNuevo && '*'}</label>
              <input type="text" value={datosCuentaP.nombre}
                onChange={e => isNuevo && setDatosCuentaP(p => ({ ...p, nombre: e.target.value }))}
                readOnly={!isNuevo} className={!isNuevo ? styles.fp4Readonly : ''} required={isNuevo} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Código Postal</label>
              <input type="text" value={datosCuentaP.cp}
                onChange={e => isNuevo && setDatosCuentaP(p => ({ ...p, cp: e.target.value }))}
                readOnly={!isNuevo} className={!isNuevo ? styles.fp4Readonly : ''} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Cuenta Contable Real {isNuevo && '*'}</label>
              <input type="text" value={datosCuentaP.cuentaContable}
                onChange={e => isNuevo && setDatosCuentaP(p => ({ ...p, cuentaContable: e.target.value }))}
                readOnly={!isNuevo} className={!isNuevo ? styles.fp4Readonly : ''}
                placeholder={isNuevo ? 'Ej: 40000001' : ''} required={isNuevo} />
            </div>
          </div>
        </div>

        <div className={styles.fp4Section}>
          <h3>Detalles Económicos</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Código Analítico</label>
              <input type="text" value={analitico} readOnly className={styles.fp4Readonly} />
            </div>
            <div className={styles.fp4FormGroup}>
              <label>Cuenta de Gasto *</label>
              <Select options={cuentasGastoOptions} value={cuentasGastoOptions.find(o => o.value === cuentaGasto) || null}
                onChange={o => setCuentaGasto(o ? o.value : '')} placeholder="Buscar cuenta de gasto..." isSearchable styles={customStyles} />
            </div>
          </div>

          <div className={styles.fp4Detalles}>
            <h4>Líneas de la Factura:</h4>
            {detalles.map((line, i) => (
              <div className={styles.fp4DetalleLinea} key={i}>
                <div className={styles.fp4LineaHeader}>
                  <span>Línea {i + 1}</span>
                  {detalles.length > 1 && (
                    <button type="button" className={styles.fp4RemoveBtn} onClick={() => removeLine(i)}>
                      <FaTrash /> Eliminar
                    </button>
                  )}
                </div>
                <div className={styles.fp4FormRow}>
                  <div className={styles.fp4FormGroup}>
                    <label>Base Imponible *</label>
                    <input type="number" step="0.01" min="0" value={line.base} onChange={e => handleDetalleChange(i, 'base', e.target.value)} required />
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Tipo IVA</label>
                    <select value={line.tipoIVA} onChange={e => handleDetalleChange(i, 'tipoIVA', e.target.value)}>
                      {tiposIVA.map(t => <option key={t.CodigoIva} value={t.PorcentajeIva}>{t.PorcentajeIva}% - {t.Iva}</option>)}
                    </select>
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Cuota IVA *</label>
                    <input type="number" step="0.01" value={line.cuotaIVA.toFixed(2)} onChange={e => handleCuotaIvaChange(i, e.target.value)} className={styles.fp4Editable} />
                    <small>Puede editar manualmente la cuota de IVA</small>
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>% Retención</label>
                    <select value={line.retencion} onChange={e => handleDetalleChange(i, 'retencion', e.target.value)}>
                      {tiposRetencion.map(t => <option key={t.CodigoRetencion} value={t.PorcentajeRetencion}>{t.PorcentajeRetencion}% - {t.Retencion} (Cuenta: {t.CuentaAbono})</option>)}
                    </select>
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Cuota Retención</label>
                    <input type="number" step="0.01" readOnly value={line.cuotaRetencion.toFixed(2)} className={styles.fp4Readonly} />
                  </div>
                  <div className={styles.fp4FormGroup}>
                    <label>Total Línea</label>
                    <input type="number" step="0.01" readOnly value={line.importeTotalLinea.toFixed(2)} className={styles.fp4Readonly} />
                  </div>
                </div>
                {line.retencion !== '0' && line.cuentaAbonoRetencion && (
                  <div className={styles.fp4RetencionInfo}>
                    <small>Retención {line.retencion}% - Cuenta de abono: <strong>{line.cuentaAbonoRetencion}</strong></small>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className={styles.fp4AddBtn} onClick={addLine}><FaPlus /> Añadir línea</button>
          </div>

          <div className={styles.fp4Totales}>
            <h4>Resumen de Totales:</h4>
            <div className={styles.fp4TotalItem}><span>Base Imponible:</span><span>{totales.base.toFixed(2)} €</span></div>
            <div className={styles.fp4TotalItem}><span>IVA (No Deducible):</span><span>+ {totales.iva.toFixed(2)} €</span></div>
            <div className={styles.fp4TotalItem}><span>Retención:</span><span>- {totales.retencion.toFixed(2)} €</span></div>
            <div className={`${styles.fp4TotalItem} ${styles.fp4TotalFinal}`}>
              <span><strong>TOTAL A PAGAR:</strong></span><span><strong>{totales.total.toFixed(2)} €</strong></span>
            </div>
          </div>
        </div>

        <div className={styles.fp4Section}>
          <h3>Archivo Adjunto</h3>
          <div className={styles.fp4FormRow}>
            <div className={styles.fp4FormGroup}>
              <label>Ruta Completa del Archivo</label>
              <input type="text" value={archivo} onChange={e => setArchivo(e.target.value)} placeholder="Ej: C:\Carpeta\archivo.pdf" className={styles.fp4FileInput} />
              {archivo && <div className={styles.fp4FileName}>✅ Ruta: <strong>{archivo}</strong></div>}
            </div>
          </div>
        </div>

        <div className={styles.fp4Section}>
          <h3>Resumen del Asiento</h3>
          <div className={styles.fp4Resumen}>
            <div className={styles.fp4ResumenItem}><span>DEBE:</span><span>{cuentaGasto} - {getNombreCuentaGasto()}</span><span>{totales.base.toFixed(2)} €</span></div>
            {totales.iva > 0 && <div className={styles.fp4ResumenItem}><span>DEBE:</span><span>{cuentaGasto} - IVA No Deducible</span><span>{totales.iva.toFixed(2)} €</span></div>}
            <div className={styles.fp4ResumenItem}><span>HABER:</span><span>{datosCuentaP.cuentaContable} - {getNombreCuentaProveedor()}</span><span>{totales.total.toFixed(2)} €</span></div>
            {totales.retencion > 0 && <div className={styles.fp4ResumenItem}><span>HABER:</span><span>{getCuentaRetencion()} - Retenciones Practicadas</span><span>{totales.retencion.toFixed(2)} €</span></div>}
          </div>
        </div>

        <div className={styles.fp4ButtonGroup}>
          <button type="button" className={styles.fp4CancelBtn} onClick={() => window.history.back()} disabled={loading}>Cancelar</button>
          <button type="button" className={styles.fp4ClearBtn} onClick={resetForm} disabled={loading}>Limpiar</button>
          <button type="submit" className={styles.fp4SubmitBtn}
            disabled={loading || !cuentaP || !numDocumento || !concepto || !detalles.some(d => d.base && parseFloat(d.base) > 0) || !cuentaGasto}>
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Form4;
