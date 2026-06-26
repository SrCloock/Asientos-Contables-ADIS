'use strict';

const sql = require('mssql');

const round2 = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
};

const formatDateWithoutTimezone = (dateString) => {
  if (!dateString) return null;
  try {
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
};

const obtenerEjercicioDesdeFecha = (dateString) => {
  if (!dateString) return new Date().getFullYear();
  try {
    return new Date(dateString).getFullYear();
  } catch {
    return new Date().getFullYear();
  }
};

// Incrementa el contador de asientos y devuelve el número a usar.
// sp_getapplock garantiza serialización absoluta incluso con múltiples
// conexiones concurrentes al mismo servidor SQL.
const obtenerContador = async (transaction, ejercicio) => {
  await transaction.request().query(`
    EXEC sp_getapplock
      @Resource    = N'ContadorAsientos',
      @LockMode    = N'Exclusive',
      @LockTimeout = 5000,
      @LockOwner   = N'Transaction'
  `);

  const result = await transaction.request()
    .input('ejercicio', sql.Int, ejercicio)
    .query(`
      UPDATE LsysContadores
      SET sysContadorValor = sysContadorValor + 1
      OUTPUT DELETED.sysContadorValor AS ValorAnterior
      WHERE sysAplicacion = 'CON'
        AND sysGrupo = '1'
        AND sysEjercicio = @ejercicio
        AND sysNombreContador = 'ASIENTOS'
    `);
  if (result.recordset.length === 0) {
    throw new Error('Contador de asientos no encontrado para el ejercicio ' + ejercicio);
  }
  return result.recordset[0].ValorAnterior;
};

// ctx = { transaction, ejercicio, siguienteAsiento, fechaAsientoStr, fechaVencimientoStr,
//         serie, numDocumento, codigoCanal, codigoDepartamento, codigoSeccion, codigoProyecto,
//         idDelegacion, fechaGrabacion, comentarioPorDefecto }
// params = { movPosicion, cargoAbono, codigoCuenta, importe, esVencimiento?, comentario?, contrapartida? }
const insertarMovimiento = async (ctx, params, movimientosAnalitica) => {
  const {
    transaction, ejercicio, siguienteAsiento, fechaAsientoStr, fechaVencimientoStr,
    serie, numDocumento, codigoCanal, codigoDepartamento, codigoSeccion,
    codigoProyecto, idDelegacion, fechaGrabacion, comentarioPorDefecto
  } = ctx;

  const {
    movPosicion,
    cargoAbono,
    codigoCuenta,
    importe,
    esVencimiento = false,
    comentario = comentarioPorDefecto,
    contrapartida = ''
  } = params;

  const importeRedondeado = round2(importe);

  await transaction.request()
    .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
    .input('Ejercicio', sql.SmallInt, ejercicio)
    .input('CodigoEmpresa', sql.SmallInt, 1)
    .input('TipoMov', sql.TinyInt, 0)
    .input('Asiento', sql.Int, siguienteAsiento)
    .input('CargoAbono', sql.VarChar(1), cargoAbono)
    .input('CodigoCuenta', sql.VarChar(15), codigoCuenta)
    .input('Contrapartida', sql.VarChar(15), contrapartida)
    .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
    .input('TipoDocumento', sql.VarChar(6), serie || '')
    .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
    .input('Comentario', sql.VarChar(40), comentario)
    .input('ImporteAsiento', sql.Decimal(18, 2), importeRedondeado)
    .input('StatusAcumulacion', sql.Int, -1)
    .input('CodigoDiario', sql.TinyInt, 0)
    .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
    .input('CodigoActividad', sql.VarChar(1), '')
    .input('Previsiones', sql.VarChar(1), esVencimiento ? 'P' : '')
    .input('FechaVencimiento', sql.VarChar, esVencimiento ? fechaVencimientoStr : null)
    .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
    .input('StatusConciliacion', sql.TinyInt, 0)
    .input('StatusSaldo', sql.TinyInt, 0)
    .input('StatusTraspaso', sql.TinyInt, 0)
    .input('CodigoUsuario', sql.TinyInt, 1)
    .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
    .input('TipoEntrada', sql.VarChar(2), 'EX')
    .input('TipoPlanCuenta', sql.SmallInt, 2008)
    .input('StatusImpagado', sql.TinyInt, 0)
    .input('Disenyo', sql.TinyInt, 0)
    .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
    .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
    .input('CodigoDivisa', sql.VarChar(3), '')
    .input('ImporteCambio', sql.Decimal(18, 2), 0)
    .input('ImporteDivisa', sql.Decimal(18, 2), 0)
    .input('FactorCambio', sql.Decimal(18, 6), 0)
    .input('CodigoConcepto', sql.Int, 0)
    .input('CodigoConciliacion', sql.Int, 0)
    .input('FechaConciliacion', sql.VarChar, null)
    .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
    .input('StatusAnalitica', sql.SmallInt, -1)
    .input('LibreN1', sql.VarChar(10), '')
    .input('LibreN2', sql.VarChar(10), '')
    .input('LibreA1', sql.VarChar(10), '')
    .input('LibreA2', sql.VarChar(10), '')
    .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
    .query(`
      INSERT INTO Movimientos (
        MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta,
        Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento,
        StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento,
        NumeroPeriodo, StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion,
        TipoEntrada, TipoPlanCuenta, StatusImpagado, [Diseño], CodigoDepartamento, CodigoSeccion,
        CodigoDivisa, ImporteCambio, ImporteDivisa, FactorCambio, CodigoConcepto, CodigoConciliacion,
        FechaConciliacion, CodigoProyecto, StatusAnalitica, LibreN1, LibreN2, LibreA1, LibreA2, IdDelegacion
      ) VALUES (
        @MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
        @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento,
        @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones,
        CASE WHEN @FechaVencimiento IS NOT NULL THEN CONVERT(DATE, @FechaVencimiento) ELSE NULL END,
        @NumeroPeriodo, @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion,
        @TipoEntrada, @TipoPlanCuenta, @StatusImpagado, @Disenyo, @CodigoDepartamento, @CodigoSeccion,
        @CodigoDivisa, @ImporteCambio, @ImporteDivisa, @FactorCambio, @CodigoConcepto, @CodigoConciliacion,
        CASE WHEN @FechaConciliacion IS NOT NULL THEN CONVERT(DATE, @FechaConciliacion) ELSE NULL END,
        @CodigoProyecto, @StatusAnalitica, @LibreN1, @LibreN2, @LibreA1, @LibreA2, @IdDelegacion
      )
    `);

  if ((codigoCuenta.startsWith('6') || codigoCuenta.startsWith('7')) && movimientosAnalitica) {
    movimientosAnalitica.push({ movPosicion, cargoAbono, codigoCuenta, importe: importeRedondeado, comentario });
  }
};

const insertarAnalitica = async (ctx, movimientosAnalitica) => {
  if (!movimientosAnalitica || movimientosAnalitica.length === 0) return;

  const {
    transaction, ejercicio, serie, numDocumento, fechaAsientoStr, fechaGrabacion,
    codigoDepartamento, codigoSeccion, codigoProyecto, codigoCanal, idDelegacion
  } = ctx;

  const contadorAnaResult = await transaction.request()
    .input('ejercicio', sql.Int, ejercicio)
    .query(`
      UPDATE LsysContadores
      SET sysContadorValor = sysContadorValor + 1
      OUTPUT DELETED.sysContadorValor AS ValorAnterior
      WHERE sysAplicacion = 'ANA'
        AND sysGrupo = '1'
        AND sysEjercicio = @ejercicio
        AND sysNombreContador = 'ASIENTOANA'
    `);

  if (contadorAnaResult.recordset.length === 0) {
    throw new Error('Contador de asientos analíticos no encontrado');
  }
  const siguienteAsientoAna = contadorAnaResult.recordset[0].ValorAnterior + 1;

  for (const mov of movimientosAnalitica) {
    await transaction.request()
      .input('CabPosicion', sql.UniqueIdentifier, mov.movPosicion)
      .input('Asiento', sql.Int, siguienteAsientoAna)
      .input('CodigoEmpresa', sql.SmallInt, 1)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CargoAbono', sql.VarChar(1), mov.cargoAbono)
      .input('AnaCodigoCuenta', sql.VarChar(15), mov.codigoCuenta)
      .input('Comentario', sql.VarChar(40), mov.comentario)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .input('ImporteAsiento', sql.Decimal(18, 2), mov.importe)
      .input('EnEuros_', sql.SmallInt, -1)
      .input('StatusAcumulado', sql.SmallInt, -1)
      .input('StatusGenerado', sql.SmallInt, -1)
      .input('DesgloseAna', sql.SmallInt, -1)
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
      .input('CodigoCuenta', sql.VarChar(15), mov.codigoCuenta)
      .input('Serie', sql.VarChar(10), serie || '')
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .query(`
        INSERT INTO AnaMovimientos (
          CabPosicion, Asiento, CodigoEmpresa, Ejercicio, CargoAbono, AnaCodigoCuenta,
          Comentario, TipoDocumento, DocumentoConta, FechaAsiento, FechaGrabacion, ImporteAsiento,
          EnEuros_, StatusAcumulado, StatusGenerado, DesgloseAna, CodigoDepartamento, CodigoSeccion,
          CodigoProyecto, CodigoCanal, IdDelegacion, CodigoCuenta, Serie, NumeroPeriodo
        ) VALUES (
          @CabPosicion, @Asiento, @CodigoEmpresa, @Ejercicio, @CargoAbono, @AnaCodigoCuenta,
          @Comentario, @TipoDocumento, @DocumentoConta, CONVERT(DATE, @FechaAsiento), @FechaGrabacion, @ImporteAsiento,
          @EnEuros_, @StatusAcumulado, @StatusGenerado, @DesgloseAna, @CodigoDepartamento, @CodigoSeccion,
          @CodigoProyecto, @CodigoCanal, @IdDelegacion, @CodigoCuenta, @Serie, @NumeroPeriodo
        )
      `);
  }
};

const insertarDocumento = async (transaction, posiciones, archivo) => {
  if (!archivo || archivo.trim() === '') return;

  for (const pos of posiciones) {
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, pos)
      .input('PathUbicacion', sql.VarChar(500), archivo)
      .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
      .query(`
        INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
        VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
      `);
  }
};

