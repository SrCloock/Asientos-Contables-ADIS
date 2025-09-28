
// ============================================
// ✅ 5. ENDPOINTS DE PROVEEDORES
// ============================================

// GET /api/proveedores - Obtener lista de proveedores
app.get('/api/proveedores', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        CodigoProveedor as codigo,
        CifDni as cif,
        RazonSocial as nombre,
        CodigoPostal as cp,
        Telefono as telefono,
        Email as email
      FROM Proveedores
      WHERE CodigoEmpresa = 9999
        AND Activo = 1
      ORDER BY RazonSocial
    `);

    console.log(`✅ Proveedores obtenidos: ${result.recordset.length} registros`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo proveedores:', err);
    res.status(500).json({ error: 'Error obteniendo proveedores' });
  }
});

// GET /api/proveedores/cuentas - Obtener cuentas contables de proveedores
app.get('/api/proveedores/cuentas', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        p.CodigoProveedor as codigo,
        p.RazonSocial as nombre,
        ISNULL(cc.CodigoCuenta, '400000000') as cuenta
      FROM Proveedores p
      LEFT JOIN ClientesConta cc ON p.CodigoProveedor = cc.CodigoClienteProveedor
      WHERE p.CodigoEmpresa = 9999
        AND p.Activo = 1
      ORDER BY p.RazonSocial
    `);

    console.log(`✅ Cuentas de proveedores obtenidas: ${result.recordset.length} registros`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas de proveedores:', err);
    res.status(500).json({ error: 'Error obteniendo cuentas' });
  }
});

// ============================================
// ✅ 6. ENDPOINTS DE CONTADORES
// ============================================

// GET /api/contador - Obtener siguiente número de asiento
app.get('/api/contador', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '9999' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Contador no encontrado' });
    }

    const contador = result.recordset[0].sysContadorValor;
    console.log(`✅ Contador obtenido: ${contador}`);
    res.json({ contador });
  } catch (err) {
    console.error('❌ Error obteniendo contador:', err);
    res.status(500).json({ error: 'Error obteniendo contador' });
  }
});

// ============================================
// ✅ 7. ENDPOINTS DE ASIENTOS CONTABLES - FACTURAS/GASTOS
// ============================================

