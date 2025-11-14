const express = require('express');
const session = require('express-session');
const cors = require('cors');
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// 🔍 DETECCIÓN AUTOMÁTICA DE FRONTEND
// ============================================

const detectFrontend = () => {
  const possiblePaths = [
    path.join(__dirname, 'build'),
    path.join(__dirname, 'dist'),
    path.join(__dirname, '../client/build'),
    path.join(__dirname, '../client/dist')
  ];

  for (const frontendPath of possiblePaths) {
    if (fs.existsSync(frontendPath)) {
      console.log(`✅ Frontend detectado en: ${frontendPath}`);
      return frontendPath;
    }
  }
  
  console.log('🔍 No se detectó frontend construido - Modo desarrollo');
  return null;
};

const frontendPath = detectFrontend();
const hasFrontend = frontendPath !== null;

// ============================================
// ⚙️ CONFIGURACIÓN DE BASE DE DATOS
// ============================================

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

// ============================================
// ⚙️ MIDDLEWARE
// ============================================

// Configurar CORS según si hay frontend o no
if (hasFrontend) {
  // Si hay frontend construido, servir archivos estáticos
  app.use(express.static(frontendPath));
  
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5000'],
    credentials: true
  }));
  
  console.log('🚀 Modo: Backend + Frontend Integrado');
} else {
  // Si no hay frontend, solo API (desarrollo)
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));
  
  console.log('🔧 Modo: Solo API (Desarrollo)');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'sage200-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: hasFrontend, // HTTPS en producción si hay frontend
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ============================================
// 🔐 MIDDLEWARE DE AUTENTICACIÓN
// ============================================

const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
};

// ============================================
// 🔄 FUNCIONES AUXILIARES PARA EFECTOS
// ============================================

const gestionarEfecto = async (transaction, movimientoData) => {
  const {
    movPosicion,
    ejercicio,
    codigoEmpresa,
    tipoMov,
    asiento,
    codigoCuenta,
    contrapartida,
    fechaAsiento,
    fechaVencimiento,
    importe,
    comentario,
    codigoClienteProveedor,
    suFacturaNo,
    esPago = false
  } = movimientoData;

  if (!fechaVencimiento) {
    return null;
  }

  if (esPago) {
    // MARCAR EFECTO COMO PAGADO/BORRADO (FormPage3 - Pago)
    console.log(`🗑️ Marcando efecto como pagado para MovPosicion: ${movPosicion}`);
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('StatusBorrado', sql.SmallInt, -1)
      .input('StatusContabilizado', sql.SmallInt, -1)
      .query(`
        UPDATE CarteraEfectos 
        SET StatusBorrado = @StatusBorrado,
            StatusContabilizado = @StatusContabilizado,
            FechaCobroEfecto_ = GETDATE()
        WHERE MovPosicion = @MovPosicion 
          AND Ejercicio = @Ejercicio
      `);
    
    return true;
  } else {
    // CREAR NUEVO EFECTO - SOLO CAMPOS QUE SABEMOS QUE FUNCIONAN + FACTURA
    console.log(`📄 Creando nuevo efecto para cuenta: ${codigoCuenta}`);
    
    // Convertir número de documento a entero para el campo Factura
    const facturaNumero = parseInt(suFacturaNo) || 0;
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
      .input('CodigoEmpresa', sql.SmallInt, codigoEmpresa)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('Prevision', sql.VarChar(1), 'P')
      .input('CodigoClienteProveedor', sql.VarChar(6), codigoClienteProveedor || '000002')
      .input('CodigoCuenta', sql.VarChar(15), codigoCuenta)
      .input('FechaEmision', sql.DateTime, fechaAsiento)
      .input('FechaFactura', sql.DateTime, fechaAsiento)
      .input('FechaVencimiento', sql.DateTime, fechaVencimiento)
      .input('Factura', sql.Int, facturaNumero)
      .input('SuFacturaNo', sql.VarChar(40), suFacturaNo || '')
      .input('Comentario', sql.VarChar(40), comentario)
      .input('EmpresaOrigen', sql.SmallInt, codigoEmpresa)
      .query(`
        INSERT INTO CarteraEfectos 
        (MovPosicion, CodigoEmpresa, Ejercicio, Prevision, 
         CodigoClienteProveedor, CodigoCuenta, 
         FechaEmision, FechaFactura, FechaVencimiento, Factura, SuFacturaNo, Comentario, EmpresaOrigen)
        VALUES 
        (@MovPosicion, @CodigoEmpresa, @Ejercicio, @Prevision,
         @CodigoClienteProveedor, @CodigoCuenta,
         @FechaEmision, @FechaFactura, @FechaVencimiento, @Factura, @SuFacturaNo, @Comentario, @EmpresaOrigen)
      `);
    
    return true;
  }
};

