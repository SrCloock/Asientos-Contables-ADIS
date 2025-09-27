import React, { useState, useEffect } from 'react';
import styles from '../styles/FormPage1.module.css';

const cuentasPredefinidas = {
  '467893': { cif: 'B12345678', nombre: 'Proveedor A', cp: '28001' },
  '467894': { cif: 'B87654321', nombre: 'Proveedor B', cp: '08001' },
  '467895': { cif: 'B11112222', nombre: 'Proveedor C', cp: '46001' }
};

const nombresCuenta = {
  '467893': 'Corte Inglés',
  '467894': 'Mediamarkt',
  '467895': 'Alcampo',
  '4000': 'Nuevo Proveedor'
};

const FormPage1 = () => {
  const [tipo, setTipo] = useState('factura');
  const [cuentaP, setCuentaP] = useState('');
  const [datosCuentaP, setDatosCuentaP] = useState({ cif: '', nombre: '', cp: '' });
  const [pagoEfectivo, setPagoEfectivo] = useState(false);

  const [detalles, setDetalles] = useState([
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 },
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 },
    { base: '', tipoIVA: '21', cuotaIVA: 0, retencion: '15', cuotaRetencion: 0 }
  ]);

  const [inputCuenta, setInputCuenta] = useState('');
  const [inputCIF, setInputCIF] = useState('');
  const [inputNombre, setInputNombre] = useState('');
  const [inputCP, setInputCP] = useState('');

  const isNuevoProveedor = cuentaP === '4000';

  useEffect(() => {
    if (cuentaP && cuentaP !== '4000') {
      const datos = cuentasPredefinidas[cuentaP] || { cif: '', nombre: '', cp: '' };
      setDatosCuentaP(datos);
      setInputCuenta(cuentaP);
      setInputCIF(''); // no se muestran, pero mantenemos vacíos
      setInputNombre('');
      setInputCP('');
      setPagoEfectivo(false); // ocultar y resetear
      return;
    }

    if (isNuevoProveedor) {
      setDatosCuentaP({ cif: '', nombre: '', cp: '' });
      setInputCuenta('4000');
      setInputCIF('');
      setInputNombre('');
      setInputCP('');
      return;
    }

    // Autocompletar sólo si no hay selección explícita
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
    if (val !== '4000') {
      setPagoEfectivo(false);
    }
  };

  const handleInputCuenta = (e) => {
    setInputCuenta(e.target.value);
    setCuentaP(''); // anula selección explícita para permitir autocompletar
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

  const handleDateInput = (e) => {
    const input = e.target;
    if (!input.value) return;
    const parts = input.value.split('-');
    // Limitar el año a 4 dígitos
    if (parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
    }
    // Reconstruir (si faltan segmentos no hace nada extraño porque el input tipo date siempre da yyyy-mm-dd)
    input.value = parts.map((p, i) => (i === 0 ? parts[0] : p)).join('-');
  };

  return (
    <div className={styles.formulario1Container}>
      <h2>Factura Recibida / Gasto</h2>

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

      <div className={styles.section}>
        <h3>Datos del Documento</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Serie</label>
            <input type="text" value="EM" readOnly />
          </div>
          <div className={styles.formGroup}>
            <label>Nº Documento</label>
            <input type="text" />
          </div>
          <div className={styles.formGroup}>
            <label>F. Reg</label>
            <input type="date" onInput={handleDateInput} />
          </div>
          <div className={styles.formGroup}>
            <label>F. F</label>
            <input type="date" onInput={handleDateInput} />
          </div>
          <div className={styles.formGroup}>
            <label>F. Oper</label>
            <input type="date" onInput={handleDateInput} />
          </div>
          <div className={styles.formGroup}>
            <label>Vencimiento</label>
            <input type="date" onInput={handleDateInput} />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Proveedor</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Nº FRA</label>
            <input type="text" />
          </div>

          <div className={styles.formGroup}>
            <label>Cuenta</label>
            <input
              type="text"
              value={inputCuenta}
              onChange={handleInputCuenta}
              placeholder="Buscar cuenta..."
              list="cuentas-list"
            />
            <datalist id="cuentas-list">
              {Object.entries(nombresCuenta)
                .filter(
                  ([key, nombre]) =>
                    key.startsWith(inputCuenta) ||
                    nombre.toLowerCase().startsWith(inputCuenta.toLowerCase())
                )
                .map(([key, nombre]) => (
                  <option key={key} value={key}>
                    {key} - {nombre}
                  </option>
                ))}
            </datalist>
          </div>

          <div className={styles.formGroup}>
            <label>Cuenta P.</label>
            <select value={cuentaP} onChange={handleCuentaPChange}>
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
                <label>CIF</label>
                <input
                  type="text"
                  value={inputCIF}
                  onChange={handleInputCIF}
                  placeholder="CIF proveedor"
                  list="cif-list"
                />
                <datalist id="cif-list">
                  {Object.values(cuentasPredefinidas)
                    .map(({ cif }) => cif)
                    .filter((cif) => cif.toLowerCase().startsWith(inputCIF.toLowerCase()))
                    .map((cif) => (
                      <option key={cif} value={cif} />
                    ))}
                </datalist>
              </div>
              <div className={styles.formGroup}>
                <label>Nombre</label>
                <input
                  type="text"
                  value={inputNombre}
                  onChange={handleInputNombre}
                  placeholder="Nombre proveedor"
                  list="nombre-list"
                />
                <datalist id="nombre-list">
                  {Object.values(cuentasPredefinidas)
                    .map(({ nombre }) => nombre)
                    .filter((nombre) =>
                      nombre.toLowerCase().startsWith(inputNombre.toLowerCase())
                    )
                    .map((nombre) => (
                      <option key={nombre} value={nombre} />
                    ))}
                </datalist>
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

      <div className={styles.section}>
        <h3>Detalles Económicos</h3>
        <div className={styles.dualGrid}>
          <div>
            <div className={styles.formGroup}>
              <label>Analítico</label>
              <input type="text" value="EM" readOnly />
            </div>

            {detalles.map((line, i) => (
              <div className={`${styles.formRow} ${styles.detalleLinea}`} key={i}>
                <div className={styles.formGroup}>
                  <label>Base{i + 1}</label>
                  <input
                    type="number"
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
                    <option value="15">15%</option>
                    <option value="7">7%</option>
                    <option value="1">1%</option>
                    <option value="0">0%</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Cuota Retención</label>
                  <input type="number" readOnly value={line.cuotaRetencion.toFixed(2)} />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.derecha}>
            {isNuevoProveedor && (
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
            )}

            {isNuevoProveedor && pagoEfectivo && (
              <div className={styles.formGroup}>
                <label>Cuenta</label>
                <input type="text" />
              </div>
            )}

            <div className={`${styles.formGroup} ${styles.wide}`}>
              <label>Adjuntar archivo</label>
              <input type="file" />
            </div>
          </div>
        </div>
      </div>

      {/* BOTONES FINALES */}
      <div className={styles.buttonGroup}>
        <button className={styles.cancelBtn} onClick={() => window.history.back()}>
          Cancelar
        </button>
        <button className={styles.clearBtn} onClick={() => window.location.reload()}>
          Limpiar
        </button>
        <button className={styles.submitBtn} onClick={() => alert('Formulario enviado')}>
          Aceptar
        </button>
      </div>
    </div>
  );
};

export default FormPage1;