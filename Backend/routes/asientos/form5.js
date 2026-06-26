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

router.post('/api/asiento/pago-proveedor', requireAuth, async (req, res) => {
  let transaction;

  try {
    const user = req.session.user || {};
    const { codigoCanal = '', codigoProyecto = '', codigoSeccion = '', codigoDepartamento = '', idDelegacion = '', cuentaCaja = '' } = user;

    const {
      detalles, proveedor, serie, numDocumento, numFRA,
      fechaReg, fechaFactura, fechaOper, concepto, cuentaGasto, archivo
    } = req.body;

    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) throw new Error('No hay detalles de factura');
    if (!numDocumento) throw new Error('Número de documento requerido');
    if (!proveedor) throw new Error('Datos del proveedor requeridos');

    const ejercicio = obtenerEjercicioDesdeFecha(fechaReg);
    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaFacturaStr = formatDateWithoutTimezone(fechaFactura);
    const fechaOperStr = formatDateWithoutTimezone(fechaOper);
    const fechaGrabacion = new Date();

    transaction = new sql.Transaction(getPool());
    await transaction.begin();

    const siguienteAsiento = await obtenerContador(transaction, ejercicio);

    const comentarioFactura = (concepto || '').trim().substring(0, 40);
    const comentarioPago = `PAGO ${concepto || ''}`.trim().substring(0, 40);

    const ctxFactura = {
      transaction, ejercicio, siguienteAsiento,
      fechaAsientoStr, fechaVencimientoStr: null,
      serie, numDocumento,
      codigoCanal, codigoDepartamento, codigoSeccion, codigoProyecto, idDelegacion,
      fechaGrabacion, comentarioPorDefecto: comentarioFactura
    };

    const ctxPago = { ...ctxFactura, comentarioPorDefecto: comentarioPago };

    const codigoProveedor = proveedor.codigoProveedor || '';
    const esNuevo = !codigoProveedor || codigoProveedor === '4000' || codigoProveedor === '4100';

    let cuentaProveedorReal;
    if (esNuevo) {
      cuentaProveedorReal = proveedor.cuentaProveedor;
      if (!cuentaProveedorReal) throw new Error('Cuenta contable requerida para proveedor/acreedor nuevo');
    } else {
      const r = await transaction.request()
        .input('cp', sql.VarChar, codigoProveedor)
        .query('SELECT CodigoCuenta FROM ClientesConta WHERE CodigoClienteProveedor = @cp AND codigoempresa = 1');
      cuentaProveedorReal = r.recordset.length > 0 ? r.recordset[0].CodigoCuenta : proveedor.cuentaProveedor;
      if (!cuentaProveedorReal) throw new Error(`Cuenta contable no configurada para proveedor ${codigoProveedor}`);
    }

    let totalBase = 0, totalIVA = 0, totalRetencion = 0, totalFactura = 0;
    let lineasIVA = [];
    let cuentaRetencion = null;
    let codigoRetencionPrincipal = 0, porcentajeRetencionPrincipal = 0;

    for (let idx = 0; idx < detalles.length; idx++) {
      const linea = detalles[idx];
      const base = parseFloat(linea.base);
      if (isNaN(base) || base <= 0) continue;

      const tipoIVA = parseFloat(linea.tipoIVA) || 0;
      const retencion = parseFloat(linea.retencion) || 0;
      const codRet = parseInt(linea.codigoRetencion);
      const cuentaAbono = linea.cuentaAbonoRetencion || '';
      const ivaOverrideRaw = linea.ivaOverride !== undefined && linea.ivaOverride !== null ? parseFloat(linea.ivaOverride) : null;

      const cuotaIVA = (ivaOverrideRaw !== null && !isNaN(ivaOverrideRaw))
        ? round2(ivaOverrideRaw)
        : round2((base * tipoIVA) / 100);
      const cuotaRetencion = round2((base * retencion) / 100);

      totalBase = round2(totalBase + base);
      totalIVA = round2(totalIVA + cuotaIVA);
      totalRetencion = round2(totalRetencion + cuotaRetencion);
      totalFactura = round2(totalFactura + round2(base + cuotaIVA - cuotaRetencion));

      lineasIVA.push({ orden: idx + 1, base, tipoIVA, iva: cuotaIVA, retencion });

      if (retencion > 0 && !isNaN(codRet) && codRet > 0 && codigoRetencionPrincipal === 0) {
        codigoRetencionPrincipal = codRet;
        porcentajeRetencionPrincipal = retencion;
        if (!cuentaAbono) throw new Error(`Cuenta de abono de retención no configurada en línea ${idx + 1}`);
        cuentaRetencion = cuentaAbono;
      }
    }

    if (lineasIVA.length === 0) throw new Error('No hay líneas válidas con base mayor a cero');

    const movimientosAnalitica = [];

    // === PARTE 1: ASIENTO FACTURA ===
    const movPosicionProveedorHaber = uuidv4();
    await insertarMovimiento(ctxFactura, {
      movPosicion: movPosicionProveedorHaber,
      cargoAbono: 'H',
      codigoCuenta: cuentaProveedorReal,
      importe: totalFactura,
      contrapartida: cuentaCaja
    }, movimientosAnalitica);

    const movPosicionGastoBase = uuidv4();
    await insertarMovimiento(ctxFactura, {
      movPosicion: movPosicionGastoBase,
      cargoAbono: 'D',
      codigoCuenta: cuentaGasto,
      importe: totalBase
    }, movimientosAnalitica);

    let movPosicionGastoIVA = null;
    if (totalIVA > 0) {
      movPosicionGastoIVA = uuidv4();
      await insertarMovimiento(ctxFactura, {
        movPosicion: movPosicionGastoIVA,
        cargoAbono: 'D',
        codigoCuenta: cuentaGasto,
        importe: totalIVA
      }, movimientosAnalitica);
    }

    // === PARTE 2: ASIENTO PAGO ===
    const movPosicionCaja = uuidv4();
    await insertarMovimiento(ctxPago, {
      movPosicion: movPosicionCaja,
      cargoAbono: 'H',
      codigoCuenta: cuentaCaja,
      importe: totalFactura,
      contrapartida: cuentaProveedorReal
    }, movimientosAnalitica);

    const movPosicionProveedorDebe = uuidv4();
    await insertarMovimiento(ctxPago, {
      movPosicion: movPosicionProveedorDebe,
      cargoAbono: 'D',
      codigoCuenta: cuentaProveedorReal,
      importe: totalFactura,
      contrapartida: cuentaCaja
    }, movimientosAnalitica);

    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      if (!cuentaRetencion) throw new Error('Cuenta de abono de retención no configurada');
      movPosicionRetencion = uuidv4();
      await insertarMovimiento(ctxPago, {
        movPosicion: movPosicionRetencion,
        cargoAbono: 'H',
        codigoCuenta: cuentaRetencion,
        importe: totalRetencion
      }, movimientosAnalitica);
    }

    // MovimientosFacturas
    const codigoRetencionFinal = totalRetencion > 0 ? codigoRetencionPrincipal : 0;
    const porcentajeRetencionFinal = totalRetencion > 0 ? porcentajeRetencionPrincipal : 0;

    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
      .input('TipoMov', sql.TinyInt, 0)
      .input('CodigoEmpresa', sql.SmallInt, 1)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('Año', sql.SmallInt, ejercicio)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal)
      .input('IdDelegacion', sql.VarChar(10), idDelegacion)
      .input('Serie', sql.VarChar(10), serie || '')
      .input('Factura', sql.VarChar(9), numDocumento || '')
      .input('SuFacturaNo', sql.VarChar(40), (numFRA || '').substring(0, 40))
      .input('FechaFactura', sql.VarChar, fechaFacturaStr)
      .input('Fecha347', sql.VarChar, fechaFacturaStr)
      .input('FechaOperacion', sql.VarChar, fechaOperStr)
      .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
      .input('TipoFactura', sql.VarChar(1), 'R')
      .input('CodigoCuentaFactura', sql.VarChar(15), cuentaProveedorReal)
      .input('CifDni', sql.VarChar(13), (proveedor.cif || '').substring(0, 13))
      .input('Nombre', sql.VarChar(35), (proveedor.nombre || '').substring(0, 35))
      .input('CodigoRetencion', sql.SmallInt, codigoRetencionFinal)
      .input('BaseRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? totalBase : 0)
      .input('PorcentajeRetencion', sql.Decimal(18, 2), porcentajeRetencionFinal)
      .input('ImporteRetencion', sql.Decimal(18, 2), totalRetencion)
      .query(`
        INSERT INTO MovimientosFacturas
        (MovPosicion, TipoMov, CodigoEmpresa, Ejercicio, Año, CodigoCanal, IdDelegacion, Serie, Factura, SuFacturaNo,
         FechaFactura, Fecha347, FechaOperacion, ImporteFactura, TipoFactura, CodigoCuentaFactura, CifDni, Nombre,
         CodigoRetencion, BaseRetencion, [%Retencion], ImporteRetencion)
        VALUES
        (@MovPosicion, @TipoMov, @CodigoEmpresa, @Ejercicio, @Año, @CodigoCanal, @IdDelegacion, @Serie, @Factura, @SuFacturaNo,
         CONVERT(DATE, @FechaFactura), CONVERT(DATE, @Fecha347), CONVERT(DATE, @FechaOperacion), @ImporteFactura, @TipoFactura, @CodigoCuentaFactura, @CifDni, @Nombre,
         @CodigoRetencion, @BaseRetencion, @PorcentajeRetencion, @ImporteRetencion)
      `);

    // MovimientosIVA
    if (totalIVA > 0 && movPosicionGastoIVA) {
      for (const linea of lineasIVA) {
        if (linea.base > 0 && linea.tipoIVA > 0) {
          let codigoIva = Math.round(linea.tipoIVA);
          if (isNaN(codigoIva) || codigoIva < 0 || codigoIva > 100) codigoIva = 0;
          await transaction.request()
            .input('CodigoEmpresa', sql.SmallInt, 1)
            .input('Ejercicio', sql.SmallInt, ejercicio)
            .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
            .input('TipoMov', sql.TinyInt, 0)
            .input('Orden', sql.TinyInt, linea.orden)
            .input('Año', sql.SmallInt, ejercicio)
            .input('CodigoIva', sql.SmallInt, codigoIva)
            .input('IvaPosicion', sql.UniqueIdentifier, movPosicionGastoIVA)
            .input('RecPosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
            .input('BasePosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
            .input('BaseIva', sql.Decimal(18, 2), round2(linea.base))
            .input('PorcentajeBaseCorrectora', sql.Decimal(18, 2), 0)
            .input('PorcentajeIva', sql.Decimal(18, 2), linea.tipoIVA)
            .input('CuotaIva', sql.Decimal(18, 2), round2(linea.iva))
            .input('PorcentajeRecargoEquivalencia', sql.Decimal(18, 2), 0)
            .input('RecargoEquivalencia', sql.Decimal(18, 2), 0)
            .input('CodigoTransaccion', sql.TinyInt, 1)
            .input('Deducible', sql.SmallInt, 0)
            .input('BaseUtilizada', sql.Decimal(18, 2), totalFactura)
            .query(`
              INSERT INTO MovimientosIva
              (CodigoEmpresa, Ejercicio, MovPosicion, TipoMov, Orden, Año, CodigoIva,
               IvaPosicion, RecPosicion, BasePosicion, BaseIva, [%BaseCorrectora], [%Iva], CuotaIva,
               [%RecargoEquivalencia], RecargoEquivalencia, CodigoTransaccion, Deducible, BaseUtilizada)
              VALUES
              (@CodigoEmpresa, @Ejercicio, @MovPosicion, @TipoMov, @Orden, @Año, @CodigoIva,
               @IvaPosicion, @RecPosicion, @BasePosicion, @BaseIva, @PorcentajeBaseCorrectora, @PorcentajeIva, @CuotaIva,
               @PorcentajeRecargoEquivalencia, @RecargoEquivalencia, @CodigoTransaccion, @Deducible, @BaseUtilizada)
            `);
        }
      }
    }

    // Documento asociado
    const posiciones = new Set([movPosicionProveedorHaber, movPosicionGastoBase, movPosicionCaja, movPosicionProveedorDebe]);
    if (movPosicionGastoIVA) posiciones.add(movPosicionGastoIVA);
    if (movPosicionRetencion) posiciones.add(movPosicionRetencion);
    movimientosAnalitica.forEach(m => posiciones.add(m.movPosicion));
    await insertarDocumento(transaction, posiciones, archivo);

    // Analítica
    await insertarAnalitica(ctxFactura, movimientosAnalitica);

    await transaction.commit();

    res.json({
      success: true,
      asiento: siguienteAsiento,
      ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Pago Proveedor creado correctamente.`,
      detalles: {
        base: totalBase, iva: totalIVA, retencion: totalRetencion, total: totalFactura,
        movimientosAnalitica: movimientosAnalitica.length,
        retencionInfo: { codigoRetencion: codigoRetencionFinal, porcentajeRetencion: porcentajeRetencionFinal }
      }
    });

  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch {}
    res.status(500).json({ success: false, error: 'Error creando asiento de pago: ' + err.message });
  }
});

module.exports = router;