// ============================================
// 🔐 ENDPOINTS DE AUTENTICACIÓN
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
// 👥 ENDPOINTS DE PROVEEDORES
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
// 🔢 ENDPOINTS DE CONTADORES
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
// 🧾 ENDPOINTS DE ASIENTOS CONTABLES - FACTURAS/GASTOS
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
    const fechaAsiento = new Date(new Date().setHours(0, 0, 0, 0));
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
    
    const comentarioCorto = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);
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
      .input('Previsiones', sql.VarChar(1), vencimiento ? 'P' : '')
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
    
    // CREAR EFECTO SI HAY FECHA DE VENCIMIENTO
    if (vencimiento) {
      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedor,
        ejercicio: 2025,
        codigoEmpresa: 9999,
        tipoMov: 0,
        asiento: siguienteAsiento,
        codigoCuenta: cuentaContrapartida,
        contrapartida: '',
        fechaAsiento: fechaAsiento,
        fechaVencimiento: fechaVencimientoFormateada,
        importe: totalFactura,
        comentario: comentarioCorto,
        codigoClienteProveedor: proveedor.cuentaProveedor,
        suFacturaNo: numDocumento,
        esPago: false
      });
    }
    
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
// 💰 ENDPOINTS DE ASIENTOS CONTABLES - INGRESOS
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
    const fechaAsiento = new Date(new Date().setHours(0, 0, 0, 0));
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
    
    const comentarioCorto = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);
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
// 🔄 ENDPOINT PARA ASIENTO COMPRA + PAGO
// ============================================

app.post('/api/asiento/compra-pago', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    console.log('🔨 Iniciando creación de asiento compra+pago...');
    
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
    const fechaAsiento = new Date(new Date().setHours(0, 0, 0, 0));
    const usuario = req.session.user?.usuario || 'Sistema';
    
    console.log(`📝 Asiento Compra+Pago #${siguienteAsiento} - Usuario: ${usuario}`);
    
    const { 
      factura,
      pago
    } = req.body;
    
    if (!factura || !pago) {
      throw new Error('Datos de factura y pago requeridos');
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
    const cuentaGasto = factura.cuentaGasto || '600000000';
    const cuentaPago = pago.tipoPago === 'caja' ? '570000000' : '572000000';
    
    // Comentarios
    const comentarioFactura = `Factura ${factura.numDocumento}`.substring(0, 40);
    const comentarioPago = `Pago ${factura.numDocumento} - ${pago.concepto}`.substring(0, 40);
    
    // Formatear fecha de vencimiento
    let fechaVencimientoFormateada = null;
    if (pago.fechaVencimiento) {
      try {
        const fechaVenc = new Date(pago.fechaVencimiento);
        fechaVencimientoFormateada = new Date(fechaVenc.getFullYear(), fechaVenc.getMonth(), fechaVenc.getDate(), 0, 0, 0, 0);
      } catch (error) {
        console.error('❌ Error formateando fecha vencimiento:', error);
      }
    }
    
    console.log(`💰 Compra+Pago: Factura=${totalFactura}, Base=${totalBase}, IVA=${totalIVA}, Vencimiento=${fechaVencimientoFormateada}`);
    
    // LÍNEA 1: Proveedor (HABER) - Registro de la deuda
    const movPosicionProveedorHaber = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
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
      .input('Previsiones', sql.VarChar(1), fechaVencimientoFormateada ? 'P' : '')
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
    
    // CREAR EFECTO PARA LA DEUDA SI HAY FECHA DE VENCIMIENTO
    if (fechaVencimientoFormateada) {
      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedorHaber,
        ejercicio: 2025,
        codigoEmpresa: 9999,
        tipoMov: 0,
        asiento: siguienteAsiento,
        codigoCuenta: cuentaProveedor,
        contrapartida: '',
        fechaAsiento: fechaAsiento,
        fechaVencimiento: fechaVencimientoFormateada,
        importe: totalFactura,
        comentario: comentarioFactura,
        codigoClienteProveedor: factura.proveedor.cuentaProveedor,
        suFacturaNo: factura.numDocumento,
        esPago: false
      });
    }
    
    // LÍNEA 2: IVA (DEBE)
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
    
    // LÍNEA 3: Gasto (DEBE)
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
    
    // LÍNEA 4: Proveedor (DEBE) - Cancelación de la deuda
    const movPosicionProveedorDebe = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorDebe)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedor)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioPago)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
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
    
    // MARCAR EFECTO COMO PAGADO SI HABÍA FECHA DE VENCIMIENTO
    if (fechaVencimientoFormateada) {
      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedorHaber,
        ejercicio: 2025,
        codigoEmpresa: 9999,
        tipoMov: 0,
        asiento: siguienteAsiento,
        codigoCuenta: cuentaProveedor,
        fechaAsiento: fechaAsiento,
        fechaVencimiento: fechaVencimientoFormateada,
        importe: totalFactura,
        comentario: comentarioPago,
        codigoClienteProveedor: factura.proveedor.cuentaProveedor,
        esPago: true
      });
    }
    
    // LÍNEA 5: Pago (HABER) - Salida de dinero
    const movPosicionPago = uuidv4();
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionPago)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaPago)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioPago)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
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
      message: `Asiento Compra+Pago #${siguienteAsiento} creado correctamente`,
      detalles: {
        lineas: 5,
        base: totalBase,
        iva: totalIVA,
        total: totalFactura
      }
    });
    
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error('❌ Error creando asiento compra+pago:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error creando asiento compra+pago: ' + err.message
    });
  }
});

