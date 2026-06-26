import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config/config';

// Options:
//   loadProveedores  — also fetch proveedores + proveedores/cuentas
//   loadCuentasGasto — also fetch cuentas/gastos (Form4, Form5, Form7)
export const useFormShared = ({ loadProveedores = false, loadCuentasGasto = false } = {}) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [serieBase, setSerieBase] = useState('');
  const [cuentaCaja, setCuentaCaja] = useState('');

  const [tiposIVA, setTiposIVA] = useState([]);
  const [tiposRetencion, setTiposRetencion] = useState([]);
  const [ivaDefault, setIvaDefault] = useState('21');
  const [retencionDefault, setRetencionDefault] = useState('0');
  const [tiposIVALoaded, setTiposIVALoaded] = useState(false);
  const [tiposRetencionLoaded, setTiposRetencionLoaded] = useState(false);

  const [cuentasGasto, setCuentasGasto] = useState([]);
  const [cuentasGastoOptions, setCuentasGastoOptions] = useState([]);

  const [proveedores, setProveedores] = useState([]);
  const [proveedoresCuentas, setProveedoresCuentas] = useState([]);
  const [proveedoresOptions, setProveedoresOptions] = useState([]);

  const refreshContador = useCallback(async () => {
    try {
      const res = await axios.get(`${config.apiBaseUrl}/api/contador`, { withCredentials: true });
      setNumAsiento(res.data.contador + 1);
    } catch {}
  }, []);

  useEffect(() => {
    refreshContador();

    const fetchAll = async () => {
      try {
        const sessionRes = await axios.get(`${config.apiBaseUrl}/api/session`, { withCredentials: true });
        if (sessionRes.data.authenticated) {
          const u = sessionRes.data.user;
          setSerieBase(u.codigoCanal || '');
          setCuentaCaja(u.cuentaCaja || '');
        }

        const requests = [
          axios.get(`${config.apiBaseUrl}/api/tipos-iva`, { withCredentials: true }),
          axios.get(`${config.apiBaseUrl}/api/tipos-retencion`, { withCredentials: true })
        ];
        if (loadCuentasGasto) {
          requests.push(axios.get(`${config.apiBaseUrl}/api/cuentas/gastos`, { withCredentials: true }));
        }
        if (loadProveedores) {
          requests.push(axios.get(`${config.apiBaseUrl}/api/proveedores`, { withCredentials: true }));
          requests.push(axios.get(`${config.apiBaseUrl}/api/proveedores/cuentas`, { withCredentials: true }));
        }

        const results = await Promise.all(requests);
        let idx = 0;

        const ivaData = results[idx++].data.map(t => ({
          ...t, PorcentajeIva: parseFloat(t.PorcentajeIva).toString()
        }));
        setTiposIVA(ivaData);
        setTiposIVALoaded(true);
        const iva21 = ivaData.find(t => t.PorcentajeIva === '21');
        setIvaDefault(iva21 ? '21' : (ivaData[0]?.PorcentajeIva || '21'));

        const retData = results[idx++].data.map(t => ({
          ...t,
          PorcentajeRetencion: parseFloat(t.PorcentajeRetencion).toString(),
          CuentaAbono: t.CuentaAbono || ''
        }));
        setTiposRetencion(retData);
        setTiposRetencionLoaded(true);
        const ret0 = retData.find(t => t.PorcentajeRetencion === '0');
        setRetencionDefault(ret0 ? '0' : (retData[0]?.PorcentajeRetencion || '0'));

        if (loadCuentasGasto) {
          const gastosData = results[idx++].data;
          setCuentasGasto(gastosData);
          setCuentasGastoOptions(gastosData.map(c => ({ value: c.id, label: `${c.id} - ${c.nombre}` })));
        }

        if (loadProveedores) {
          const provData = results[idx++].data;
          const cuentasData = results[idx++].data;
          setProveedores(provData);
          setProveedoresCuentas(cuentasData);

          const provFiltrados = provData.filter(p => p.codigo !== '40000000' && p.codigo !== '41000000');
          setProveedoresOptions([
            { value: '4000', label: '➕ NUEVO PROVEEDOR', isNuevo: true, tipoCuenta: 'proveedor' },
            { value: '4100', label: '➕ NUEVO ACREEDOR', isNuevo: true, tipoCuenta: 'acreedor' },
            ...provFiltrados.map(p => {
              const cp = cuentasData.find(c => c.codigo === p.codigo);
              return {
                value: p.codigo,
                label: `${p.codigo} - ${p.nombre} - Cuenta: ${cp?.cuenta || '(sin cuenta)'}`,
                proveedorData: p,
                cuentaData: cp,
                tipoCuenta: 'existente'
              };
            })
          ]);
        }
      } catch (err) {
        console.error('useFormShared: error loading master data', err);
      }
    };

    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    numAsiento, setNumAsiento, refreshContador,
    serieBase,
    cuentaCaja,
    tiposIVA, ivaDefault, tiposIVALoaded,
    tiposRetencion, retencionDefault, tiposRetencionLoaded,
    cuentasGasto, cuentasGastoOptions,
    proveedores, proveedoresCuentas, proveedoresOptions
  };
};
