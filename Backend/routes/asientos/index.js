'use strict';

const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../../db');
const { requireAuth } = require('../../middleware/auth');

// Contador: GET con ejercicio como query param
router.get('/api/contador', requireAuth, async (req, res) => {
  let transaction;

  try {
    const ejercicioParam = req.query.ejercicio;
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam, 10) : new Date().getFullYear();

    if (isNaN(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
      return res.status(400).json({ success: false, error: 'Ejercicio inválido' });
    }

    transaction = new sql.Transaction(getPool());
    await transaction.begin();

    const result = await transaction.request()
      .input('ejercicio', sql.Int, ejercicio)
      .query(`
        SELECT sysContadorValor
        FROM LsysContadores
        WHERE sysAplicacion = 'CON'
          AND sysGrupo = '1'
          AND sysEjercicio = @ejercicio
          AND sysNombreContador = 'ASIENTOS'
      `);

    let contador;
    let contadorCreado = false;

    if (result.recordset.length === 0) {
      const valorInicial = 1;
      await transaction.request()
        .input('ejercicio', sql.Int, ejercicio)
        .input('valorInicial', sql.Int, valorInicial)
        .query(`
          INSERT INTO LsysContadores
          (sysAplicacion, sysGrupo, sysEjercicio, sysNombreContador, sysContadorValor)
          VALUES ('CON', '1', @ejercicio, 'ASIENTOS', @valorInicial)
        `);
      contador = valorInicial;
      contadorCreado = true;
    } else {
      contador = result.recordset[0].sysContadorValor;
    }

    await transaction.commit();

    res.json({
      success: true,
      ejercicio,
      contador,
      proximoAsiento: contador,
      contadorCreado
    });

  } catch (err) {
    if (transaction) {
      try { await transaction.rollback(); } catch {}
    }

    // Si la PK ya existe (creación concurrente), reintentar la lectura
    if (err.number === 2627 || (err.message && err.message.includes('PRIMARY KEY'))) {
      try {
        const ejercicio = req.query.ejercicio ? parseInt(req.query.ejercicio, 10) : new Date().getFullYear();
        const retry = await getPool().request()
          .input('ejercicio', sql.Int, ejercicio)
          .query(`
            SELECT sysContadorValor FROM LsysContadores
            WHERE sysAplicacion = 'CON' AND sysGrupo = '1'
              AND sysEjercicio = @ejercicio AND sysNombreContador = 'ASIENTOS'
          `);
        if (retry.recordset.length > 0) {
          const contador = retry.recordset[0].sysContadorValor;
          return res.json({ success: true, ejercicio, contador, proximoAsiento: contador, contadorCreado: false });
        }
      } catch {}
    }

    res.status(500).json({ success: false, error: 'Error obteniendo contador: ' + err.message });
  }
});

// Historial paginado
router.get('/api/historial-asientos', requireAuth, async (req, res) => {
  try {
    const pagina = parseInt(req.query.pagina, 10) || 1;
    const porPagina = parseInt(req.query.porPagina, 10) || 50;
    const codigoCanal = req.session.user?.codigoCanal;
    const ejercicioParam = req.query.ejercicio;

    if (!codigoCanal) {
      return res.status(400).json({ success: false, error: 'CodigoCanal no disponible en la sesión' });
    }

    const offset = (pagina - 1) * porPagina;

    let queryBase = `
      SELECT m.Asiento, m.Ejercicio, m.FechaAsiento, m.Comentario, m.CodigoCuenta,
             m.CargoAbono, m.ImporteAsiento, m.CodigoCanal, m.CodigoDepartamento,
             m.CodigoSeccion, m.CodigoProyecto, m.IdDelegacion, m.FechaGrabacion,
             COUNT(*) OVER() as TotalRegistros
      FROM Movimientos m
      WHERE m.codigoempresa = 1 AND m.CodigoCanal = @CodigoCanal
        AND m.TipoMov = 0 AND m.TipoEntrada = 'EX'
    `;

    let queryStats = `
      SELECT COUNT(*) as TotalAsientos,
             SUM(CASE WHEN CargoAbono = 'D' THEN ImporteAsiento ELSE 0 END) as TotalDebe,
             SUM(CASE WHEN CargoAbono = 'H' THEN ImporteAsiento ELSE 0 END) as TotalHaber
      FROM Movimientos
      WHERE codigoempresa = 1 AND CodigoCanal = @CodigoCanal
        AND TipoMov = 0 AND TipoEntrada = 'EX'
    `;

    const request = getPool().request().input('CodigoCanal', sql.VarChar, codigoCanal);
    const requestStats = getPool().request().input('CodigoCanal', sql.VarChar, codigoCanal);

    if (ejercicioParam) {
      const ejercicio = parseInt(ejercicioParam, 10);
      if (!isNaN(ejercicio)) {
        queryBase += ' AND m.Ejercicio = @Ejercicio';
        queryStats += ' AND Ejercicio = @Ejercicio';
        request.input('Ejercicio', sql.Int, ejercicio);
        requestStats.input('Ejercicio', sql.Int, ejercicio);
      }
    }

    queryBase += `
      ORDER BY m.Ejercicio DESC, m.Asiento DESC, m.FechaGrabacion DESC
      OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
    `;

    request.input('Offset', sql.Int, offset);
    request.input('PageSize', sql.Int, porPagina);

    const [result, statsResult, yearsResult] = await Promise.all([
      request.query(queryBase),
      requestStats.query(queryStats),
      getPool().request()
        .input('CodigoCanal', sql.VarChar, codigoCanal)
        .query(`
          SELECT DISTINCT Ejercicio FROM Movimientos
          WHERE codigoempresa = 1 AND CodigoCanal = @CodigoCanal
            AND TipoMov = 0 AND TipoEntrada = 'EX'
          ORDER BY Ejercicio DESC
        `)
    ]);

    const totalRegistros = result.recordset.length > 0 ? result.recordset[0].TotalRegistros : 0;
    const asientosAgrupados = {};

    result.recordset.forEach(m => {
      const key = `${m.Ejercicio}-${m.Asiento}`;
      if (!asientosAgrupados[key]) {
        asientosAgrupados[key] = {
          ejercicio: m.Ejercicio, asiento: m.Asiento, fechaAsiento: m.FechaAsiento,
          comentario: m.Comentario, codigoCanal: m.CodigoCanal, fechaGrabacion: m.FechaGrabacion,
          movimientos: [], totalDebe: 0, totalHaber: 0
        };
      }
      asientosAgrupados[key].movimientos.push({
        codigoCuenta: m.CodigoCuenta, cargoAbono: m.CargoAbono,
        importeAsiento: parseFloat(m.ImporteAsiento),
        codigoDepartamento: m.CodigoDepartamento, codigoSeccion: m.CodigoSeccion,
        codigoProyecto: m.CodigoProyecto, idDelegacion: m.IdDelegacion
      });
      if (m.CargoAbono === 'D') asientosAgrupados[key].totalDebe += parseFloat(m.ImporteAsiento);
      else asientosAgrupados[key].totalHaber += parseFloat(m.ImporteAsiento);
    });

    const asientos = Object.values(asientosAgrupados)
      .sort((a, b) => b.ejercicio - a.ejercicio || b.asiento - a.asiento);

    res.json({
      success: true,
      filtroEjercicio: ejercicioParam ? parseInt(ejercicioParam, 10) : 'Todos',
      añosDisponibles: yearsResult.recordset.map(r => r.Ejercicio),
      asientos,
      paginacion: { paginaActual: pagina, porPagina, totalRegistros, totalPaginas: Math.ceil(totalRegistros / porPagina) },
      estadisticas: {
        totalAsientos: statsResult.recordset[0]?.TotalAsientos || 0,
        totalDebe: parseFloat(statsResult.recordset[0]?.TotalDebe || 0),
        totalHaber: parseFloat(statsResult.recordset[0]?.TotalHaber || 0)
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Error obteniendo historial: ' + err.message });
  }
});

// Búsqueda de asientos con filtros avanzados
router.get('/api/historial-asientos/buscar', requireAuth, async (req, res) => {
  try {
    const { asiento, fechaDesde, fechaHasta, cuenta, ejercicio: ejercicioParam,
            comentario, codigoDepartamento, codigoSeccion, codigoProyecto } = req.query;
    const codigoCanal = req.session.user?.codigoCanal;

    if (!codigoCanal) {
      return res.status(400).json({ success: false, error: 'CodigoCanal no disponible en la sesión' });
    }

    let query = `
      SELECT m.Asiento, m.Ejercicio, m.FechaAsiento, m.Comentario, m.CodigoCuenta,
             m.CargoAbono, m.ImporteAsiento, m.CodigoCanal, m.CodigoDepartamento,
             m.CodigoSeccion, m.CodigoProyecto, m.IdDelegacion, m.FechaGrabacion
      FROM Movimientos m
      WHERE m.codigoempresa = 1 AND m.CodigoCanal = @CodigoCanal
        AND m.TipoMov = 0 AND m.TipoEntrada = 'EX'
    `;

    const request = getPool().request().input('CodigoCanal', sql.VarChar, codigoCanal);

    if (ejercicioParam && !isNaN(parseInt(ejercicioParam, 10))) {
      query += ' AND m.Ejercicio = @Ejercicio';
      request.input('Ejercicio', sql.Int, parseInt(ejercicioParam, 10));
    }
    if (asiento && !isNaN(parseInt(asiento, 10))) {
      query += ' AND m.Asiento = @Asiento';
      request.input('Asiento', sql.Int, parseInt(asiento, 10));
    }
    if (fechaDesde) {
      query += ' AND m.FechaAsiento >= @FechaDesde';
      request.input('FechaDesde', sql.Date, new Date(fechaDesde));
    }
    if (fechaHasta) {
      query += ' AND m.FechaAsiento <= @FechaHasta';
      request.input('FechaHasta', sql.Date, new Date(fechaHasta));
    }
    if (cuenta) {
      query += ' AND m.CodigoCuenta LIKE @Cuenta';
      request.input('Cuenta', sql.VarChar, cuenta + '%');
    }
    if (comentario) {
      query += ' AND m.Comentario LIKE @Comentario';
      request.input('Comentario', sql.VarChar, `%${comentario}%`);
    }
    if (codigoDepartamento) {
      query += ' AND m.CodigoDepartamento = @CodigoDepartamento';
      request.input('CodigoDepartamento', sql.VarChar, codigoDepartamento);
    }
    if (codigoSeccion) {
      query += ' AND m.CodigoSeccion = @CodigoSeccion';
      request.input('CodigoSeccion', sql.VarChar, codigoSeccion);
    }
    if (codigoProyecto) {
      query += ' AND m.CodigoProyecto = @CodigoProyecto';
      request.input('CodigoProyecto', sql.VarChar, codigoProyecto);
    }

    query += ' ORDER BY m.Ejercicio DESC, m.Asiento DESC, m.FechaGrabacion DESC';

    const result = await request.query(query);

    const asientosAgrupados = {};
    result.recordset.forEach(m => {
      const key = `${m.Ejercicio}-${m.Asiento}`;
      if (!asientosAgrupados[key]) {
        asientosAgrupados[key] = {
          ejercicio: m.Ejercicio, asiento: m.Asiento, fechaAsiento: m.FechaAsiento,
          comentario: m.Comentario, codigoCanal: m.CodigoCanal, fechaGrabacion: m.FechaGrabacion,
          movimientos: [], totalDebe: 0, totalHaber: 0
        };
      }
      asientosAgrupados[key].movimientos.push({
        codigoCuenta: m.CodigoCuenta, cargoAbono: m.CargoAbono,
        importeAsiento: parseFloat(m.ImporteAsiento),
        codigoDepartamento: m.CodigoDepartamento, codigoSeccion: m.CodigoSeccion,
        codigoProyecto: m.CodigoProyecto, idDelegacion: m.IdDelegacion
      });
      if (m.CargoAbono === 'D') asientosAgrupados[key].totalDebe += parseFloat(m.ImporteAsiento);
      else asientosAgrupados[key].totalHaber += parseFloat(m.ImporteAsiento);
    });

    const asientos = Object.values(asientosAgrupados);
    let totalDebe = 0, totalHaber = 0;
    asientos.forEach(a => { totalDebe += a.totalDebe; totalHaber += a.totalHaber; });

    res.json({
      success: true,
      asientos,
      totalRegistros: asientos.length,
      estadisticasResultados: { totalDebe, totalHaber, diferencia: Math.abs(totalDebe - totalHaber) }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Error buscando asientos: ' + err.message });
  }
});

// Efectos de cartera
router.get('/api/efectos/:codigoProveedor?', requireAuth, async (req, res) => {
  try {
    const { codigoProveedor } = req.params;
    const ejercicioParam = req.query.ejercicio;
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam, 10) : new Date().getFullYear();

    let query = `
      SELECT ce.MovCartera, ce.MovPosicion, ce.NumeroEfecto, ce.CodigoClienteProveedor,
             ce.CodigoCuenta, ce.FechaEmision, ce.FechaVencimiento, ce.ImporteEfecto,
             ce.SuFacturaNo, ce.Comentario, ce.StatusBorrado, ce.StatusContabilizado,
             p.RazonSocial as NombreProveedor
      FROM CarteraEfectos ce
      LEFT JOIN Proveedores p ON ce.CodigoClienteProveedor = p.CodigoProveedor
      WHERE ce.codigoempresa = 1 AND ce.Ejercicio = @Ejercicio AND ce.StatusBorrado = 0
    `;

    const request = getPool().request().input('Ejercicio', sql.Int, ejercicio);
    if (codigoProveedor) {
      query += ' AND ce.CodigoClienteProveedor = @CodigoProveedor';
      request.input('CodigoProveedor', sql.VarChar, codigoProveedor);
    }
    query += ' ORDER BY ce.FechaVencimiento ASC';

    const result = await request.query(query);
    res.json({ success: true, ejercicio, totalEfectos: result.recordset.length, efectos: result.recordset });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Error obteniendo efectos: ' + err.message });
  }
});

module.exports = router;