// ============================================
// 📊 ENDPOINTS PARA DATOS MAESTROS - CORREGIDOS
// ============================================

// Obtener cuentas de gasto (6xx)
app.get('/api/cuentas/gastos', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        CodigoCuenta as id,
        Cuenta as nombre
      FROM PlanCuentas 
      WHERE CodigoEmpresa = 9999
        AND CodigoCuenta LIKE '6%'
        AND LEN(CodigoCuenta) = 9
      ORDER BY CodigoCuenta
    `);

    console.log(`✅ Cuentas de gasto obtenidas: ${result.recordset.length} registros`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas de gasto:', err);
    res.status(500).json({ error: 'Error obteniendo cuentas de gasto' });
  }
});

// Obtener cuentas de proveedores (4xx)
app.get('/api/cuentas/proveedores', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        CodigoCuenta as id,
        Cuenta as nombre
      FROM PlanCuentas 
      WHERE CodigoEmpresa = 9999
        AND (CodigoCuenta LIKE '4%' OR CodigoCuenta LIKE '410%')
        AND LEN(CodigoCuenta) = 9
      ORDER BY CodigoCuenta
    `);

    console.log(`✅ Cuentas de proveedores obtenidas: ${result.recordset.length} registros`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas de proveedores:', err);
    res.status(500).json({ error: 'Error obteniendo cuentas de proveedores' });
  }
});

// Obtener canal del cliente (serie y analítico)
app.get('/api/cliente/canal', requireAuth, async (req, res) => {
  try {
    const codigoCliente = req.session.user?.codigoCliente;
    
    if (!codigoCliente) {
      return res.status(400).json({ error: 'Código de cliente no disponible' });
    }

    const result = await pool.request()
      .input('codigoCliente', sql.VarChar, codigoCliente)
      .query(`
        SELECT 
          CodigoCanal as canal,
          IdDelegacion as delegacion
        FROM Clientes 
        WHERE CodigoCliente = @codigoCliente
          AND CodigoEmpresa = 9999
      `);

    if (result.recordset.length > 0) {
      const canalData = result.recordset[0];
      res.json({
        serie: canalData.canal || 'EM',
        analitico: canalData.delegacion || 'EM'
      });
    } else {
      res.json({ serie: 'EM', analitico: 'EM' });
    }
  } catch (err) {
    console.error('❌ Error obteniendo canal del cliente:', err);
    res.status(500).json({ error: 'Error obteniendo datos del canal' });
  }
});

