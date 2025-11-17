// pages/HistorialAsientos.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaSearch, FaFileAlt, FaEye, FaCalendarAlt, FaFilter } from 'react-icons/fa';
import styles from '../styles/HistorialAsientos.module.css';
import config from '../config/config';

const HistorialAsientos = () => {
  const [asientos, setAsientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    asiento: '',
    fechaDesde: '',
    fechaHasta: '',
    cuenta: ''
  });
  const [paginacion, setPaginacion] = useState({
    paginaActual: 1,
    porPagina: 10,
    totalRegistros: 0,
    totalPaginas: 0
  });
  const [estadisticas, setEstadisticas] = useState({
    totalAsientos: 0,
    totalDebe: 0,
    totalHaber: 0
  });

  // Cargar historial
  const cargarHistorial = async (pagina = 1) => {
    setLoading(true);
    try {
      const response = await axios.get(`${config.apiBaseUrl}/api/historial-asientos`, {
        params: {
          pagina,
          porPagina: paginacion.porPagina
        },
        withCredentials: true
      });

      if (response.data.success) {
        setAsientos(response.data.asientos);
        setPaginacion(response.data.paginacion);
        setEstadisticas(response.data.estadisticas);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      alert('Error al cargar el historial: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Buscar con filtros
  const buscarAsientos = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${config.apiBaseUrl}/api/historial-asientos/buscar`, {
        params: filtros,
        withCredentials: true
      });

      if (response.data.success) {
        setAsientos(response.data.asientos);
        setPaginacion(prev => ({
          ...prev,
          totalRegistros: response.data.totalRegistros,
          paginaActual: 1
        }));
      }
    } catch (error) {
      console.error('Error buscando asientos:', error);
      alert('Error en la búsqueda: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Efecto inicial
  useEffect(() => {
    cargarHistorial();
  }, []);

  // Manejar cambios de página
  const handlePaginaChange = (nuevaPagina) => {
    cargarHistorial(nuevaPagina);
  };

  // Manejar cambios en filtros
  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      asiento: '',
      fechaDesde: '',
      fechaHasta: '',
      cuenta: ''
    });
    cargarHistorial(1);
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES');
  };

  return (
    <div className={styles.haContainer}>
      <div className={styles.haHeader}>
        <h2>
          <FaFileAlt />
          Historial de Asientos - Canal: {asientos[0]?.codigoCanal || 'Cargando...'}
        </h2>
        <div className={styles.haEstadisticas}>
          <span>Total Asientos: <strong>{estadisticas.totalAsientos}</strong></span>
          <span>Total Debe: <strong>{estadisticas.totalDebe.toFixed(2)} €</strong></span>
          <span>Total Haber: <strong>{estadisticas.totalHaber.toFixed(2)} €</strong></span>
        </div>
      </div>

      {/* Filtros */}
      <div className={styles.haFiltros}>
        <h3>
          <FaFilter />
          Filtros de Búsqueda
        </h3>
        <div className={styles.haFiltrosGrid}>
          <div className={styles.haFiltroGroup}>
            <label>Número de Asiento</label>
            <input
              type="number"
              value={filtros.asiento}
              onChange={(e) => handleFiltroChange('asiento', e.target.value)}
              placeholder="Ej: 1001"
            />
          </div>
          <div className={styles.haFiltroGroup}>
            <label>Fecha Desde</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => handleFiltroChange('fechaDesde', e.target.value)}
            />
          </div>
          <div className={styles.haFiltroGroup}>
            <label>Fecha Hasta</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => handleFiltroChange('fechaHasta', e.target.value)}
            />
          </div>
          <div className={styles.haFiltroGroup}>
            <label>Cuenta Contable</label>
            <input
              type="text"
              value={filtros.cuenta}
              onChange={(e) => handleFiltroChange('cuenta', e.target.value)}
              placeholder="Ej: 600000000"
            />
          </div>
        </div>
        <div className={styles.haFiltrosActions}>
          <button 
            className={styles.haBuscarBtn}
            onClick={buscarAsientos}
            disabled={loading}
          >
            <FaSearch />
            Buscar
          </button>
          <button 
            className={styles.haLimpiarBtn}
            onClick={limpiarFiltros}
            disabled={loading}
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Lista de Asientos */}
      <div className={styles.haLista}>
        {loading ? (
          <div className={styles.haLoading}>
            <div className={styles.haSpinner}></div>
            <p>Cargando asientos...</p>
          </div>
        ) : asientos.length === 0 ? (
          <div className={styles.haEmpty}>
            <FaFileAlt size={48} />
            <h3>No se encontraron asientos</h3>
            <p>No hay asientos registrados para tu canal o no coinciden con los filtros aplicados.</p>
          </div>
        ) : (
          <>
            {asientos.map((asiento) => (
              <div key={asiento.asiento} className={styles.haAsientoCard}>
                <div className={styles.haAsientoHeader}>
                  <div className={styles.haAsientoInfo}>
                    <span className={styles.haAsientoNumero}>
                      Asiento #{asiento.asiento}
                    </span>
                    <span className={styles.haAsientoFecha}>
                      <FaCalendarAlt />
                      {formatearFecha(asiento.fechaAsiento)}
                    </span>
                    <span className={styles.haAsientoCanal}>
                      Canal: {asiento.codigoCanal}
                    </span>
                  </div>
                  <div className={styles.haAsientoTotales}>
                    <span>DEBE: {asiento.totalDebe.toFixed(2)} €</span>
                    <span>HABER: {asiento.totalHaber.toFixed(2)} €</span>
                  </div>
                </div>
                
                <div className={styles.haAsientoComentario}>
                  {asiento.comentario || 'Sin comentario'}
                </div>

                {/* Detalles de movimientos */}
                <div className={styles.haMovimientos}>
                  <h4>Movimientos:</h4>
                  {asiento.movimientos.map((mov, index) => (
                    <div key={index} className={styles.haMovimiento}>
                      <span className={styles.haMovimientoCuenta}>
                        {mov.codigoCuenta}
                      </span>
                      <span className={styles.haMovimientoTipo}>
                        {mov.cargoAbono === 'D' ? 'DEBE' : 'HABER'}
                      </span>
                      <span className={styles.haMovimientoImporte}>
                        {mov.importeAsiento.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Paginación */}
      {paginacion.totalPaginas > 1 && (
        <div className={styles.haPaginacion}>
          <button
            onClick={() => handlePaginaChange(paginacion.paginaActual - 1)}
            disabled={paginacion.paginaActual === 1 || loading}
          >
            Anterior
          </button>
          
          <span>
            Página {paginacion.paginaActual} de {paginacion.totalPaginas}
          </span>
          
          <button
            onClick={() => handlePaginaChange(paginacion.paginaActual + 1)}
            disabled={paginacion.paginaActual === paginacion.totalPaginas || loading}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default HistorialAsientos;