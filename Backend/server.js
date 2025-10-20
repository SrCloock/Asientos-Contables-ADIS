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
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
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

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false });
    }
    res.clearCookie('connect.sid');
    return res.status(200).json({ success: true });
  });
});

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
// ✅ ENDPOINTS DE PROVEEDORES
// ============================================

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

app.post('/api/asiento/factura', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    console.log('🔨 Iniciando creación de asiento contable...');
    
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
    
    const { 
      detalles, 
      proveedor, 
      tipo, 
      serie, 
      numDocumento, 
      fechaFactura, 
      numFRA,
      pagoEfectivo,
      vencimiento
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
    
    let cuentaContableReal = '400000000';
    try {
      const cuentaContableResult = await transaction.request()
        .input('codigoProveedor', sql.VarChar, proveedor.cuentaProveedor)
        .query(`
          SELECT CodigoCuenta 
          FROM ClientesConta 
          WHERE CodigoClienteProveedor = @codigoProveedor
            AND CodigoEmpresa = 9999
        `);
      
      if (cuentaContableResult.recordset.length > 0) {
        cuentaContableReal = cuentaContableResult.recordset[0].CodigoCuenta;
        console.log(`✅ Cuenta contable encontrada: ${cuentaContableReal} para proveedor ${proveedor.cuentaProveedor}`);
      } else {
        console.warn(`⚠️ No se encontró cuenta contable para proveedor ${proveedor.cuentaProveedor}, usando por defecto: ${cuentaContableReal}`);
      }
    } catch (error) {
      console.error('❌ Error buscando cuenta contable:', error);
    }
    
    let totalBase = 0;
    let totalIVA = 0;
    let totalRetencion = 0;
    
    detalles.forEach((linea) => {
      const base = parseFloat(linea.base) || 0;
      const iva = parseFloat(linea.cuotaIVA) || 0;
      const retencion = parseFloat(linea.cuotaRetencion) || 0;
      
      if (base > 0) {
        totalBase += base;
        totalIVA += iva;
        totalRetencion += retencion;
      }
    });
    
    const totalFactura = totalBase + totalIVA;
    const numFactura = numDocumento;
    
    console.log(`💰 Totales: Base=${totalBase}, IVA=${totalIVA}, Retención=${totalRetencion}, Total=${totalFactura}`);
    
    const cuentaProveedor = cuentaContableReal;
    const cuentaGasto = '621000000';
    const cuentaCaja = '570000000';
    const cuentaContrapartida = pagoEfectivo ? cuentaCaja : cuentaProveedor;
    
    let fechaVencimientoFormateada = null;
    if (vencimiento) {
      try {
        const fechaVenc = new Date(vencimiento);
        fechaVencimientoFormateada = new Date(fechaVenc.getFullYear(), fechaVenc.getMonth(), fechaVenc.getDate(), 0, 0, 0, 0);
        console.log(`📅 Fecha vencimiento formateada: ${fechaVencimientoFormateada}`);
      } catch (error) {
        console.error('❌ Error formateando fecha vencimiento:', error);
        fechaVencimientoFormateada = null;
      }
    }
    
    const comentarioCorto = `Factura n. ${numFactura}`.substring(0, 40);
    console.log(`📝 Comentario: ${comentarioCorto}`);
    
    // Línea 1: Proveedor (HABER)
    const movPosicionProveedor = uuidv4();
    console.log('Insertando línea 1: Proveedor...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaContrapartida)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), 'P')
      .input('FechaVencimiento', sql.DateTime, fechaVencimientoFormateada)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // Línea 2: IVA (DEBE)
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      console.log('Insertando línea 2: IVA...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), '472000000')
        .input('Contrapartida', sql.VarChar(15), cuentaContrapartida)
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), '')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), '')
        .input('FechaVencimiento', sql.DateTime, fechaVencimientoFormateada)
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
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);
    }
    
    // Línea 3: Gasto/Compra (DEBE)
    const movPosicionGasto = uuidv4();
    console.log('Insertando línea 3: Gasto/Compra...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalBase)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.DateTime, fechaVencimientoFormateada)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // Insertar en tablas relacionadas
    if (!pagoEfectivo) {
      const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
      console.log('Insertando en MovimientosFacturas...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
        .input('TipoMov', sql.TinyInt, 0)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoCanal', sql.VarChar(10), '')
        .input('IdDelegacion', sql.VarChar(10), '')
        .input('Serie', sql.VarChar(10), '')
        .input('Factura', sql.Int, parseInt(numDocumento) || 0)
        .input('SuFacturaNo', sql.VarChar(40), (numFRA || '').substring(0, 40))
        .input('FechaFactura', sql.DateTime, fechaFactura || fechaAsiento)
        .input('Fecha347', sql.DateTime, fechaFactura || fechaAsiento)
        .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
        .input('TipoFactura', sql.VarChar(1), 'R')
        .input('CodigoCuentaFactura', sql.VarChar(15), cuentaProveedor)
        .input('CifDni', sql.VarChar(13), (proveedor.cif || '').substring(0, 13))
        .input('Nombre', sql.VarChar(35), (proveedor.nombre || '').substring(0, 35))
        .input('CodigoRetencion', sql.SmallInt, totalRetencion > 0 ? parseInt(retencionPrincipal) : 0)
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
    
    if (totalIVA > 0 && movPosicionIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '21';
      console.log('Insertando en MovimientosIva...');
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Orden', sql.TinyInt, 1)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoIva', sql.SmallInt, parseInt(tipoIVAPrincipal))
        .input('IvaPosicion', sql.UniqueIdentifier, movPosicionIVA)
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
    
    // Actualizar contador
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
        lineas: 3,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura
      }
    });
  } catch (err) {
    console.error('❌ Error detallado creando asiento:', err);
    
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
// ✅ ENDPOINTS DE ASIENTOS CONTABLES - INGRESOS (FormPage2)
// ============================================

app.post('/api/asiento/ingreso', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    console.log('🔨 Iniciando creación de asiento de ingreso...');
    
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
    
    console.log(`📝 Asiento Ingreso #${siguienteAsiento} - Usuario: ${usuario}`);
    
    const { 
      tipoIngreso, 
      cuentaSeleccionada, 
      importe, 
      concepto, 
      serie, 
      numDocumento 
    } = req.body;
    
    if (!cuentaSeleccionada || !importe || !concepto || !numDocumento) {
      throw new Error('Datos incompletos para el ingreso');
    }
    
    const importeNum = parseFloat(importe);
    if (importeNum <= 0) {
      throw new Error('El importe debe ser mayor a 0');
    }
    
    const cuentaIngreso = cuentaSeleccionada;
    const cuentaContrapartida = tipoIngreso === 'caja' ? '570000000' : '430000000';
    
    const comentarioCorto = `Ingreso ${numDocumento} - ${concepto}`.substring(0, 40);
    console.log(`💰 Importe: ${importeNum}, Cuenta: ${cuentaIngreso}, Contrapartida: ${cuentaContrapartida}`);
    
    // Línea 1: Ingreso (HABER)
    const movPosicionIngreso = uuidv4();
    console.log('Insertando línea 1: Ingreso...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaIngreso)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.DateTime, null)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // Línea 2: Contrapartida (DEBE)
    const movPosicionContrapartida = uuidv4();
    console.log('Insertando línea 2: Contrapartida...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionContrapartida)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaContrapartida)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.DateTime, null)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // Insertar en MovimientosFacturas si es ingreso por cliente
    if (tipoIngreso === 'cliente') {
      console.log('Insertando en MovimientosFacturas para cliente...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionContrapartida)
        .input('TipoMov', sql.TinyInt, 0)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoCanal', sql.VarChar(10), '')
        .input('IdDelegacion', sql.VarChar(10), '')
        .input('Serie', sql.VarChar(10), serie || '')
        .input('Factura', sql.Int, parseInt(numDocumento) || 0)
        .input('SuFacturaNo', sql.VarChar(40), numDocumento)
        .input('FechaFactura', sql.DateTime, fechaAsiento)
        .input('Fecha347', sql.DateTime, fechaAsiento)
        .input('ImporteFactura', sql.Decimal(18, 2), importeNum)
        .input('TipoFactura', sql.VarChar(1), 'I')
        .input('CodigoCuentaFactura', sql.VarChar(15), cuentaContrapartida)
        .input('CifDni', sql.VarChar(13), '')
        .input('Nombre', sql.VarChar(35), 'INGRESO VARIOS')
        .input('CodigoRetencion', sql.SmallInt, 0)
        .input('BaseRetencion', sql.Decimal(18, 2), 0)
        .input('PorcentajeRetencion', sql.Decimal(18, 2), 0)
        .input('ImporteRetencion', sql.Decimal(18, 2), 0)
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
    
    // Actualizar contador
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
    console.log(`🎉 Asiento Ingreso #${siguienteAsiento} creado exitosamente`);
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento Ingreso #${siguienteAsiento} creado correctamente`,
      detalles: {
        lineas: 2,
        importe: importeNum,
        cuentaIngreso: cuentaIngreso,
        cuentaContrapartida: cuentaContrapartida
      }
    });
  } catch (err) {
    console.error('❌ Error detallado creando asiento de ingreso:', err);
    
    if (transaction) {
      try {
        console.log('Intentando rollback...');
        await transaction.rollback();
        console.log('Rollback completado');
      } catch (rollbackErr) {
        console.error('❌ Error durante el rollback:', rollbackErr);
      }
    }
    
    let errorMessage = 'Error creando asiento de ingreso: ' + err.message;
    
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
// ✅ ENDPOINTS DE ASIENTOS CONTABLES - ASIENTO DOBLE (FormPage3)
// ============================================

app.post('/api/asiento/doble', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    console.log('🔨 Iniciando creación de asiento doble...');
    
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
    
    console.log(`📝 Asiento Doble #${siguienteAsiento} - Usuario: ${usuario}`);
    
    const { 
      ingreso,
      factura,
      tipoIngreso
    } = req.body;
    
    if (!ingreso || !factura) {
      throw new Error('Datos de ingreso y factura requeridos');
    }
    
    if (!ingreso.cuentaSeleccionada || !ingreso.importe || !ingreso.concepto) {
      throw new Error('Datos de ingreso incompletos');
    }
    
    if (!factura.proveedor || !factura.detalles || !Array.isArray(factura.detalles) || factura.detalles.length === 0) {
      throw new Error('Datos de factura incompletos');
    }
    
    // Calcular totales de la factura
    let totalBase = 0;
    let totalIVA = 0;
    let totalRetencion = 0;
    
    factura.detalles.forEach((linea) => {
      const base = parseFloat(linea.base) || 0;
      const iva = parseFloat(linea.cuotaIVA) || 0;
      const retencion = parseFloat(linea.cuotaRetencion) || 0;
      
      if (base > 0) {
        totalBase += base;
        totalIVA += iva;
        totalRetencion += retencion;
      }
    });
    
    const totalFactura = totalBase + totalIVA;
    const importeIngreso = parseFloat(ingreso.importe);
    
    // Validar que los importes coincidan
    if (Math.abs(totalFactura - importeIngreso) > 0.01) {
      throw new Error(`Los importes no coinciden: Factura ${totalFactura.toFixed(2)} vs Ingreso ${importeIngreso.toFixed(2)}`);
    }
    
    // Buscar cuenta contable del proveedor
    let cuentaProveedor = '400000000';
    try {
      const cuentaContableResult = await transaction.request()
        .input('codigoProveedor', sql.VarChar, factura.proveedor.cuentaProveedor)
        .query(`
          SELECT CodigoCuenta 
          FROM ClientesConta 
          WHERE CodigoClienteProveedor = @codigoProveedor
            AND CodigoEmpresa = 9999
        `);
      
      if (cuentaContableResult.recordset.length > 0) {
        cuentaProveedor = cuentaContableResult.recordset[0].CodigoCuenta;
        console.log(`✅ Cuenta contable encontrada: ${cuentaProveedor}`);
      }
    } catch (error) {
      console.error('❌ Error buscando cuenta contable:', error);
    }
    
    // Determinar cuentas
    const cuentaIngreso = ingreso.cuentaSeleccionada;
    const cuentaContrapartida = tipoIngreso === 'caja' ? '570000000' : '430000000';
    const cuentaGasto = '621000000';
    
    // Comentarios
    const comentarioIngreso = `Ingreso ${ingreso.numDocumento} - ${ingreso.concepto}`.substring(0, 40);
    const comentarioFactura = `Factura ${factura.numDocumento}`.substring(0, 40);
    
    console.log(`💰 Asiento Doble: Ingreso=${importeIngreso}, Factura=${totalFactura}`);
    
    // PARTE INGRESO - 2 líneas
    
    // Línea 1: Ingreso (HABER)
    const movPosicionIngreso = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaIngreso)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioIngreso)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeIngreso)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.DateTime, null)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // Línea 2: Contrapartida Ingreso (DEBE)
    const movPosicionContrapartida = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionContrapartida)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaContrapartida)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioIngreso)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeIngreso)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.DateTime, null)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // PARTE FACTURA - 3 líneas
    
    // Línea 3: Proveedor (HABER)
    const movPosicionProveedor = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedor)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioFactura)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), 'P')
      .input('FechaVencimiento', sql.DateTime, null)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);
    
    // Línea 4: IVA (DEBE)
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), '472000000')
        .input('Contrapartida', sql.VarChar(15), cuentaProveedor)
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioFactura)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), '')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), '')
        .input('FechaVencimiento', sql.DateTime, null)
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
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);
    }
    
    // Línea 5: Gasto (DEBE)
    const movPosicionGasto = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioFactura)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalBase)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.DateTime, null)
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
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
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
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento Doble #${siguienteAsiento} creado correctamente`
    });
    
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error('❌ Error creando asiento doble:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error creando asiento doble: ' + err.message
    });
  }
});

// ============================================
// ✅ INICIALIZACIÓN DEL SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});

module.exports = app;