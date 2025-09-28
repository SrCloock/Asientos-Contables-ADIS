const express = require('express');
const session = require('express-session');
const cors = require('cors');
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

// Configuración de la base de datos
const dbConfig = {
  server: 'SVRALANDALUS',
  database: 'demos',
  user: 'Logic',
  password: 'Sage2024+',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    appName: 'GestorComprasWeb',
    connectTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  }
};

let pool;

// Conectar a la base de datos
const connectDB = async () => {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Conexión a Sage200 establecida');
  } catch (err) {
    console.error('❌ Fallo de conexión a Sage200:', err.message);
    process.exit(1);
  }
};

connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesión
app.use(session({
  secret: 'sage200-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Cambiar a true en producción con HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Middleware de autenticación
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
};

// ============================================
// ✅ ENDPOINTS DE AUTENTICACIÓN
// ============================================

// POST /login - Iniciar sesión
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, password)
      .query(`
        SELECT 
          CodigoCliente, 
          CifDni, 
          UsuarioLogicNet,
          RazonSocial,
          Domicilio,
          CodigoPostal,
          Municipio,
          Provincia,
          CodigoProvincia,
          CodigoNacion,
          Nacion,
          SiglaNacion,
          StatusAdministrador
        FROM CLIENTES 
        WHERE UsuarioLogicNet = @username 
        AND ContraseñaLogicNet = @password
        AND CodigoCategoriaCliente_ = 'EMP'
      `);

    if (result.recordset.length > 0) {
      const userData = result.recordset[0];
      const isAdmin = userData.StatusAdministrador === -1;
      
      // Guardar usuario en la sesión
      req.session.user = {
        codigoCliente: userData.CodigoCliente?.trim() || '',
        cifDni: userData.CifDni?.trim() || '',
        usuario: userData.UsuarioLogicNet,
        nombre: userData.RazonSocial,
        domicilio: userData.Domicilio || '',
        codigoPostal: userData.CodigoPostal || '',
        municipio: userData.Municipio || '',
        provincia: userData.Provincia || '',
        codigoProvincia: userData.CodigoProvincia || '',
        codigoNacion: userData.CodigoNacion || 'ES',
        nacion: userData.Nacion || '',
        siglaNacion: userData.SiglaNacion || 'ES',
        isAdmin: isAdmin
      };

      return res.status(200).json({ 
        success: true, 
        user: req.session.user
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas o no tiene permisos' 
      });
    }
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

// POST /logout - Cerrar sesión
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false });
    }
    res.clearCookie('connect.sid');
    return res.status(200).json({ success: true });
  });
});

// GET /api/session - Verificar sesión
app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ============================================
// ✅ ENDPOINTS DE PROVEEDORES - CORREGIDOS
// ============================================