// Obtener cuenta de caja del cliente
app.get('/api/cliente/cuenta-caja', requireAuth, async (req, res) => {
  try {
    const codigoCliente = req.session.user?.codigoCliente;
    
    if (!codigoCliente) {
      return res.status(400).json({ error: 'Código de cliente no disponible' });
    }

    const result = await pool.request()
      .input('codigoCliente', sql.VarChar, codigoCliente)
      .query(`
        SELECT CuentaCaja
        FROM Clientes 
        WHERE CodigoCliente = @codigoCliente
          AND CodigoEmpresa = 9999
      `);

    if (result.recordset.length > 0) {
      const cuentaCaja = result.recordset[0].CuentaCaja;
      console.log(`✅ Cuenta caja obtenida: ${cuentaCaja}`);
      res.json({ cuentaCaja });
    } else {
      res.status(404).json({ error: 'Cliente no encontrado' });
    }
  } catch (err) {
    console.error('❌ Error obteniendo cuenta caja del cliente:', err);
    res.status(500).json({ error: 'Error obteniendo cuenta caja' });
  }
});

// Obtener cuentas de ingreso (519)
app.get('/api/cuentas/ingresos', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        CodigoCuenta as id,
        Cuenta as nombre
      FROM PlanCuentas 
      WHERE CodigoEmpresa = 9999
        AND CodigoCuenta LIKE '519%'
        AND LEN(CodigoCuenta) = 9
      ORDER BY CodigoCuenta
    `);

    console.log(`✅ Cuentas de ingreso obtenidas: ${result.recordset.length} registros`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas de ingreso:', err);
    res.status(500).json({ error: 'Error obteniendo cuentas de ingreso' });
  }
});

// ============================================
// 🧾 ENDPOINT COMPLETAMENTE CORREGIDO FORMPAGE4 - FACTURA IVA NO DEDUCIBLE
// ============================================

app.post('/api/asiento/factura-iva-no-deducible', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('🔨 Iniciando creación de asiento FormPage4 (IVA NO DEDUCIBLE)...');
    
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
    const fechaAsiento = new Date(new Date().setHours(0, 0, 0, 0));
    const usuario = req.session.user?.usuario || 'Sistema';
    
    console.log(`📝 Asiento FormPage4 #${siguienteAsiento} - Usuario: ${usuario}`);
    
    const { 
      detalles, 
      proveedor, 
      serie, 
      numDocumento, 
      numFRA,
      fechaFactura, 
      vencimiento, 
      concepto,
      cuentaGasto,
      analitico
    } = req.body;

    // Validaciones
    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      throw new Error('No hay detalles de factura');
    }
    
    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }
    
    if (!proveedor) {
      throw new Error('Datos del proveedor requeridos');
    }

    // Buscar cuenta proveedor real
    let cuentaProveedorReal = '400000000';
    try {
      const cuentaContableResult = await transaction.request()
        .input('codigoProveedor', sql.VarChar, proveedor.codigoProveedor)
        .query(`
          SELECT CodigoCuenta 
          FROM ClientesConta 
          WHERE CodigoClienteProveedor = @codigoProveedor
            AND CodigoEmpresa = 9999
        `);
      
      if (cuentaContableResult.recordset.length > 0) {
        cuentaProveedorReal = cuentaContableResult.recordset[0].CodigoCuenta;
        console.log(`✅ Cuenta contable encontrada: ${cuentaProveedorReal}`);
      }
    } catch (error) {
      console.error('❌ Error buscando cuenta contable:', error);
    }

    // Calcular totales
    let totalBase = 0;
    let totalIVA = 0;
    let totalRetencion = 0;
    
    detalles.forEach((linea) => {
      const base = parseFloat(linea.base) || 0;
      const tipoIVA = parseFloat(linea.tipoIVA) || 0;
      const retencion = parseFloat(linea.retencion) || 0;
      const iva = (base * tipoIVA) / 100;
      const cuotaRetencion = (base * retencion) / 100;
      
      if (base > 0) {
        totalBase += base;
        totalIVA += iva;
        totalRetencion += cuotaRetencion;
      }
    });

    totalBase = parseFloat(totalBase.toFixed(2));
    totalIVA = parseFloat(totalIVA.toFixed(2));
    totalRetencion = parseFloat(totalRetencion.toFixed(2));
    const totalFactura = parseFloat((totalBase + totalIVA - totalRetencion).toFixed(2));

    console.log(`💰 Totales: Base=${totalBase}, IVA=${totalIVA}, Retención=${totalRetencion}, Total=${totalFactura}`);

    // Formatear fecha vencimiento
    let fechaVencimientoFormateada = null;
    if (vencimiento) {
      try {
        const fechaVenc = new Date(vencimiento);
        fechaVencimientoFormateada = new Date(fechaVenc.getFullYear(), fechaVenc.getMonth(), fechaVenc.getDate(), 0, 0, 0, 0);
        console.log(`📅 Fecha vencimiento: ${fechaVencimientoFormateada}`);
      } catch (error) {
        console.error('❌ Error formateando fecha vencimiento:', error);
      }
    }

    const comentarioCorto = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);

    // LÍNEA 1: Proveedor (HABER) - Neto a pagar
    const movPosicionProveedor = uuidv4();
    console.log('Insertando línea 1: Proveedor...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), analitico)
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), vencimiento ? 'P' : '')
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

    // CREAR EFECTO SI HAY VENCIMIENTO
    if (fechaVencimientoFormateada) {
      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedor,
        ejercicio: 2025,
        codigoEmpresa: 9999,
        tipoMov: 0,
        asiento: siguienteAsiento,
        codigoCuenta: cuentaProveedorReal,
        contrapartida: '',
        fechaAsiento: fechaAsiento,
        fechaVencimiento: fechaVencimientoFormateada,
        importe: totalFactura,
        comentario: comentarioCorto,
        codigoClienteProveedor: proveedor.codigoProveedor,
        suFacturaNo: numDocumento,
        esPago: false
      });
    }

    // LÍNEA 2: IVA NO DEDUCIBLE (DEBE) - CUENTA 629
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      console.log('Insertando línea 2: IVA No Deducible...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), '629000000')
        .input('Contrapartida', sql.VarChar(15), cuentaProveedorReal)
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), analitico)
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

    // LÍNEA 3: Gasto (DEBE)
    const movPosicionGasto = uuidv4();
    console.log('Insertando línea 3: Gasto...');
    
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
      .input('CodigoCanal', sql.VarChar(10), analitico)
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

    // LÍNEA 4: Retención (HABER) si existe
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      console.log('Insertando línea 4: Retención...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'H')
        .input('CodigoCuenta', sql.VarChar(15), '475100000')
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalRetencion)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), analitico)
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

    // 🔥🔥🔥 CORRECIÓN CRÍTICA: INSERTAR EN MOVIMIENTOSFACTURAS - USANDO MISMO FORMATO QUE FORMPAGE1
    console.log('🔥 Insertando en MovimientosFacturas...');
    
    try {
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
        .input('TipoMov', sql.TinyInt, 0)
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoCanal', sql.VarChar(10), '') // Cambiado a vacío como en FormPage1
        .input('IdDelegacion', sql.VarChar(10), '')
        .input('Serie', sql.VarChar(10), '') // Cambiado a vacío como en FormPage1
        .input('Factura', sql.Int, parseInt(numDocumento) || 0)
        .input('SuFacturaNo', sql.VarChar(40), (numFRA || '').substring(0, 40))
        .input('FechaFactura', sql.DateTime, fechaFactura || fechaAsiento)
        .input('Fecha347', sql.DateTime, fechaFactura || fechaAsiento)
        .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
        .input('TipoFactura', sql.VarChar(1), 'R')
        .input('CodigoCuentaFactura', sql.VarChar(15), cuentaProveedorReal)
        .input('CifDni', sql.VarChar(13), (proveedor.cif || '').substring(0, 13))
        .input('Nombre', sql.VarChar(35), (proveedor.nombre || '').substring(0, 35))
        .input('CodigoRetencion', sql.SmallInt, totalRetencion > 0 ? 15 : 0)
        .input('BaseRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? totalBase : 0)
        .input('PorcentajeRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? 15 : 0)
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
      console.log('✅ MovimientosFacturas insertado correctamente');
    } catch (error) {
      console.error('❌ Error insertando en MovimientosFacturas:', error);
      throw error;
    }

    // 🔥🔥🔥 CORRECIÓN CRÍTICA: INSERTAR EN MOVIMIENTOSIVA - USANDO MISMO FORMATO QUE FORMPAGE1
    if (totalIVA > 0 && movPosicionIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '21';
      console.log('🔥 Insertando en MovimientosIva...');

      try {
        await transaction.request()
          .input('CodigoEmpresa', sql.SmallInt, 9999)
          .input('Ejercicio', sql.SmallInt, 2025)
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor) // MovPosicion de la línea de proveedor
          .input('TipoMov', sql.TinyInt, 0)
          .input('Orden', sql.TinyInt, 1)
          .input('Año', sql.SmallInt, 2025)
          .input('CodigoIva', sql.SmallInt, parseInt(tipoIVAPrincipal))
          .input('IvaPosicion', sql.UniqueIdentifier, movPosicionIVA) // MovPosicion de la línea de IVA
          .input('RecPosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
          .input('BasePosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
          .input('BaseIva', sql.Decimal(18, 2), totalBase)
          .input('PorcentajeBaseCorrectora', sql.Decimal(18, 2), 0)
          .input('PorcentajeIva', sql.Decimal(18, 2), parseFloat(tipoIVAPrincipal))
          .input('CuotaIva', sql.Decimal(18, 2), totalIVA)
          .input('PorcentajeRecargoEquivalencia', sql.Decimal(18, 2), 0)
          .input('RecargoEquivalencia', sql.Decimal(18, 2), 0)
          .input('CodigoTransaccion', sql.TinyInt, 1)
          .input('Deducible', sql.SmallInt, 0) // 0 = NO DEDUCIBLE (629)
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
        console.log('✅ MovimientosIva insertado correctamente');
      } catch (error) {
        console.error('❌ Error insertando en MovimientosIva:', error);
        throw error;
      }
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
    console.log(`🎉 Asiento FormPage4 #${siguienteAsiento} creado exitosamente`);

    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento Factura Proveedor (IVA No Deducible) #${siguienteAsiento} creado correctamente`,
      detalles: {
        lineas: totalRetencion > 0 ? 4 : 3,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura
      }
    });

  } catch (err) {
    console.error('❌ Error detallado creando asiento FormPage4:', err);
    
    if (transaction) {
      try {
        await transaction.rollback();
        console.log('Rollback completado');
      } catch (rollbackErr) {
        console.error('❌ Error durante el rollback:', rollbackErr);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error creando asiento: ' + err.message
    });
  }
});
// ============================================
// 💰 ENDPOINT COMPLETO FORMPAGE5 - PAGO A PROVEEDOR
// ============================================

