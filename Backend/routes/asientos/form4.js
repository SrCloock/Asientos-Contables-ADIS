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
  insertarDocumento,
  gestionarEfecto
} = require('./helpers');

router.post('/api/asiento/factura-iva-no-deducible', requireAuth, async (req, res) => {
  let transaction;

  try {
    const user = req.session.user || {};
    const codigoCanal = user.codigoCanal || '';
    const codigoProyecto = user.codigoProyecto || '';
    const codigoSeccion = user.codigoSeccion || '';
    const codigoDepartamento = user.codigoDepartamento || '';
    const idDelegacion = user.idDelegacion || '';

    const {
      detalles, proveedor, serie, numDocumento, numFRA,
      fechaReg, fechaFactura, fechaOper, vencimiento,
      concepto, cuentaGasto, archivo
    } = req.body;

    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) throw new Error('No hay detalles de factura');
    if (!numDocumento) throw new Error('Número de documento requerido');
    if (!proveedor) throw new Error('Datos del proveedor requeridos');

    const ejercicio = obtenerEjercicioDesdeFecha(fechaReg);
    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaFacturaStr = formatDateWithoutTimezone(fechaFactura);
    const fechaOperStr = formatDateWithoutTimezone(fechaOper);
    const fechaVencimientoStr = vencimiento ? formatDateWithoutTimezone(vencimiento) : null;
    const fechaGrabacion = new Date();

    transaction = new sql.Transaction(getPool());
    await transaction.begin();

    const siguienteAsiento = await obtenerContador(transaction, ejercicio);

    const ctx = {
      transaction, ejercicio, siguienteAsiento,
      fechaAsientoStr, fechaVencimientoStr,
      serie, numDocumento,
      codigoCanal, codigoDepartamento, codigoSeccion, codigoProyecto, idDelegacion,
      fechaGrabacion, comentarioPorDefecto: (concepto || '').trim().substring(0, 40)
    };

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
    let cuentaRetencionForm4 = null;
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
        cuentaRetencionForm4 = cuentaAbono;
      }
    }

    const movimientosAnalitica = [];
    const movPosicionProveedor = uuidv4();

    // 1) Proveedor HABER
    await insertarMovimiento(ctx, {
      movPosicion: movPosicionProveedor,
      cargoAbono: 'H',
      codigoCuenta: cuentaProveedorReal,
      importe: totalFactura,
      esVencimiento: !!fechaVencimientoStr
    }, movimientosAnalitica);

    // Efecto si hay vencimiento
    if (fechaVencimientoStr) {
      let datosBancarios = { codigoBanco: '', codigoAgencia: '', dc: '', ccc: '', iban: '' };
      let remesaHabitual = '';
      let codigoTipoEfecto = 1;
      let tipoEfecto = 'EFECTO';

      if (!esNuevoProveedor && !esNuevoAcreedor) {
        const pr = await transaction.request()
          .input('cp', sql.VarChar, proveedor.codigoProveedor)
          .query('SELECT CodigoBanco, CodigoAgencia, DC, CCC, IBAN FROM Proveedores WHERE CodigoProveedor = @cp');
        if (pr.recordset.length > 0) {
          const row = pr.recordset[0];
          datosBancarios = { codigoBanco: row.CodigoBanco || '', codigoAgencia: row.CodigoAgencia || '', dc: row.DC || '', ccc: row.CCC || '', iban: row.IBAN || '' };
        }
        const cr = await transaction.request()
          .input('cp', sql.VarChar, proveedor.codigoProveedor)
          .query('SELECT RemesaHabitual, CodigoTipoEfecto FROM ClientesConta WHERE CodigoClienteProveedor = @cp AND codigoempresa = 1');
        if (cr.recordset.length > 0) {
          remesaHabitual = cr.recordset[0].RemesaHabitual || '';
          codigoTipoEfecto = cr.recordset[0].CodigoTipoEfecto || 1;
        }
        if (codigoTipoEfecto) {
          const te = await transaction.request()
            .input('cte', sql.Int, codigoTipoEfecto)
            .query('SELECT TipoEfecto FROM TipoEfectos_ WHERE CodigoTipoEfecto = @cte');
          if (te.recordset.length > 0) tipoEfecto = te.recordset[0].TipoEfecto || '';
        }
      }

      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedor, ejercicio, codigoEmpresa: 1, idDelegacion,
        fechaAsiento: fechaAsientoStr, fechaVencimiento: fechaVencimientoStr,
        importe: totalFactura, comentario: ctx.comentarioPorDefecto,
        codigoClienteProveedor: proveedor.codigoProveedor, factura: numDocumento,
        suFacturaNo: numFRA, codigoCuenta: cuentaProveedorReal,
        serieFactura: serie, esPago: false, codigoCanal, tipoDocumento: serie,
        remesaHabitual, ...datosBancarios, tipoEfecto, codigoTipoEfecto
      });
    }

    // 2) IVA DEBE
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      await insertarMovimiento(ctx, { movPosicion: movPosicionIVA, cargoAbono: 'D', codigoCuenta: cuentaGasto, importe: totalIVA }, movimientosAnalitica);
    }

    // 3) Gasto base DEBE
    const movPosicionGasto = uuidv4();
    await insertarMovimiento(ctx, { movPosicion: movPosicionGasto, cargoAbono: 'D', codigoCuenta: cuentaGasto, importe: totalBase }, movimientosAnalitica);

    // 4) Retención HABER
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      await insertarMovimiento(ctx, { movPosicion: movPosicionRetencion, cargoAbono: 'H', codigoCuenta: cuentaRetencionForm4, importe: totalRetencion }, movimientosAnalitica);
    }

    // MovimientosFacturas
    const codigoRetencionFinal = totalRetencion > 0 ? codigoRetencionPrincipal : 0;
    const porcentajeRetencionFinal = totalRetencion > 0 ? porcentajeRetencionPrincipal : 0;

    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
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
    if (totalIVA > 0 && movPosicionIVA) {
      for (const linea of lineasIVA) {
        if (linea.base > 0 && linea.tipoIVA > 0) {
          let codigoIva = Math.round(linea.tipoIVA);
          if (isNaN(codigoIva) || codigoIva < 0 || codigoIva > 100) codigoIva = 0;
          await transaction.request()
            .input('CodigoEmpresa', sql.SmallInt, 1)
            .input('Ejercicio', sql.SmallInt, ejercicio)
            .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
            .input('TipoMov', sql.TinyInt, 0)
            .input('Orden', sql.TinyInt, linea.orden)
            .input('Año', sql.SmallInt, ejercicio)
            .input('CodigoIva', sql.SmallInt, codigoIva)
            .input('IvaPosicion', sql.UniqueIdentifier, movPosicionIVA)
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
    const posiciones = new Set([movPosicionProveedor, movPosicionGasto]);
    if (movPosicionIVA) posiciones.add(movPosicionIVA);
    if (movPosicionRetencion) posiciones.add(movPosicionRetencion);
    movimientosAnalitica.forEach(m => posiciones.add(m.movPosicion));
    await insertarDocumento(transaction, posiciones, archivo);

    // Analítica
    await insertarAnalitica(ctx, movimientosAnalitica);

    await transaction.commit();

    res.json({
      success: true,
      asiento: siguienteAsiento,
      ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) creado correctamente.`,
      detalles: {
        base: totalBase, iva: totalIVA, retencion: totalRetencion, total: totalFactura,
        movimientosAnalitica: movimientosAnalitica.length,
        retencionInfo: { codigoRetencion: codigoRetencionFinal, porcentajeRetencion: porcentajeRetencionFinal }
      }
    });

  } catch (err) {
    if (transaction) try { await transaction.rollback(); } catch {}
    res.status(500).json({ success: false, error: 'Error creando asiento: ' + err.message });
  }
});

module.exports = router;