// POST /api/asiento/factura - Crear asiento de factura/gasto
app.post('/api/asiento/factura', requireAuth, async (req, res) => {
  const transaction = new sql.Transaction(await getPool());
  
  try {
    await transaction.begin();
    console.log('🔨 Iniciando creación de asiento contable...');
    
    // 1. Obtener siguiente número de asiento
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '9999' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const fechaAsiento = new Date();
    const usuario = req.session.user?.username || 'Sistema';
    
    console.log(`📝 Asiento #${siguienteAsiento} - Usuario: ${usuario}`);
    
    // 2. Obtener y validar datos del formulario
    const { 
      detalles, 
      proveedor, 
      tipo, 
      serie, 
      numDocumento, 
      fechaFactura, 
      numFRA,
      pagoEfectivo 
    } = req.body;
    
    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      throw new Error('No hay detalles de factura');
    }
    
    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }

    if (!proveedor) {
      throw new Error('Datos del proveedor requeridos');
    }
    
    // 3. Calcular totales
    let totalBase = 0;
    let totalIVA = 0;
    let totalRetencion = 0;
    
    detalles.forEach((linea, index) => {
      const base = parseFloat(linea.base) || 0;
      const iva = parseFloat(linea.cuotaIVA) || 0;
      const retencion = parseFloat(linea.cuotaRetencion) || 0;
      
      if (base > 0) {
        totalBase += base;
        totalIVA += iva;
        totalRetencion += retencion;
      }
    });
    
    const totalFactura = totalBase + totalIVA - totalRetencion;
    const numFactura = numFRA || `${serie}-${numDocumento}`;
    
    console.log(`💰 Totales: Base=${totalBase}, IVA=${totalIVA}, Retención=${totalRetencion}, Total=${totalFactura}`);
    
    // 4. Determinar cuentas según los datos del formulario
    const cuentaProveedor = proveedor.cuentaProveedor || '400000000';
    const cuentaGasto = tipo === 'factura' ? '600000000' : '622000000';
    const cuentaCaja = '570000000';
    const cuentaContrapartida = pagoEfectivo ? cuentaCaja : cuentaProveedor;
    
    // 5. Insertar líneas del asiento en Movimientos
    const movPosiciones = {};
    
    // Línea 1: Proveedor/Caja (HABER) - Total factura
    const movPosicionProveedor = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar, 'H')
      .input('CodigoCuenta', sql.VarChar, cuentaContrapartida)
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('Comentario', sql.VarChar, `Factura ${numFactura} - ${proveedor.nombre || ''}`)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         FechaAsiento, Comentario, ImporteAsiento, StatusAcumulacion, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @FechaAsiento, @Comentario, @ImporteAsiento, @StatusAcumulacion, @FechaGrabacion)
      `);
    
    // Línea 2: IVA (DEBE) - Solo si hay IVA
    if (totalIVA > 0) {
      const movPosicionIVA = uuidv4();
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar, 'D')
        .input('CodigoCuenta', sql.VarChar, '472000000')
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('Comentario', sql.VarChar, `IVA Factura ${numFactura}`)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('FechaGrabacion', sql.DateTime, new Date())
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           FechaAsiento, Comentario, ImporteAsiento, StatusAcumulacion, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @FechaAsiento, @Comentario, @ImporteAsiento, @StatusAcumulacion, @FechaGrabacion)
        `);
      
      movPosiciones.iva = movPosicionIVA;
    }
    
    // Línea 3: Retención (HABER) - Solo si hay retención
    if (totalRetencion > 0) {
      const movPosicionRetencion = uuidv4();
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar, 'H')
        .input('CodigoCuenta', sql.VarChar, '475100000')
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('Comentario', sql.VarChar, `Retención Factura ${numFactura}`)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalRetencion)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('FechaGrabacion', sql.DateTime, new Date())
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           FechaAsiento, Comentario, ImporteAsiento, StatusAcumulacion, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @FechaAsiento, @Comentario, @ImporteAsiento, @StatusAcumulacion, @FechaGrabacion)
        `);
    }
    
    // Línea 4: Gasto/Compra (DEBE)
    const movPosicionGasto = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar, 'D')
      .input('CodigoCuenta', sql.VarChar, cuentaGasto)
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('Comentario', sql.VarChar, `${tipo === 'factura' ? 'Compra' : 'Gasto'} ${numFactura}`)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalBase)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         FechaAsiento, Comentario, ImporteAsiento, StatusAcumulacion, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @FechaAsiento, @Comentario, @ImporteAsiento, @StatusAcumulacion, @FechaGrabacion)
      `);
    
    // 6. Insertar en tablas relacionadas
    if (!pagoEfectivo) {
      const retencionPrincipal = detalles[0]?.retencion || '15';
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
        .input('TipoMov', sql.TinyInt, 0)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('Año', sql.SmallInt, 2025)
        .input('Factura', sql.VarChar, numDocumento)
        .input('SuFacturaNo', sql.VarChar, numFRA || '')
        .input('FechaFactura', sql.DateTime, fechaFactura || fechaAsiento)
        .input('Fecha347', sql.DateTime, fechaFactura || fechaAsiento)
        .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
        .input('TipoFactura', sql.VarChar, 'R')
        .input('CodigoCuentaFactura', sql.VarChar, cuentaProveedor)
        .input('CodigoRetencion', sql.VarChar, retencionPrincipal)
        .input('BaseRetencion', sql.Decimal(18, 2), totalBase)
        .input('PorcentajeRetencion', sql.Decimal(18, 2), parseFloat(retencionPrincipal))
        .input('ImporteRetencion', sql.Decimal(18, 2), totalRetencion)
        .input('EjercicioFactura', sql.SmallInt, 2025)
        .input('FechaOperacion', sql.DateTime, fechaFactura || fechaAsiento)
        .input('FechaLiquidacion', sql.DateTime, fechaFactura || fechaAsiento)
        .query(`
          INSERT INTO MovimientosFacturas 
          (MovPosicion, TipoMov, CodigoEmpresa, Ejercicio, Año, Factura, SuFacturaNo, 
           FechaFactura, Fecha347, ImporteFactura, TipoFactura, CodigoCuentaFactura, 
           CodigoRetencion, BaseRetencion, %Retencion, ImporteRetencion, EjercicioFactura, 
           FechaOperacion, FechaLiquidacion)
          VALUES 
          (@MovPosicion, @TipoMov, @CodigoEmpresa, @Ejercicio, @Año, @Factura, @SuFacturaNo,
           @FechaFactura, @Fecha347, @ImporteFactura, @TipoFactura, @CodigoCuentaFactura,
           @CodigoRetencion, @BaseRetencion, @PorcentajeRetencion, @ImporteRetencion, @EjercicioFactura,
           @FechaOperacion, @FechaLiquidacion)
        `);
    }
    
    if (totalIVA > 0 && movPosiciones.iva) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '21';
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('MovPosicion', sql.UniqueIdentifier, movPosiciones.iva)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Orden', sql.TinyInt, 1)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoIva', sql.VarChar, tipoIVAPrincipal)
        .input('BaseIva', sql.Decimal(18, 2), totalBase)
        .input('PorcentajeIva', sql.Decimal(18, 2), parseFloat(tipoIVAPrincipal))
        .input('CuotaIva', sql.Decimal(18, 2), totalIVA)
        .input('Deducible', sql.TinyInt, -1)
        .query(`
          INSERT INTO MovimientosIva 
          (CodigoEmpresa, Ejercicio, MovPosicion, TipoMov, Orden, Año, CodigoIva, 
           BaseIva, %Iva, CuotaIva, Deducible)
          VALUES 
          (@CodigoEmpresa, @Ejercicio, @MovPosicion, @TipoMov, @Orden, @Año, @CodigoIva,
           @BaseIva, @PorcentajeIva, @CuotaIva, @Deducible)
        `);
    }
    
    // 7. Actualizar contador
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '9999' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    await transaction.commit();
    
    console.log(`🎉 Asiento #${siguienteAsiento} creado exitosamente`);
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento #${siguienteAsiento} creado correctamente`,
      detalles: {
        lineas: 4,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura
      }
    });
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Error creando asiento:', err);
    res.status(500).json({ 
      error: 'Error creando asiento: ' + err.message
    });
  }
});