app.post('/api/asiento/pago-proveedor', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('🔨 Iniciando creación de asiento FormPage5 (Pago Proveedor)...');
    
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
    const fechaAsiento = new Date(new Date().setHours(0, 0, 0, 0));
    const usuario = req.session.user?.usuario || 'Sistema';
    
    console.log(`📝 Asiento Pago #${siguienteAsiento} - Usuario: ${usuario}`);
    
    const { 
      proveedor,
      importe,
      concepto,
      serie,
      numDocumento,
      cuentaCaja,
      analitico
    } = req.body;

    // Validaciones
    if (!proveedor || !importe || !concepto || !numDocumento) {
      throw new Error('Datos incompletos para el pago');
    }
    
    const importeNum = parseFloat(importe);
    if (importeNum <= 0) {
      throw new Error('El importe debe ser mayor a 0');
    }

    // Buscar cuenta proveedor real
    let cuentaProveedorReal = '400000000';
    try {
      const cuentaContableResult = await transaction.request()
        .input('codigoProveedor', sql.VarChar, proveedor.codigoProveedor)
        .query(`
          SELECT CodigoCuenta 
          FROM ClientesConta 
          WHERE CodigoClienteProveedor = @codigoProveedor
            AND CodigoEmpresa = 9999
        `);
      
      if (cuentaContableResult.recordset.length > 0) {
        cuentaProveedorReal = cuentaContableResult.recordset[0].CodigoCuenta;
        console.log(`✅ Cuenta contable encontrada: ${cuentaProveedorReal}`);
      }
    } catch (error) {
      console.error('❌ Error buscando cuenta contable:', error);
    }

    const comentarioCorto = concepto.substring(0, 40);

    // LÍNEA 1: Proveedor (DEBE) - Se reduce la deuda al proveedor
    const movPosicionProveedor = uuidv4();
    console.log('Insertando línea 1: Proveedor (DEBE)...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), analitico)
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

    // LÍNEA 2: Caja (HABER) - Salida de dinero de caja
    const movPosicionCaja = uuidv4();
    console.log('Insertando línea 2: Caja (HABER)...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), analitico)
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
    console.log(`🎉 Asiento Pago #${siguienteAsiento} creado exitosamente`);

    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento Pago Proveedor #${siguienteAsiento} creado correctamente`,
      detalles: {
        lineas: 2,
        importe: importeNum,
        cuentaProveedor: cuentaProveedorReal,
        cuentaCaja: cuentaCaja
      }
    });

  } catch (err) {
    console.error('❌ Error detallado creando asiento de pago:', err);
    
    if (transaction) {
      try {
        await transaction.rollback();
        console.log('Rollback completado');
      } catch (rollbackErr) {
        console.error('❌ Error durante el rollback:', rollbackErr);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error creando asiento de pago: ' + err.message
    });
  }
});