// GET /api/proveedores - Obtener lista de proveedores
app.get('/api/proveedores', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        CodigoProveedor as codigo,
        CifDni as cif,
        RazonSocial as nombre,
        CodigoPostal as cp,
        Telefono as telefono,
        Email1 as email
      FROM Proveedores
      WHERE CodigoEmpresa = 9999
        AND BajaEmpresaLc = 0
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
    const result = await pool.request().query(`
      SELECT 
        p.CodigoProveedor as codigo,
        p.RazonSocial as nombre,
        ISNULL(cc.CodigoCuenta, '400000000') as cuenta
      FROM Proveedores p
      LEFT JOIN ClientesConta cc ON p.CodigoProveedor = cc.CodigoClienteProveedor
      WHERE p.CodigoEmpresa = 9999
        AND p.BajaEmpresaLc = 0
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
// ✅ ENDPOINTS DE CONTADORES
// ============================================

// GET /api/contador - Obtener siguiente número de asiento
app.get('/api/contador', requireAuth, async (req, res) => {
  try {
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
// ✅ ENDPOINTS DE ASIENTOS CONTABLES - FACTURAS/GASTOS
// ============================================

// POST /api/asiento/factura - Crear asiento de factura/gasto
app.post('/api/asiento/factura', requireAuth, async (req, res) => {
  let transaction;
  
  // Función helper para truncar texto
  const truncar = (texto, maxLongitud) => {
    if (!texto) return '';
    return texto.toString().substring(0, maxLongitud);
  };

  try {
    transaction = new sql.Transaction(pool);
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
    const usuario = req.session.user?.usuario || 'Sistema';
    
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
    
    // Línea 1: Proveedor/Caja (HABER) - Total factura - CORREGIDO
    const movPosicionProveedor = uuidv4();
    console.log('Insertando línea 1: Proveedor/Caja...');
    
    // Truncar campos según las longitudes máximas de Sage200
    const comentarioLinea1 = truncar(`S/Factura n. ${numFactura} - ${proveedor.nombre || ''}`, 50);
    const codigoCuentaLinea1 = truncar(cuentaContrapartida, 10);
    const contrapartidaLinea1 = truncar(cuentaContrapartida, 10);
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(10), codigoCuentaLinea1)
      .input('Contrapartida', sql.VarChar(10), contrapartidaLinea1)
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(1), '')
      .input('DocumentoConta', sql.VarChar(20), '')
      .input('Comentario', sql.VarChar(50), comentarioLinea1)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(3), '')
      .input('CodigoActividad', sql.VarChar(3), '')
      .input('Previsiones', sql.VarChar(1), 'P')
      .input('NumeroPeriodo', sql.TinyInt, new Date().getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // Línea 2: IVA (DEBE) - Solo si hay IVA - CORREGIDO
    if (totalIVA > 0) {
      const movPosicionIVA = uuidv4();
      console.log('Insertando línea 2: IVA...');
      
      const comentarioLinea2 = truncar(`S/Factura n. ${numFactura} - ${proveedor.nombre || ''}`, 50);
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(10), '472000000')
        .input('Contrapartida', sql.VarChar(10), codigoCuentaLinea1)
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('TipoDocumento', sql.VarChar(1), '')
        .input('DocumentoConta', sql.VarChar(20), '')
        .input('Comentario', sql.VarChar(50), comentarioLinea2)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(3), '')
        .input('CodigoActividad', sql.VarChar(3), '')
        .input('Previsiones', sql.VarChar(1), null)
        .input('NumeroPeriodo', sql.TinyInt, new Date().getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, new Date())
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);
      
      movPosiciones.iva = movPosicionIVA;
    }
    
    // Línea 3: Retención (HABER) - Solo si hay retención - CORREGIDO
    if (totalRetencion > 0) {
      const movPosicionRetencion = uuidv4();
      console.log('Insertando línea 3: Retención...');
      
      const comentarioLinea3 = truncar(`S/Factura n. ${numFactura} - ${proveedor.nombre || ''}`, 50);
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'H')
        .input('CodigoCuenta', sql.VarChar(10), '475100000')
        .input('Contrapartida', sql.VarChar(10), '')
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('TipoDocumento', sql.VarChar(1), '')
        .input('DocumentoConta', sql.VarChar(20), '')
        .input('Comentario', sql.VarChar(50), comentarioLinea3)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalRetencion)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(3), '')
        .input('CodigoActividad', sql.VarChar(3), '')
        .input('Previsiones', sql.VarChar(1), null)
        .input('NumeroPeriodo', sql.TinyInt, new Date().getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, new Date())
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);
    }
    
    // Línea 4: Gasto/Compra (DEBE) - CORREGIDO
    const movPosicionGasto = uuidv4();
    console.log('Insertando línea 4: Gasto/Compra...');
    
    const comentarioLinea4 = truncar(`S/Factura n. ${numFactura} - ${proveedor.nombre || ''}`, 50);
    const codigoCuentaGasto = truncar(cuentaGasto, 10);
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(10), codigoCuentaGasto)
      .input('Contrapartida', sql.VarChar(10), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(1), '')
      .input('DocumentoConta', sql.VarChar(20), '')
      .input('Comentario', sql.VarChar(50), comentarioLinea4)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalBase)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(3), '')
      .input('CodigoActividad', sql.VarChar(3), '')
      .input('Previsiones', sql.VarChar(1), null)
      .input('NumeroPeriodo', sql.TinyInt, new Date().getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // 6. Insertar en tablas relacionadas
    if (!pagoEfectivo) {
      const retencionPrincipal = detalles[0]?.retencion || '15';
      console.log('Insertando en MovimientosFacturas...');
      
      // Truncar campos para MovimientosFacturas
      const facturaTruncada = truncar(numDocumento, 20);
      const suFacturaNoTruncada = truncar(numFRA || '', 20);
      const codigoCuentaFacturaTruncada = truncar(cuentaProveedor, 10);
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
        .input('TipoMov', sql.TinyInt, 0)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoCanal', sql.VarChar(3), '')
        .input('IdDelegacion', sql.VarChar(10), '')
        .input('Serie', sql.VarChar(10), '')
        .input('Factura', sql.VarChar(20), facturaTruncada)
        .input('SuFacturaNo', sql.VarChar(20), suFacturaNoTruncada)
        .input('FechaFactura', sql.DateTime, fechaFactura || fechaAsiento)
        .input('Fecha347', sql.DateTime, fechaFactura || fechaAsiento)
        .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
        .input('TipoFactura', sql.VarChar(1), 'R')
        .input('CodigoCuentaFactura', sql.VarChar(10), codigoCuentaFacturaTruncada)
        .input('CifDni', sql.VarChar(20), '')
        .input('Nombre', sql.VarChar(50), '')
        .input('CodigoRetencion', sql.VarChar(10), totalRetencion > 0 ? retencionPrincipal : '0')
        .input('BaseRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? totalBase : 0)
        .input('PorcentajeRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? parseFloat(retencionPrincipal) : 0)
        .input('ImporteRetencion', sql.Decimal(18, 2), totalRetencion)
        .query(`
          INSERT INTO MovimientosFacturas 
          (MovPosicion, TipoMov, CodigoEmpresa, Ejercicio, Año, CodigoCanal, IdDelegacion, Serie, Factura, SuFacturaNo, 
           FechaFactura, Fecha347, ImporteFactura, TipoFactura, CodigoCuentaFactura, CifDni, Nombre, 
           CodigoRetencion, BaseRetencion, [%Retencion], ImporteRetencion)
          VALUES 
          (@MovPosicion, @TipoMov, @CodigoEmpresa, @Ejercicio, @Año, @CodigoCanal, @IdDelegacion, @Serie, @Factura, @SuFacturaNo,
           @FechaFactura, @Fecha347, @ImporteFactura, @TipoFactura, @CodigoCuentaFactura, @CifDni, @Nombre,
           @CodigoRetencion, @BaseRetencion, @PorcentajeRetencion, @ImporteRetencion)
        `);
    }
    
    if (totalIVA > 0 && movPosiciones.iva) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '21';
      console.log('Insertando en MovimientosIva...');
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Orden', sql.TinyInt, 1)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoIva', sql.VarChar(10), tipoIVAPrincipal)
        .input('IvaPosicion', sql.UniqueIdentifier, movPosiciones.iva)
        .input('RecPosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
        .input('BasePosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
        .input('BaseIva', sql.Decimal(18, 2), totalBase)
        .input('PorcentajeBaseCorrectora', sql.Decimal(18, 2), 0)
        .input('PorcentajeIva', sql.Decimal(18, 2), parseFloat(tipoIVAPrincipal))
        .input('CuotaIva', sql.Decimal(18, 2), totalIVA)
        .input('PorcentajeRecargoEquivalencia', sql.Decimal(18, 2), 0)
        .input('RecargoEquivalencia', sql.Decimal(18, 2), 0)
        .input('CodigoTransaccion', sql.TinyInt, 1)
        .input('Deducible', sql.SmallInt, -1)
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
    
    // 7. Actualizar contador
    console.log('Actualizando contador...');
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
    console.error('❌ Error detallado creando asiento:', err);
    
    // Manejo seguro del rollback
    if (transaction) {
      try {
        console.log('Intentando rollback...');
        await transaction.rollback();
        console.log('Rollback completado');
      } catch (rollbackErr) {
        console.error('❌ Error durante el rollback:', rollbackErr);
      }
    }
    
    let errorMessage = 'Error creando asiento: ' + err.message;
    
    // Mensajes más específicos según el tipo de error
    if (err.code === 'EREQUEST') {
      if (err.originalError && err.originalError.info) {
        errorMessage += `\nDetalles SQL: ${err.originalError.info.message}`;
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      detalles: err.details || null
    });
  }
});

// ============================================
// ✅ ENDPOINTS DE ASIENTOS CONTABLES - INGRESOS
// ============================================

// POST /api/asiento/ingreso - Crear asiento de ingreso
app.post('/api/asiento/ingreso', requireAuth, async (req, res) => {
  const transaction = new sql.Transaction(pool);
  
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
// ✅ INICIALIZACIÓN DEL SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});

module.exports = app;