// ============================================
// ✅ 8. ENDPOINTS DE ASIENTOS CONTABLES - INGRESOS
// ============================================

// POST /api/asiento/ingreso - Crear asiento de ingreso
app.post('/api/asiento/ingreso', requireAuth, async (req, res) => {
  const transaction = new sql.Transaction(await getPool());
  
  try {
    await transaction.begin();
    
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '9999' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const fechaAsiento = new Date();
    
    const { tipoIngreso, cuentaSeleccionada, importe, concepto, serie, numDocumento } = req.body;
    
    if (!cuentaSeleccionada || !importe || !concepto) {
      throw new Error('Datos incompletos para el ingreso');
    }
    
    const numDocumentoCompleto = `${serie}-${numDocumento}`;
    const cuentaContrapartida = tipoIngreso === 'caja' ? '570000000' : '430000000';
    
    // Línea de ingreso (Haber)
    await transaction.request()
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar, 'H')
      .input('CodigoCuenta', sql.VarChar, cuentaSeleccionada)
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('Comentario', sql.VarChar, `Ingreso ${numDocumentoCompleto} - ${concepto}`)
      .input('ImporteAsiento', sql.Decimal(18, 2), importe)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .query(`
        INSERT INTO Movimientos 
        (Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         FechaAsiento, Comentario, ImporteAsiento, FechaGrabacion)
        VALUES 
        (@Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @FechaAsiento, @Comentario, @ImporteAsiento, @FechaGrabacion)
      `);
    
    // Línea de contrapartida (Débito)
    await transaction.request()
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar, 'D')
      .input('CodigoCuenta', sql.VarChar, cuentaContrapartida)
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('Comentario', sql.VarChar, `Contrapartida ingreso ${numDocumentoCompleto}`)
      .input('ImporteAsiento', sql.Decimal(18, 2), importe)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .query(`
        INSERT INTO Movimientos 
        (Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         FechaAsiento, Comentario, ImporteAsiento, FechaGrabacion)
        VALUES 
        (@Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @FechaAsiento, @Comentario, @ImporteAsiento, @FechaGrabacion)
      `);
    
    // Actualizar contador
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '9999' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    await transaction.commit();
    
    console.log(`✅ Asiento de ingreso #${siguienteAsiento} creado`);
    res.json({ success: true, asiento: siguienteAsiento });
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Error creando asiento de ingreso:', err);
    res.status(500).json({ error: 'Error creando asiento de ingreso: ' + err.message });
  }
});


// ============================================
// ✅ 10. INICIALIZACIÓN DEL SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
module.exports = app;