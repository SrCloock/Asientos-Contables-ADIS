import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from '../styles/FormPage2.module.css';

const FormPage2 = ({ user }) => {
  const [numAsiento, setNumAsiento] = useState('');
  const [tipoIngreso, setTipoIngreso] = useState('caja');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('');
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [serie, setSerie] = useState('ING');
  const [numDocumento, setNumDocumento] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [loading, setLoading] = useState(false);

  const CUENTAS_INGRESO = [
    { id: '700000000', nombre: 'Ventas de mercaderías' },
    { id: '701000000', nombre: 'Ventas de productos terminados' },
    { id: '702000000', nombre: 'Ventas de productos semi-terminados' },
    { id: '703000000', nombre: 'Ventas de subproductos y residuos' },
    { id: '704000000', nombre: 'Ventas de envases y embalajes' },
    { id: '705000000', nombre: 'Prestaciones de servicios' },
    { id: '706000000', nombre: 'Descuentos sobre ventas por pronto pago' },
    { id: '708000000', nombre: 'Devoluciones de ventas y operaciones similares' },
    { id: '709000000', nombre: 'Rappels sobre ventas' },
    { id: '759000000', nombre: 'Ingresos por arrendamientos' },
    { id: '760000000', nombre: 'Ingresos por propiedad intelectual' },
    { id: '761000000', nombre: 'Ingresos por servicios al personal' },
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

  const handleFileChange = (e) => {
    setArchivo(e.target.files[0]);
  };

  const resetForm = () => {
    setCuentaSeleccionada('');
    setImporte('');
    setConcepto('');
    setNumDocumento('');
    setFechaFactura(new Date().toISOString().split('T')[0]);
    setArchivo(null);
    
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!cuentaSeleccionada || !importe || !concepto || !numDocumento) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    if (parseFloat(importe) <= 0) {
      alert('El importe debe ser mayor a 0');
      return;
    }

    setLoading(true);

    try {
      const asientoData = {
        tipoIngreso,
        cuentaSeleccionada,
        importe: parseFloat(importe),
        concepto,
        serie,
        numDocumento,
        usuario: user?.usuario || user?.UsuarioLogicNet || 'admin'
      };

      const response = await axios.post('http://localhost:5000/api/asiento/ingreso', asientoData, {
        withCredentials: true
      });
      
      if (response.data.success) {
        const mensaje = `Asiento de ingreso #${response.data.asiento} creado correctamente\n\n` +
                       `Detalles:\n` +
                       `• Importe: ${response.data.detalles.importe.toFixed(2)}€\n` +
                       `• Cuenta ingreso: ${response.data.detalles.cuentaIngreso}\n` +
                       `• Cuenta contrapartida: ${response.data.detalles.cuentaContrapartida}\n` +
                       `• Líneas: ${response.data.detalles.lineas}`;
        
        alert(mensaje);
        resetForm();
      } else {
        alert('Error al crear el asiento: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error creando asiento de ingreso:', error);
      
      let mensajeError = 'Error al crear el asiento.';
      
      if (error.response?.data?.error) {
        mensajeError += '\n' + error.response.data.error;
      } else if (error.code === 'ERR_NETWORK') {
        mensajeError = 'Error de conexión. Verifique que el servidor backend esté ejecutándose.';
      } else if (error.message) {
        mensajeError += '\n' + error.message;
      }
      
      alert(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.fp2Container}>
      <div className={styles.fp2Header}>
        <h2>Formulario de Ingreso</h2>
        <div className={styles.fp2AsientoInfo}>
          <span>Asiento: <strong>#{numAsiento}</strong></span>
          <span>Usuario: <strong>{user?.usuario || user?.UsuarioLogicNet}</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.fp2Form}>
        <div className={styles.fp2Section}>
          <h3>Tipo de Ingreso</h3>
          <div className={styles.fp2FormRow}>
            <div className={styles.fp2FormGroup}>
              <label>Tipo *</label>
              <select
                value={tipoIngreso}
                onChange={(e) => {
                  setTipoIngreso(e.target.value);
                  setCuentaSeleccionada('');
                }}
                required
              >
                <option value="caja">Ingreso en Caja (Cuenta 570)</option>
                <option value="cliente">Ingreso por Cliente (Cuenta 430)</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.fp2Section}>
          <h3>Datos del Documento</h3>
          <div className={styles.fp2FormRow}>
            <div className={styles.fp2FormGroup}>
              <label>Serie</label>
              <input 
                type="text" 
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="ING, FAC, etc."
              />
            </div>
            <div className={styles.fp2FormGroup}>
              <label>Nº Documento *</label>
              <input 
                type="text" 
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                placeholder="Número de documento"
                required
              />
            </div>
            <div className={styles.fp2FormGroup}>
              <label>Fecha *</label>
              <input
                type="date"
                value={fechaFactura}
                onChange={(e) => setFechaFactura(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.fp2Section}>
          <h3>Importe y Cuenta</h3>
          <div className={styles.fp2FormRow}>
            <div className={styles.fp2FormGroup}>
              <label>Concepto *</label>
              <input 
                type="text" 
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Descripción del ingreso"
                required
              />
            </div>
            <div className={styles.fp2FormGroup}>
              <label>Importe *</label>
              <input 
                type="number" 
                step="0.01"
                min="0.01"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className={styles.fp2FormGroup}>
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

            <div className={styles.fp2FormGroup}>
              <label>Cuenta de Contrapartida</label>
              <input 
                type="text" 
                value={tipoIngreso === 'caja' ? '570000000' : '430000000'} 
                readOnly 
                className={styles.fp2Readonly}
              />
            </div>
          </div>
        </div>

        <div className={styles.fp2Section}>
          <h3>Archivo</h3>
          <div className={styles.fp2FormRow}>
            <div className={styles.fp2FormGroup}>
              <label>Adjuntar Archivo</label>
              <input 
                type="file" 
                onChange={handleFileChange}
                className={styles.fp2FileInput}
              />
              {archivo && (
                <span className={styles.fp2FileName}>{archivo.name}</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.fp2ButtonGroup}>
          <button 
            type="button" 
            className={styles.fp2CancelBtn} 
            onClick={() => window.history.back()}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className={styles.fp2ClearBtn} 
            onClick={resetForm}
            disabled={loading}
          >
            Limpiar
          </button>
          <button 
            type="submit" 
            className={styles.fp2SubmitBtn} 
            disabled={loading || !importe || !cuentaSeleccionada || !concepto || !numDocumento}
          >
            {loading ? 'Procesando...' : 'Crear Asiento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormPage2;