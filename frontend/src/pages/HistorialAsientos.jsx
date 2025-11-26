// pages/HistorialAsientos.jsx - VERSIÓN SIMPLIFICADA
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaSearch, 
  FaFileAlt, 
  FaCalendarAlt, 
  FaFilter, 
  FaSort, 
  FaSortUp, 
  FaSortDown,
  FaEye,
  FaEyeSlash,
  FaTimes
} from 'react-icons/fa';
import styles from '../styles/HistorialAsientos.module.css';
import config from '../config/config';

const HistorialAsientos = () => {
  const [asientos, setAsientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginacion, setPaginacion] = useState({
    paginaActual: 1,
    porPagina: 50,
    totalRegistros: 0,
    totalPaginas: 0
  });
  const [filtros, setFiltros] = useState({
    asiento: '',
    fechaDesde: '',
    fechaHasta: ''
  });
  const [filtrosAvanzados, setFiltrosAvanzados] = useState(false);
  const [asientoExpandido, setAsientoExpandido] = useState(null);
  
  // Estados para ordenación
  const [orden, setOrden] = useState({ campo: 'fechaAsiento', direccion: 'desc' });

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
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      alert('Error al cargar el historial: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda específica
  const buscarAsientos = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${config.apiBaseUrl}/api/historial-asientos/buscar`, {
        params: filtros,
        withCredentials: true
      });

      if (response.data.success) {
        setAsientos(response.data.asientos);
        setPaginacion({
          paginaActual: 1,
          porPagina: response.data.asientos.length,
          totalRegistros: response.data.totalRegistros,
          totalPaginas: 1
        });
      }
    } catch (error) {
      console.error('Error buscando asientos:', error);
      alert('Error al buscar asientos: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Efecto inicial
  useEffect(() => {
    cargarHistorial();
  }, []);

  // Manejar búsqueda
  const handleBuscar = () => {
    if (Object.values(filtros).some(val => val !== '')) {
      buscarAsientos();
    } else {
      cargarHistorial(1);
    }
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      asiento: '',
      fechaDesde: '',
      fechaHasta: ''
    });
    cargarHistorial(1);
  };

  // Manejar ordenación
  const handleOrdenar = (campo) => {
    const nuevaDireccion = orden.campo === campo && orden.direccion === 'asc' ? 'desc' : 'asc';
    setOrden({ campo, direccion: nuevaDireccion });
    
    // Ordenar localmente
    const asientosOrdenados = [...asientos].sort((a, b) => {
      let aVal = a[campo];
      let bVal = b[campo];
      
      if (campo === 'fechaAsiento' || campo === 'fechaGrabacion') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (aVal < bVal) return nuevaDireccion === 'asc' ? -1 : 1;
      if (aVal > bVal) return nuevaDireccion === 'asc' ? 1 : -1;
      return 0;
    });
    
    setAsientos(asientosOrdenados);
  };

  // Obtener ícono de ordenación
  const getIconoOrden = (campo) => {
    if (orden.campo !== campo) return <FaSort />;
    return orden.direccion === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES');
  };

  // Formatear importe
  const formatearImporte = (importe) => {
    return new Intl.NumberFormat('es-ES', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(importe);
  };

  // Toggle expandir asiento
  const toggleExpandirAsiento = (asientoNumero) => {
    setAsientoExpandido(asientoExpandido === asientoNumero ? null : asientoNumero);
  };

  // Cambiar página
  const cambiarPagina = (nuevaPagina) => {
    cargarHistorial(nuevaPagina);
  };

  // Generar array de páginas para paginación
  const generarPaginas = () => {
    const paginas = [];
    const totalPaginas = paginacion.totalPaginas;
    const paginaActual = paginacion.paginaActual;
    
    // Mostrar máximo 7 páginas en la paginación
    let inicio = Math.max(1, paginaActual - 3);
    let fin = Math.min(totalPaginas, paginaActual + 3);
    
    if (inicio > 1) paginas.push(1);
    if (inicio > 2) paginas.push('...');
    
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    
    if (fin < totalPaginas - 1) paginas.push('...');
    if (fin < totalPaginas) paginas.push(totalPaginas);
    
    return paginas;
  };

  return (
    <div className={styles.haContainer}>
      {/* Header Simplificado */}
      <div className={styles.haHeader}>
        <div className={styles.haHeaderContent}>
          <div className={styles.haHeaderTitle}>
            <FaFileAlt className={styles.haHeaderIcon} />
            <div>
              <h1>Historial de Asientos Contables</h1>
              <p>Gestión completa de asientos contables con filtros avanzados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de Filtros Simplificado */}
      <div className={styles.haFiltrosPanel}>
        <div className={styles.haFiltrosHeader}>
          <h3>
            <FaFilter />
            Filtros de Búsqueda
          </h3>
          <div className={styles.haFiltrosControls}>
            <button 
              className={styles.haToggleFiltros}
              onClick={() => setFiltrosAvanzados(!filtrosAvanzados)}
            >
              {filtrosAvanzados ? <FaEyeSlash /> : <FaEye />}
              {filtrosAvanzados ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </button>
          </div>
        </div>

        {filtrosAvanzados && (
          <div className={styles.haFiltrosContent}>
            <div className={styles.haFiltrosGrid}>
              <div className={styles.haFiltroGroup}>
                <label>Número de Asiento</label>
                <input
                  type="number"
                  value={filtros.asiento}
                  onChange={(e) => setFiltros(prev => ({ ...prev, asiento: e.target.value }))}
                  placeholder="Ej: 1001"
                />
              </div>
              <div className={styles.haFiltroGroup}>
                <label>Fecha Desde</label>
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(e) => setFiltros(prev => ({ ...prev, fechaDesde: e.target.value }))}
                />
              </div>
              <div className={styles.haFiltroGroup}>
                <label>Fecha Hasta</label>
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(e) => setFiltros(prev => ({ ...prev, fechaHasta: e.target.value }))}
                />
              </div>
            </div>
            <div className={styles.haFiltrosActions}>
              <button 
                className={styles.haBuscarBtn}
                onClick={handleBuscar}
                disabled={loading}
              >
                <FaSearch />
                {Object.values(filtros).some(val => val !== '') ? 'Buscar' : 'Cargar Todo'}
              </button>
              <button 
                className={styles.haLimpiarBtn}
                onClick={limpiarFiltros}
                disabled={loading}
              >
                <FaTimes />
                Limpiar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contenido Principal */}
      <div className={styles.haMainContent}>
        {/* Tabla de Asientos - Sin Canal */}
        <div className={styles.haTablaContainer}>
          {loading ? (
            <div className={styles.haLoading}>
              <div className={styles.haSpinner}></div>
              <p>Cargando asientos contables...</p>
            </div>
          ) : asientos.length === 0 ? (
            <div className={styles.haEmpty}>
              <FaFileAlt size={64} />
              <h3>No se encontraron asientos</h3>
              <p>No hay asientos registrados o no coinciden con los filtros aplicados.</p>
              <button 
                className={styles.haBuscarBtn}
                onClick={() => cargarHistorial(1)}
              >
                Cargar Asientos
              </button>
            </div>
          ) : (
            <>
              <div className={styles.haTablaWrapper}>
                <table className={styles.haTabla}>
                  <thead>
                    <tr>
                      <th className={styles.haColumnaAcciones}>Acciones</th>
                      <th 
                        className={styles.haColumnaOrdenable}
                        onClick={() => handleOrdenar('asiento')}
                      >
                        <span>Asiento {getIconoOrden('asiento')}</span>
                      </th>
                      <th 
                        className={styles.haColumnaOrdenable}
                        onClick={() => handleOrdenar('fechaAsiento')}
                      >
                        <span>Fecha {getIconoOrden('fechaAsiento')}</span>
                      </th>
                      <th>Comentario</th>
                      <th 
                        className={styles.haColumnaOrdenable}
                        onClick={() => handleOrdenar('totalDebe')}
                      >
                        <span>Total Debe {getIconoOrden('totalDebe')}</span>
                      </th>
                      <th 
                        className={styles.haColumnaOrdenable}
                        onClick={() => handleOrdenar('totalHaber')}
                      >
                        <span>Total Haber {getIconoOrden('totalHaber')}</span>
                      </th>
                      <th>Diferencia</th>
                      <th>Movimientos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asientos.map((asiento) => (
                      <React.Fragment key={asiento.asiento}>
                        <tr className={styles.haFilaPrincipal}>
                          <td className={styles.haCeldaAcciones}>
                            <button
                              className={styles.haExpandBtn}
                              onClick={() => toggleExpandirAsiento(asiento.asiento)}
                              title={asientoExpandido === asiento.asiento ? 'Contraer' : 'Expandir'}
                            >
                              {asientoExpandido === asiento.asiento ? '−' : '+'}
                            </button>
                          </td>
                          <td className={styles.haCeldaNumero}>
                            <strong>#{asiento.asiento}</strong>
                          </td>
                          <td className={styles.haCeldaFecha}>
                            {formatearFecha(asiento.fechaAsiento)}
                          </td>
                          <td className={styles.haCeldaComentario}>
                            <div className={styles.haComentarioContent}>
                              {asiento.comentario || 'Sin comentario'}
                            </div>
                          </td>
                          <td className={`${styles.haCeldaImporte} ${styles.haDebe}`}>
                            {formatearImporte(asiento.totalDebe)} €
                          </td>
                          <td className={`${styles.haCeldaImporte} ${styles.haHaber}`}>
                            {formatearImporte(asiento.totalHaber)} €
                          </td>
                          <td className={styles.haCeldaDiferencia}>
                            <span className={
                              Math.abs(asiento.totalDebe - asiento.totalHaber) < 0.01 
                                ? styles.haBalanceado 
                                : styles.haDesbalanceado
                            }>
                              {formatearImporte(Math.abs(asiento.totalDebe - asiento.totalHaber))} €
                            </span>
                          </td>
                          <td className={styles.haCeldaMovimientos}>
                            <span className={styles.haMovimientosCount}>
                              {asiento.movimientos.length} movimientos
                            </span>
                          </td>
                        </tr>
                        
                        {/* Fila expandida con detalles */}
                        {asientoExpandido === asiento.asiento && (
                          <tr className={styles.haFilaExpandida}>
                            <td colSpan="8">
                              <div className={styles.haDetalleAsiento}>
                                <div className={styles.haDetalleHeader}>
                                  <h4>Detalles del Asiento #{asiento.asiento}</h4>
                                  <div className={styles.haDetalleInfo}>
                                    <span>Fecha: {formatearFecha(asiento.fechaAsiento)}</span>
                                    <span>Comentario: {asiento.comentario || 'N/A'}</span>
                                  </div>
                                </div>
                                <div className={styles.haMovimientosDetalle}>
                                  <table className={styles.haTablaMovimientos}>
                                    <thead>
                                      <tr>
                                        <th>Cuenta</th>
                                        <th>Departamento</th>
                                        <th>Sección</th>
                                        <th>Proyecto</th>
                                        <th>Delegación</th>
                                        <th>Tipo</th>
                                        <th>Importe</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {asiento.movimientos.map((movimiento, index) => (
                                        <tr key={index}>
                                          <td className={styles.haCuenta}>
                                            {movimiento.codigoCuenta}
                                          </td>
                                          <td>{movimiento.codigoDepartamento || '-'}</td>
                                          <td>{movimiento.codigoSeccion || '-'}</td>
                                          <td>{movimiento.codigoProyecto || '-'}</td>
                                          <td>{movimiento.idDelegacion || '-'}</td>
                                          <td>
                                            <span className={
                                              movimiento.cargoAbono === 'D' 
                                                ? styles.haDebeBadge 
                                                : styles.haHaberBadge
                                            }>
                                              {movimiento.cargoAbono === 'D' ? 'DÉBITO' : 'CRÉDITO'}
                                            </span>
                                          </td>
                                          <td className={
                                            movimiento.cargoAbono === 'D' 
                                              ? styles.haImporteDebe 
                                              : styles.haImporteHaber
                                          }>
                                            {formatearImporte(movimiento.importeAsiento)} €
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr>
                                        <td colSpan="5"></td>
                                        <td><strong>Total Debe:</strong></td>
                                        <td className={styles.haImporteDebe}>
                                          <strong>{formatearImporte(asiento.totalDebe)} €</strong>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td colSpan="5"></td>
                                        <td><strong>Total Haber:</strong></td>
                                        <td className={styles.haImporteHaber}>
                                          <strong>{formatearImporte(asiento.totalHaber)} €</strong>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td colSpan="5"></td>
                                        <td><strong>Diferencia:</strong></td>
                                        <td className={
                                          Math.abs(asiento.totalDebe - asiento.totalHaber) < 0.01 
                                            ? styles.haBalanceado 
                                            : styles.haDesbalanceado
                                        }>
                                          <strong>{formatearImporte(Math.abs(asiento.totalDebe - asiento.totalHaber))} €</strong>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {paginacion.totalPaginas > 1 && (
                <div className={styles.haPaginacion}>
                  <div className={styles.haPaginacionInfo}>
                    Mostrando {asientos.length} de {paginacion.totalRegistros} asientos
                  </div>
                  <div className={styles.haPaginacionControls}>
                    <button
                      className={styles.haPaginaBtn}
                      onClick={() => cambiarPagina(paginacion.paginaActual - 1)}
                      disabled={paginacion.paginaActual === 1 || loading}
                    >
                      Anterior
                    </button>
                    
                    {generarPaginas().map((pagina, index) => (
                      <button
                        key={index}
                        className={`${styles.haPaginaBtn} ${
                          pagina === paginacion.paginaActual ? styles.haPaginaActiva : ''
                        } ${pagina === '...' ? styles.haPaginaPuntos : ''}`}
                        onClick={() => typeof pagina === 'number' && cambiarPagina(pagina)}
                        disabled={pagina === '...' || loading}
                      >
                        {pagina}
                      </button>
                    ))}
                    
                    <button
                      className={styles.haPaginaBtn}
                      onClick={() => cambiarPagina(paginacion.paginaActual + 1)}
                      disabled={paginacion.paginaActual === paginacion.totalPaginas || loading}
                    >
                      Siguiente
                    </button>
                  </div>
                  <div className={styles.haPaginacionSize}>
                    <select
                      value={paginacion.porPagina}
                      onChange={(e) => {
                        setPaginacion(prev => ({ ...prev, porPagina: parseInt(e.target.value) }));
                        setTimeout(() => cargarHistorial(1), 100);
                      }}
                      disabled={loading}
                    >
                      <option value="10">10 por página</option>
                      <option value="25">25 por página</option>
                      <option value="50">50 por página</option>
                      <option value="100">100 por página</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistorialAsientos;