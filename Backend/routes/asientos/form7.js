'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getPool, sql } = require('../../db');
const { requireAuth } = require('../../middleware/auth');
const {
  round2,
  formatDateWithoutTimezone,
  obtenerEjercicioDesdeFecha,
  obtenerContador,
  insertarMovimiento,
  insertarAnalitica,
  insertarDocumento
} = require('./helpers');

router.post('/api/asiento/gasto-directo-caja', requireAuth, async (req, res) => {
  let transaction;

  try {
    const user = req.session.user || {};
    const { codigoCanal = '', codigoProyecto = '', codigoSeccion = '', codigoDepartamento = '', idDelegacion = '', cuentaCaja = '' } = user;

    const {
      serie, numDocumento, fechaReg, concepto, comentario,
      cuentaGasto, cuentaCaja: cuentaCajaBody, importe, archivo
    } = req.body;

    if (!numDocumento) throw new Error('Número de documento requerido');
    if (!cuentaGasto) throw new Error('Cuenta de gasto requerida');
    if (!importe || parseFloat(importe) <= 0) throw new Error('Importe válido requerido');

    const ejercicio = obtenerEjercicioDesdeFecha(fechaReg);
    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaGrabacion = new Date();
    const importeDecimal = round2(parseFloat(importe));
    const cuentaCajaUsar = cuentaCajaBody || cuentaCaja;
    const comentarioCorto = (comentario || concepto || '').trim().substring(0, 40);

    transaction = new sql.Transaction(getPool());
    await transaction.begin();

    const siguienteAsiento = await obtenerContador(transaction, ejercicio);

    const ctx = {
      transaction, ejercicio, siguienteAsiento,
      fechaAsientoStr, fechaVencimientoStr: null,
      serie, numDocumento,
      codigoCanal, codigoDepartamento, codigoSeccion, codigoProyecto, idDelegacion,
      fechaGrabacion, comentarioPorDefecto: comentarioCorto
    };

    const movimientosAnalitica = [];

    // Línea 1: Gasto DEBE (analizable si cuenta 6 o 7)
    const movPosicionGasto = uuidv4();
    await insertarMovimiento(ctx, {
      movPosicion: movPosicionGasto,
      cargoAbono: 'D',
      codigoCuenta: cuentaGasto,
      importe: importeDecimal,
      contrapartida: cuentaCajaUsar
    }, movimientosAnalitica);

    // Línea 2: Caja HABER
    const movPosicionCaja = uuidv4();
    await insertarMovimiento(ctx, {
      movPosicion: movPosicionCaja,
      cargoAbono: 'H',
      codigoCuenta: cuentaCajaUsar,
      importe: importeDecimal,
      contrapartida: cuentaGasto
    }, movimientosAnalitica);

    // Documento asociado
    const posiciones = new Set([movPosicionGasto, movPosicionCaja]);
    movimientosAnalitica.forEach(m => posiciones.add(m.movPosicion));
    await insertarDocumento(transaction, posiciones, archivo);

    // Analítica
    await insertarAnalitica(ctx, movimientosAnalitica);

    await transaction.commit();

    res.json({
      success: true,
      asiento: siguienteAsiento,
      ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Gasto Directo en Caja creado correctamente.`,
      detalles: {
        lineas: 2, debe: importeDecimal, haber: importeDecimal,
        movimientosAnalitica: movimientosAnalitica.length
      }
    });

  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch {}
    res.status(500).json({ success: false, error: 'Error creando asiento: ' + err.message });
  }
});

module.exports = router;