// ============================================
// 🏦 ENDPOINT PARA INGRESO EN CAJA (FORMPAGE6)
// ============================================

app.post('/api/asiento/ingreso-caja', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('1. Obteniendo contador para ingreso caja...');
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
    const fechaAsiento = new Date(new Date().setHours(0, 0, 0, 0)); // ✅ FIXED: Fecha sin hora
    const usuario = req.session.user?.usuario || 'Sistema';

    console.log(`📝 Asiento Ingreso Caja #${siguienteAsiento} - Usuario: ${usuario}`);

    const { 
      serie,
      numDocumento,
      numFRA,
      fechaReg,
      fechaFactura,
      fechaOper,
      concepto,
      comentario,
      analitico,
      cuentaIngreso,
      cuentaCaja,
      importe,
      archivo,
      proveedor
    } = req.body;

    // Validaciones
    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }

    if (!concepto) {
      throw new Error('Concepto requerido');
    }

    if (!cuentaIngreso) {
      throw new Error('Cuenta de ingreso requerida');
    }

    const importeNum = parseFloat(importe);
    if (isNaN(importeNum) || importeNum <= 0) {
      throw new Error('El importe debe ser mayor a 0');
    }

    console.log(`💰 Ingreso Caja: Importe=${importeNum}, Cuenta Ingreso=${cuentaIngreso}, Caja=${cuentaCaja}`);

    const comentarioCorto = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);

    // LÍNEA 1: INGRESO (HABER)
    const movPosicionIngreso = uuidv4();
    console.log('Insertando línea 1: Ingreso (HABER)...');
    
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
      .input('SerieCliente', sql.VarChar(10), serie || '')
      .input('NumeroDoc', sql.VarChar(20), numDocumento)
      .input('RutaDocumento', sql.VarChar(500), archivo || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), analitico || '')
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
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, SerieCliente, NumeroDoc, RutaDocumento, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @SerieCliente, @NumeroDoc, @RutaDocumento, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    // LÍNEA 2: CAJA (DEBE)
    const movPosicionCaja = uuidv4();
    console.log('Insertando línea 2: Caja (DEBE)...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('SerieCliente', sql.VarChar(10), serie || '')
      .input('NumeroDoc', sql.VarChar(20), numDocumento)
      .input('RutaDocumento', sql.VarChar(500), archivo || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), analitico || '')
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
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, SerieCliente, NumeroDoc, RutaDocumento, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @SerieCliente, @NumeroDoc, @RutaDocumento, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

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
    console.log(`🎉 Asiento Ingreso Caja #${siguienteAsiento} creado exitosamente`);

    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento Ingreso #${siguienteAsiento} creado correctamente`,
      detalles: {
        lineas: 2,
        importe: importeNum,
        cuentaIngreso: cuentaIngreso,
        cuentaCaja: cuentaCaja
      }
    });

  } catch (err) {
    console.error('❌ Error detallado creando asiento de ingreso caja:', err);
    
    if (transaction) {
      try {
        console.log('Intentando rollback...');
        await transaction.rollback();
        console.log('Rollback completado');
      } catch (rollbackErr) {
        console.error('❌ Error durante el rollback:', rollbackErr);
      }
    }
    
    let errorMessage = 'Error creando asiento de ingreso caja: ' + err.message;
    
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
// 💰 ENDPOINT PARA GASTO DIRECTO EN CAJA (FORMPAGE7)
// ============================================

app.post('/api/asiento/gasto-directo-caja', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('1. Obteniendo contador para gasto directo caja...');
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
    const fechaAsiento = new Date(new Date().setHours(0, 0, 0, 0)); // ✅ FIXED: Fecha sin hora
    const usuario = req.session.user?.usuario || 'Sistema';

    console.log(`📝 Asiento Gasto Directo Caja #${siguienteAsiento} - Usuario: ${usuario}`);

    const { 
      serie,
      numDocumento,
      numFRA,
      fechaReg,
      fechaFactura,
      fechaOper,
      concepto,
      comentario,
      analitico,
      cuentaGasto,
      cuentaCaja,
      importe,
      archivo,
      proveedor
    } = req.body;

    // Validaciones
    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }

    if (!concepto) {
      throw new Error('Concepto requerido');
    }

    if (!cuentaGasto) {
      throw new Error('Cuenta de gasto requerida');
    }

    const importeNum = parseFloat(importe);
    if (isNaN(importeNum) || importeNum <= 0) {
      throw new Error('El importe debe ser mayor a 0');
    }

    console.log(`💰 Gasto Directo Caja: Importe=${importeNum}, Cuenta Gasto=${cuentaGasto}, Caja=${cuentaCaja}`);

    const comentarioCorto = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);

    // LÍNEA 1: GASTO (DEBE)
    const movPosicionGasto = uuidv4();
    console.log('Insertando línea 1: Gasto (DEBE)...');
    
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
      .input('SerieCliente', sql.VarChar(10), serie || '')
      .input('NumeroDoc', sql.VarChar(20), numDocumento)
      .input('RutaDocumento', sql.VarChar(500), archivo || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), analitico || '')
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
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, SerieCliente, NumeroDoc, RutaDocumento, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @SerieCliente, @NumeroDoc, @RutaDocumento, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    // LÍNEA 2: CAJA (HABER)
    const movPosicionCaja = uuidv4();
    console.log('Insertando línea 2: Caja (HABER)...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('SerieCliente', sql.VarChar(10), serie || '')
      .input('NumeroDoc', sql.VarChar(20), numDocumento)
      .input('RutaDocumento', sql.VarChar(500), archivo || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), analitico || '')
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
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, SerieCliente, NumeroDoc, RutaDocumento, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, @FechaAsiento, @TipoDocumento, @DocumentoConta, @SerieCliente, @NumeroDoc, @RutaDocumento, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, @FechaVencimiento, @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

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
    console.log(`🎉 Asiento Gasto Directo Caja #${siguienteAsiento} creado exitosamente`);

    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento Gasto Directo #${siguienteAsiento} creado correctamente`,
      detalles: {
        lineas: 2,
        importe: importeNum,
        cuentaGasto: cuentaGasto,
        cuentaCaja: cuentaCaja
      }
    });

  } catch (err) {
    console.error('❌ Error detallado creando asiento de gasto directo caja:', err);
    
    if (transaction) {
      try {
        console.log('Intentando rollback...');
        await transaction.rollback();
        console.log('Rollback completado');
      } catch (rollbackErr) {
        console.error('❌ Error durante el rollback:', rollbackErr);
      }
    }
    
    let errorMessage = 'Error creando asiento de gasto directo caja: ' + err.message;
    
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
// 🔍 ENDPOINT PARA CONSULTAR EFECTOS
// ============================================

app.get('/api/efectos/:codigoProveedor?', requireAuth, async (req, res) => {
  try {
    const { codigoProveedor } = req.params;
    
    let query = `
      SELECT 
        ce.MovCartera,
        ce.MovPosicion,
        ce.NumeroEfecto,
        ce.CodigoClienteProveedor,
        ce.CodigoCuenta,
        ce.FechaEmision,
        ce.FechaVencimiento,
        ce.ImporteEfecto,
        ce.SuFacturaNo,
        ce.Comentario,
        ce.StatusBorrado,
        ce.StatusContabilizado,
        p.RazonSocial as NombreProveedor
      FROM CarteraEfectos ce
      LEFT JOIN Proveedores p ON ce.CodigoClienteProveedor = p.CodigoProveedor
      WHERE ce.CodigoEmpresa = 9999
        AND ce.Ejercicio = 2025
        AND ce.StatusBorrado = 0
    `;
    
    if (codigoProveedor) {
      query += ` AND ce.CodigoClienteProveedor = '${codigoProveedor}'`;
    }
    
    query += ` ORDER BY ce.FechaVencimiento ASC`;
    
    const result = await pool.request().query(query);
    
    console.log(`📋 Efectos obtenidos: ${result.recordset.length} registros`);
    res.json(result.recordset);
    
  } catch (err) {
    console.error('❌ Error obteniendo efectos:', err);
    res.status(500).json({ error: 'Error obteniendo efectos' });
  }
});

// ============================================
// 🚀 INICIALIZACIÓN DEL SERVIDOR
// ============================================

// Si hay frontend construido, servir archivos estáticos para rutas no manejadas por la API
if (hasFrontend) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 Modo: ${hasFrontend ? 'Backend + Frontend Integrado' : 'Solo API (Desarrollo)'}`);
  if (hasFrontend) {
    console.log(`📁 Frontend servido desde: ${frontendPath}`);
  } else {
    console.log('💡 Para modo producción, construye el frontend en carpeta "build" o "dist"');
  }
});

module.exports = app;