const gestionarEfecto = async (transaction, data) => {
  const {
    movPosicion, ejercicio, codigoEmpresa, idDelegacion, fechaAsiento, fechaVencimiento,
    importe, comentario, codigoClienteProveedor, suFacturaNo, codigoCuenta, serieFactura,
    factura, esPago = false, codigoCanal, tipoDocumento, remesaHabitual,
    codigoBanco, codigoAgencia, dc, ccc, iban, codigoTipoEfecto, tipoEfecto
  } = data;

  if (!fechaVencimiento) return null;

  if (esPago) {
    const result = await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .query(`
        UPDATE CarteraEfectos
        SET ImportePendiente = 0
        WHERE MovPosicion = @MovPosicion AND Ejercicio = @Ejercicio
      `);
    return result.rowsAffected[0] > 0;
  }

  const existeResult = await transaction.request()
    .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
    .input('Ejercicio', sql.SmallInt, ejercicio)
    .query(`
      SELECT COUNT(*) as count FROM CarteraEfectos
      WHERE MovPosicion = @MovPosicion AND Ejercicio = @Ejercicio
    `);
  if (existeResult.recordset[0].count > 0) return true;

  await transaction.request()
    .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
    .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
    .input('Prevision', sql.VarChar(1), 'P')
    .input('Aceptado', sql.SmallInt, -1)
    .input('Ejercicio', sql.SmallInt, ejercicio)
    .input('Comentario', sql.VarChar(40), comentario || '')
    .input('CodigoClienteProveedor', sql.VarChar(15), codigoClienteProveedor)
    .input('CodigoCuenta', sql.VarChar(15), codigoCuenta)
    .input('Contrapartida', sql.VarChar(15), remesaHabitual || '')
    .input('FechaEmision', sql.VarChar, fechaAsiento)
    .input('FechaFactura', sql.VarChar, fechaAsiento)
    .input('FechaVencimiento', sql.VarChar, fechaVencimiento)
    .input('EnEuros_', sql.SmallInt, -1)
    .input('ImporteEfecto', sql.Decimal(18, 2), importe)
    .input('ImportePendiente', sql.Decimal(18, 2), importe)
    .input('SuFacturaNo', sql.VarChar(40), suFacturaNo || '')
    .input('CodigoEmpresa', sql.SmallInt, codigoEmpresa || 1)
    .input('SerieFactura', sql.VarChar(10), serieFactura || '')
    .input('Factura', sql.VarChar(9), factura || '')
    .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
    .input('TipoDocumento', sql.VarChar(10), tipoDocumento || '')
    .input('RemesaHabitual', sql.VarChar(15), remesaHabitual || '')
    .input('CodigoBanco', sql.VarChar(10), codigoBanco || '')
    .input('CodigoAgencia', sql.VarChar(10), codigoAgencia || '')
    .input('DC', sql.VarChar(2), dc || '')
    .input('CCC', sql.VarChar(20), ccc || '')
    .input('IBAN', sql.VarChar(34), iban || '')
    .input('CodigoTipoEfecto', sql.Int, codigoTipoEfecto || null)
    .input('TipoEfecto', sql.VarChar(50), tipoEfecto || '')
    .query(`
      INSERT INTO CarteraEfectos
      (IdDelegacion, MovPosicion, Prevision, Aceptado, Ejercicio, Comentario,
       CodigoClienteProveedor, CodigoCuenta, Contrapartida, FechaEmision, FechaFactura, FechaVencimiento, EnEuros_,
       ImporteEfecto, ImportePendiente, SuFacturaNo, CodigoEmpresa, SerieFactura, Factura,
       CodigoCanal, TipoDocumento, RemesaHabitual, CodigoBanco, CodigoAgencia, DC, CCC, IBAN,
       CodigoTipoEfecto, TipoEfecto)
      VALUES
      (@IdDelegacion, @MovPosicion, @Prevision, @Aceptado, @Ejercicio, @Comentario,
       @CodigoClienteProveedor, @CodigoCuenta, @Contrapartida, CONVERT(DATE, @FechaEmision), CONVERT(DATE, @FechaFactura), CONVERT(DATE, @FechaVencimiento), @EnEuros_,
       @ImporteEfecto, @ImportePendiente, @SuFacturaNo, @CodigoEmpresa, @SerieFactura, @Factura,
       @CodigoCanal, @TipoDocumento, @RemesaHabitual, @CodigoBanco, @CodigoAgencia, @DC, @CCC, @IBAN,
       @CodigoTipoEfecto, @TipoEfecto)
    `);

  return true;
};

module.exports = {
  round2,
  formatDateWithoutTimezone,
  obtenerEjercicioDesdeFecha,
  obtenerContador,
  insertarMovimiento,
  insertarAnalitica,
  insertarDocumento,
  gestionarEfecto
};
