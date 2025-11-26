const express = require('express');
const session = require('express-session');
const cors = require('cors');
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// 📅 FUNCIÓN DEFINITIVA CORREGIDA - FECHAS EXACTAS SIN HORAS NI UTC
const formatDateWithoutTimezone = (dateString) => {
  if (!dateString) return null;
  
  console.log(`📅 Fecha recibida: ${dateString}`);
  
  try {
    // 🔥 SOLUCIÓN: Devolver el string directamente YYYY-MM-DD
    // SQL Server lo convertirá a DATE sin horas
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log(`📅 Enviando fecha exacta: ${dateString}`);
      return dateString; // Devolver el string tal cual
    }
    
    // Para otros formatos, extraer solo YYYY-MM-DD
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    
    console.log(`📅 Fecha convertida a string: ${result}`);
    return result;
    
  } catch (error) {
    console.error('❌ Error en formatDateWithoutTimezone:', error);
    return null;
  }
};

// ============================================
// 📁 CONFIGURACIÓN MEJORADA DE FRONTEND
// ============================================

const getFrontendPath = () => {
  // Rutas posibles donde puede estar el frontend construido
  const possiblePaths = [
    path.join(__dirname, 'build'),
    path.join(__dirname, 'dist'),
    path.join(__dirname, '../client/build'),
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, '../frontend/build'),
    path.join(__dirname, '../frontend/dist'),
    path.join(__dirname, 'public'),
    path.join(__dirname, '../public'),
    // Rutas específicas para producción
    path.join(__dirname, '../build'),
    path.join(process.cwd(), 'build'),
    path.join(process.cwd(), 'dist')
  ];

  for (const frontendPath of possiblePaths) {
    console.log(`🔍 Buscando frontend en: ${frontendPath}`);
    if (fs.existsSync(frontendPath)) {
      console.log(`✅ Frontend detectado en: ${frontendPath}`);
      
      // Verificar que existe index.html
      const indexPath = path.join(frontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        console.log(`✅ index.html encontrado en: ${indexPath}`);
        return frontendPath;
      } else {
        console.log(`❌ index.html NO encontrado en: ${frontendPath}`);
      }
    }
  }
  
  console.log('🔍 No se detectó frontend construido - Modo API solo');
  return null;
};

const frontendPath = getFrontendPath();
const hasFrontend = frontendPath !== null;

// ============================================
// ⚙️ CONFIGURACIÓN DE BASE DE DATOS
// ============================================

const dbConfig = {
  server: 'SSCC-APP-SAGE',
  database: 'Sage',
  user: 'logic',
  password: 'admin2025',
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
// ⚙️ CONFIGURACIÓN CORS MEJORADA
// ============================================

const corsOptions = {
  origin: function (origin, callback) {
    // En producción, permitir cualquier origen o específicos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://84.120.61.159:3000',
      'http://84.120.61.159:5000',
      'http://84.120.61.159',
      'http://192.168.1.100:3000',
      'http://192.168.1.100:5000',
      // Agregar el origen actual del frontend
      `http://${HOST}:${PORT}`,
      `http://${HOST}`
    ];
    
    // En desarrollo, permitir cualquier origen
    if (!origin || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🔒 Origen CORS no permitido:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie', 'Set-Cookie']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Manejar preflight para todas las rutas

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de sesión mejorada
app.use(session({
  secret: process.env.SESSION_SECRET || 'sage200-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Cambiar a true si usas HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    httpOnly: true,
    sameSite: 'lax'
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
// 🔐 ENDPOINTS DE AUTENTICACIÓN (ACTUALIZADOS)
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
          StatusAdministrador,
          CodigoCanal,
          CodigoProyecto,
          CodigoSeccion,
          CodigoDepartamento,
          CuentaCaja,
          IdDelegacion
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
        isAdmin: isAdmin,
        codigoCanal: userData.CodigoCanal || 'EM',
        codigoProyecto: userData.CodigoProyecto || '',
        codigoSeccion: userData.CodigoSeccion || '',
        codigoDepartamento: userData.CodigoDepartamento || '',
        cuentaCaja: userData.CuentaCaja || '57000000',
        idDelegacion: userData.IdDelegacion || 'EM'
      };

      console.log(`✅ Usuario ${username} logueado desde ${req.ip}`);
      
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
// 🟢 ENDPOINT PARA VERIFICAR SESIÓN
// ============================================

app.get('/api/session', (req, res) => {
  if (req.session?.user) {
    return res.status(200).json({
      authenticated: true,
      user: req.session.user
    });
  }

  return res.status(200).json({ authenticated: false });
});

// ============================================
// 🔄 FUNCIONES AUXILIARES PARA EFECTOS - VERSIÓN DEFINITIVA CORREGIDA
// ============================================

const gestionarEfecto = async (transaction, movimientoData) => {
  const {
    movPosicion,
    ejercicio,
    codigoEmpresa,
    idDelegacion,
    fechaAsiento,
    fechaVencimiento,
    importe,
    comentario,
    codigoClienteProveedor,
    suFacturaNo,
    codigoCuenta,
    esPago = false
  } = movimientoData;

  console.log(`🔧 Gestionando efecto para MovPosicion: ${movPosicion}`);
  console.log(`📅 Vencimiento recibido: ${fechaVencimiento}`);

  if (!fechaVencimiento) {
    console.log('⚠️ No hay fecha vencimiento válida, omitiendo efecto');
    return null;
  }

  try {
    if (esPago) {
      // MARCAR EFECTO COMO PAGADO
      console.log(`🗑️ Marcando efecto como pagado para MovPosicion: ${movPosicion}`);
      
      const result = await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .query(`
          UPDATE CarteraEfectos 
          SET ImportePendiente = 0
          WHERE MovPosicion = @MovPosicion 
            AND Ejercicio = @Ejercicio
        `);
      
      return result.rowsAffected[0] > 0;
      
    } else {
      // CREAR NUEVO EFECTO - CON FECHAS COMO STRING
      console.log(`📄 Creando nuevo efecto para MovPosicion: ${movPosicion}`);
      
      // Verificar si ya existe
      const existeResult = await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .query(`
          SELECT COUNT(*) as count 
          FROM CarteraEfectos 
          WHERE MovPosicion = @MovPosicion 
            AND Ejercicio = @Ejercicio
        `);
      
      if (existeResult.recordset[0].count > 0) {
        console.log('⚠️ El efecto ya existe, omitiendo creación');
        return true;
      }

      // INSERTAR EFECTO CON FECHAS COMO STRING
      const insertResult = await transaction.request()
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
        .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
        .input('Prevision', sql.VarChar(1), 'P')
        .input('Aceptado', sql.SmallInt, -1)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('Comentario', sql.VarChar(40), comentario || '')
        .input('CodigoClienteProveedor', sql.VarChar(15), codigoClienteProveedor || '000002')
        .input('CodigoCuenta', sql.VarChar(15), codigoCuenta || '400000000')
        .input('FechaEmision', sql.VarChar, fechaAsiento) // 🔥 STRING
        .input('FechaFactura', sql.VarChar, fechaAsiento) // 🔥 STRING
        .input('FechaVencimiento', sql.VarChar, fechaVencimiento) // 🔥 STRING
        .input('EnEuros_', sql.SmallInt, -1)
        .input('ImporteEfecto', sql.Decimal(18, 2), importe)
        .input('ImportePendiente', sql.Decimal(18, 2), importe)
        .input('SuFacturaNo', sql.VarChar(40), suFacturaNo || '')
        .input('CodigoEmpresa', sql.SmallInt, codigoEmpresa || 10000)
        .query(`
          INSERT INTO CarteraEfectos 
          (IdDelegacion, MovPosicion, Prevision, Aceptado, Ejercicio, Comentario,
           CodigoClienteProveedor, CodigoCuenta, FechaEmision, FechaFactura, FechaVencimiento, EnEuros_,
           ImporteEfecto, ImportePendiente, SuFacturaNo, CodigoEmpresa)
          VALUES 
          (@IdDelegacion, @MovPosicion, @Prevision, @Aceptado, @Ejercicio, @Comentario,
           @CodigoClienteProveedor, @CodigoCuenta, CONVERT(DATE, @FechaEmision), CONVERT(DATE, @FechaFactura), CONVERT(DATE, @FechaVencimiento), @EnEuros_,
           @ImporteEfecto, @ImportePendiente, @SuFacturaNo, @CodigoEmpresa)
        `);
      
      console.log(`✅ Efecto creado correctamente con fecha: ${fechaVencimiento}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Error en gestionarEfecto:', error);
    throw new Error(`Error gestionando efecto: ${error.message}`);
  }
};

// ============================================
// 👥 ENDPOINTS DE PROVEEDORES
// ============================================

// 👥 ENDPOINTS DE PROVEEDORES - VERSIÓN MEJORADA
app.get('/api/proveedores', requireAuth, async (req, res) => {
  try {
    console.log('🔍 Solicitando lista de proveedores...');
    
    const result = await pool.request().query(`
      SELECT 
        CodigoProveedor as codigo,
        CifDni as cif,
        RazonSocial as nombre,
        CodigoPostal as cp,
        Telefono as telefono,
        Email1 as email
      FROM Proveedores
      WHERE CodigoEmpresa = 10000
        AND BajaEmpresaLc = 0
      ORDER BY RazonSocial
    `);

    console.log(`✅ Proveedores obtenidos: ${result.recordset.length} registros`);
    
    if (result.recordset.length === 0) {
      console.log('⚠️ No se encontraron proveedores en la base de datos');
    }

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo proveedores:', err);
    res.status(500).json({ 
      error: 'Error obteniendo proveedores',
      details: err.message 
    });
  }
});

app.get('/api/proveedores/cuentas', requireAuth, async (req, res) => {
  try {
    console.log('🔍 Solicitando cuentas de proveedores...');
    
    const result = await pool.request().query(`
      SELECT 
        p.CodigoProveedor as codigo,
        p.RazonSocial as nombre,
        ISNULL(cc.CodigoCuenta, '400000000') as cuenta
      FROM Proveedores p
      LEFT JOIN ClientesConta cc ON p.CodigoProveedor = cc.CodigoClienteProveedor
        AND cc.CodigoEmpresa = 10000
      WHERE p.CodigoEmpresa = 10000
        AND p.BajaEmpresaLc = 0
      ORDER BY p.RazonSocial
    `);

    console.log(`✅ Cuentas de proveedores obtenidas: ${result.recordset.length} registros`);
    
    if (result.recordset.length === 0) {
      console.log('⚠️ No se encontraron cuentas de proveedores');
    }

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas de proveedores:', err);
    res.status(500).json({ 
      error: 'Error obteniendo cuentas de proveedores',
      details: err.message 
    });
  }
});
// 📊 ENDPOINTS PARA CUENTAS CONTABLES - NUEVOS
app.get('/api/cuentas/gastos', requireAuth, async (req, res) => {
  try {
    console.log('🔍 Solicitando cuentas de gasto...');
    
    // Consulta para obtener cuentas de gasto (grupo 6)
    const result = await pool.request().query(`
      SELECT 
        CodigoCuenta as id,
        Cuenta as nombre
      FROM PlanCuentas 
      WHERE CodigoEmpresa = 10000
        AND CodigoCuenta LIKE '6%'
        AND Bloqueo = 0
      ORDER BY CodigoCuenta
    `);

    console.log(`✅ Cuentas de gasto obtenidas: ${result.recordset.length} registros`);
    
    // Si no hay resultados, devolver algunas cuentas por defecto
    if (result.recordset.length === 0) {
      console.log('⚠️ No se encontraron cuentas de gasto, usando valores por defecto');
      const cuentasPorDefecto = [
        { id: '600000000', nombre: 'COMPRAS DE MERCADERÍAS', tipo: 'G' },
        { id: '601000000', nombre: 'COMPRAS DE MATERIAS PRIMAS', tipo: 'G' },
        { id: '602000000', nombre: 'COMPRAS DE OTROS APROVISIONAMIENTOS', tipo: 'G' },
        { id: '607000000', nombre: 'TRABAJOS REALIZADOS POR OTRAS EMPRESAS', tipo: 'G' },
        { id: '621000000', nombre: 'ARRENDAMIENTOS Y CÁNONES', tipo: 'G' },
        { id: '622000000', nombre: 'REPARACIONES Y CONSERVACIÓN', tipo: 'G' },
        { id: '623000000', nombre: 'SERVICIOS DE PROFESIONALES INDEPENDIENTES', tipo: 'G' },
        { id: '624000000', nombre: 'TRANSPORTES', tipo: 'G' },
        { id: '625000000', nombre: 'PRIMAS DE SEGUROS', tipo: 'G' },
        { id: '626000000', nombre: 'SERVICIOS BANCARIOS Y SIMILARES', tipo: 'G' },
        { id: '627000000', nombre: 'PUBLICIDAD, PUBLICACIONES Y RELACIONES PÚBLICAS', tipo: 'G' },
        { id: '628000000', nombre: 'SUMINISTROS', tipo: 'G' },
        { id: '629000000', nombre: 'OTROS SERVICIOS', tipo: 'G' }
      ];
      return res.json(cuentasPorDefecto);
    }

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas de gasto:', err);
    
    // En caso de error, devolver cuentas por defecto
    const cuentasPorDefecto = [
      { id: '600000000', nombre: 'COMPRAS DE MERCADERÍAS', tipo: 'G' },
      { id: '621000000', nombre: 'ARRENDAMIENTOS Y CÁNONES', tipo: 'G' },
      { id: '622000000', nombre: 'REPARACIONES Y CONSERVACIÓN', tipo: 'G' },
      { id: '623000000', nombre: 'SERVICIOS DE PROFESIONALES INDEPENDIENTES', tipo: 'G' },
      { id: '624000000', nombre: 'TRANSPORTES', tipo: 'G' },
      { id: '626000000', nombre: 'SERVICIOS BANCARIOS Y SIMILARES', tipo: 'G' },
      { id: '627000000', nombre: 'PUBLICIDAD, PUBLICACIONES Y RELACIONES PÚBLICAS', tipo: 'G' },
      { id: '628000000', nombre: 'SUMINISTROS', tipo: 'G' },
      { id: '629000000', nombre: 'OTROS SERVICIOS', tipo: 'G' }
    ];
    
    res.json(cuentasPorDefecto);
  }
});

// Endpoint para todo tipo de cuentas (si lo necesitas)
app.get('/api/cuentas', requireAuth, async (req, res) => {
  try {
    const { tipo } = req.query;
    let query = `
      SELECT 
        CodigoCuenta as id,
        Cuenta as nombre
      FROM PlanCuentas 
      WHERE CodigoEmpresa = 10000
        AND Bloqueo = 0
    `;
    
    if (tipo === 'gastos') {
      query += ` AND CodigoCuenta LIKE '6%'`;
    } else if (tipo === 'ingresos') {
      query += ` AND CodigoCuenta LIKE '7%'`;
    } else if (tipo === 'ventas') {
      query += ` AND CodigoCuenta LIKE '70%'`;
    }
    
    query += ` ORDER BY CodigoCuenta`;
    
    const result = await pool.request().query(query);
    console.log(`✅ Cuentas obtenidas (${tipo || 'todas'}): ${result.recordset.length} registros`);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas:', err);
    res.status(500).json({ 
      error: 'Error obteniendo cuentas',
      details: err.message 
    });
  }
});

// Endpoint para cuentas de ingreso (para FormPage6)
app.get('/api/cuentas/ingresos', requireAuth, async (req, res) => {
  try {
    console.log('🔍 Solicitando cuentas de ingreso...');
    
    const result = await pool.request().query(`
      SELECT 
        CodigoCuenta as id,
        Cuenta as nombre
      FROM PlanCuentas 
      WHERE CodigoEmpresa = 10000
        AND CodigoCuenta LIKE '7%'
        AND Bloqueo = 0
      ORDER BY CodigoCuenta
    `);

    console.log(`✅ Cuentas de ingreso obtenidas: ${result.recordset.length} registros`);
    
    // Si no hay resultados, devolver algunas cuentas por defecto
    if (result.recordset.length === 0) {
      console.log('⚠️ No se encontraron cuentas de ingreso, usando valores por defecto');
      const cuentasPorDefecto = [
        { id: '700000000', nombre: 'VENTAS DE MERCADERÍAS', tipo: 'I' },
        { id: '701000000', nombre: 'VENTAS DE PRODUCTOS TERMINADOS', tipo: 'I' },
        { id: '702000000', nombre: 'VENTAS DE PRODUCTOS SEMITERMINADOS', tipo: 'I' },
        { id: '703000000', nombre: 'VENTAS DE SUBPRODUCTOS Y RESIDUOS', tipo: 'I' },
        { id: '704000000', nombre: 'VENTAS DE ENVASES Y EMBALAJES', tipo: 'I' },
        { id: '705000000', nombre: 'PRESTACIONES DE SERVICIOS', tipo: 'I' },
        { id: '706000000', nombre: 'DESCUENTOS SOBRE VENTAS POR PRONTO PAGO', tipo: 'I' },
        { id: '708000000', nombre: 'DEVOLUCIONES DE VENTAS Y OPERACIONES SIMILARES', tipo: 'I' },
        { id: '709000000', nombre: 'RAPPELS SOBRE VENTAS', tipo: 'I' }
      ];
      return res.json(cuentasPorDefecto);
    }

    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error obteniendo cuentas de ingreso:', err);
    
    // En caso de error, devolver cuentas por defecto
    const cuentasPorDefecto = [
      { id: '705000000', nombre: 'PRESTACIONES DE SERVICIOS', tipo: 'I' },
      { id: '758000000', nombre: 'INGRESOS POR ARRENDAMIENTOS', tipo: 'I' },
      { id: '759000000', nombre: 'INGRESOS POR SERVICIOS PRESTADOS', tipo: 'I' },
      { id: '770000000', nombre: 'INGRESOS DIVERSOS DE GESTIÓN', tipo: 'I' }
    ];
    
    res.json(cuentasPorDefecto);
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
          AND sysGrupo = '10000' 
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
          AND sysGrupo = '10000' 
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
            AND CodigoEmpresa = 10000
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
    const cuentaCaja = '57000000';
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
      .input('CodigoEmpresa', sql.SmallInt, 10000)
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
        codigoEmpresa: 10000,
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
        .input('CodigoEmpresa', sql.SmallInt, 10000)
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
      .input('CodigoEmpresa', sql.SmallInt, 10000)
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
        .input('CodigoEmpresa', sql.SmallInt, 10000)
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
        .input('CodigoEmpresa', sql.SmallInt, 10000)
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
          AND sysGrupo = '10000' 
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
// 🧾 ENDPOINT COMPLETAMENTE CORREGIDO FORMPAGE4 - FACTURA IVA NO DEDUCIBLE 
// ============================================

app.post('/api/asiento/factura-iva-no-deducible', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('🔨 Iniciando creación de asiento FormPage4 (IVA NO DEDUCIBLE)...');
    
    // Obtener datos analíticos del usuario
    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion
    } = userAnalytics;

    console.log('📊 Datos analíticos del usuario:', {
      codigoCanal: codigoCanal || 'EM',
      codigoProyecto: codigoProyecto || 'CIMI', 
      codigoSeccion: codigoSeccion || 'ALM',
      codigoDepartamento: codigoDepartamento || 'ALM',
      idDelegacion: idDelegacion || 'AND'
    });
    
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const usuario = req.session.user?.usuario || 'Sistema';
    
    console.log(`📝 Asiento FormPage4 #${siguienteAsiento} - Usuario: ${usuario}`);
    
    const { 
      detalles, 
      proveedor, 
      serie, 
      numDocumento, 
      numFRA,
      fechaReg, 
      fechaFactura, 
      fechaOper,
      vencimiento, 
      concepto,
      cuentaGasto,
      analitico,
      archivo  // 🔥 Ahora solo recibe el NOMBRE del archivo
    } = req.body;

    // 🔥 SOLUCIÓN DEFINITIVA: Usar fechas como STRINGS directamente
    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaFacturaStr = formatDateWithoutTimezone(fechaFactura);
    const fechaOperStr = formatDateWithoutTimezone(fechaOper);
    const fechaVencimientoStr = formatDateWithoutTimezone(vencimiento);
    const fechaGrabacion = new Date();

    console.log('📅 FECHAS COMO STRING PARA INSERCIÓN:');
    console.log('- Fecha Asiento:', fechaAsientoStr);
    console.log('- Fecha Factura:', fechaFacturaStr);
    console.log('- Fecha Operación:', fechaOperStr);
    console.log('- Fecha Vencimiento:', fechaVencimientoStr);
    
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

    if (!vencimiento) {
      throw new Error('Fecha de vencimiento requerida');
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
            AND CodigoEmpresa = 10000
        `);
      
      if (cuentaContableResult.recordset.length > 0) {
        cuentaProveedorReal = cuentaContableResult.recordset[0].CodigoCuenta;
        console.log(`✅ Cuenta contable encontrada: ${cuentaProveedorReal}`);
      } else {
        console.warn(`⚠️ No se encontró cuenta contable para proveedor ${proveedor.codigoProveedor}, usando por defecto: ${cuentaProveedorReal}`);
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
      const iva = parseFloat(linea.cuotaIVA) || 0;
      const retencion = parseFloat(linea.cuotaRetencion) || 0;
      
      if (base > 0) {
        totalBase += base;
        totalIVA += iva;
        totalRetencion += retencion;
      }
    });
    
    const totalFactura = totalBase + totalIVA - totalRetencion;
    
    console.log(`💰 Totales: Base=${totalBase}, IVA=${totalIVA}, Retención=${totalRetencion}, Total=${totalFactura}`);
    console.log(`🧮 Cálculo: ${totalBase} + ${totalIVA} - ${totalRetencion} = ${totalFactura}`);
    
    const comentarioCorto = `${numFRA || ''} - ${concepto}`.trim().substring(0, 40);
    console.log(`📝 Comentario: ${comentarioCorto}`);
    
    // 🔥 LÍNEA 1: Proveedor (HABER) - CON FECHAS COMO STRING
    const movPosicionProveedor = uuidv4();
    console.log('Insertando línea 1: Proveedor con fechas como string...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), vencimiento ? 'P' : '')
      .input('FechaVencimiento', sql.VarChar, fechaVencimientoStr)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    console.log('✅ Línea 1 insertada con fechas como DATE');
    
    // CREAR EFECTO SI HAY FECHA DE VENCIMIENTO
    if (vencimiento) {
      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedor,
        ejercicio: 2025,
        codigoEmpresa: 10000,
        tipoMov: 0,
        asiento: siguienteAsiento,
        codigoCuenta: cuentaProveedorReal,
        contrapartida: '',
        fechaAsiento: fechaAsientoStr,
        fechaVencimiento: fechaVencimientoStr,
        importe: totalFactura,
        comentario: comentarioCorto,
        codigoClienteProveedor: proveedor.codigoProveedor,
        suFacturaNo: numDocumento,
        esPago: false
      });
    }
    
    // 🔥 LÍNEA 2: IVA NO DEDUCIBLE (DEBE) - CON FECHAS COMO STRING
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      console.log('Insertando línea 2: IVA no deducible con fechas como string...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
        .input('Contrapartida', sql.VarChar(15), cuentaProveedorReal)
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), '')
        .input('FechaVencimiento', sql.VarChar, null)
        .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);

      console.log('✅ Línea 2 insertada con fechas como DATE');
    }
    
    // 🔥 LÍNEA 3: Gasto/Compra (DEBE) - CON FECHAS COMO STRING
    const movPosicionGasto = uuidv4();
    console.log('Insertando línea 3: Gasto/Compra con fechas como string...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalBase)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    console.log('✅ Línea 3 insertada con fechas como DATE');
    
    // 🔥 LÍNEA 4: Retención (HABER) si existe - CON FECHAS COMO STRING
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      console.log('Insertando línea 4: Retención con fechas como string...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'H')
        .input('CodigoCuenta', sql.VarChar(15), '475100000')
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalRetencion)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), '')
        .input('FechaVencimiento', sql.VarChar, null)
        .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);

      console.log('✅ Línea 4 insertada con fechas como DATE');
    }

    // 🔥 MOVIMIENTOSFACTURAS - CON FECHAS COMO STRING
    console.log('Insertando en MovimientosFacturas con fechas como string...');
    
    const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('TipoMov', sql.TinyInt, 0)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('Año', sql.SmallInt, 2025)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('Serie', sql.VarChar(10), serie || '')
      .input('Factura', sql.Int, parseInt(numDocumento) || 0)
      .input('SuFacturaNo', sql.VarChar(40), (numFRA || '').substring(0, 40))
      .input('FechaFactura', sql.VarChar, fechaFacturaStr)
      .input('Fecha347', sql.VarChar, fechaFacturaStr)
      .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
      .input('TipoFactura', sql.VarChar(1), 'R')
      .input('CodigoCuentaFactura', sql.VarChar(15), cuentaProveedorReal)
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
         CONVERT(DATE, @FechaFactura), CONVERT(DATE, @Fecha347), @ImporteFactura, @TipoFactura, @CodigoCuentaFactura, @CifDni, @Nombre,
         @CodigoRetencion, @BaseRetencion, @PorcentajeRetencion, @ImporteRetencion)
      `);

    // 🔥 MOVIMIENTOSIVA
    if (totalIVA > 0 && movPosicionIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '21';
      console.log('Insertando en MovimientosIva...');
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 10000)
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

    // 🔥 DOCUMENTOASOCIADO - RUTA FIJA CORREGIDA
    if (archivo) {
      console.log('📎 Insertando documento asociado...');
      console.log(`- Nombre archivo recibido: ${archivo}`);
      
      // 🔥 RUTA FIJA CORRECTA - TODOS LOS ARCHIVOS EN DocumentosSage
      const rutaBase = 'C:\\Users\\sageinstall.MERIDIANOS-SSCC\\Desktop\\DocumentosSage\\';
      const rutaCompleta = rutaBase + archivo;
      
      console.log(`- Ruta completa construida: ${rutaCompleta}`);
      console.log(`- MovPosicion: ${movPosicionProveedor}`);
      console.log(`- CodigoTipoDocumento: PDF`);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);

        console.log('✅ Documento asociado insertado correctamente en DocumentosSage');
      } catch (error) {
        console.error('❌ Error insertando documento asociado:', error);
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }
    
    // Actualizar contador
    console.log('Actualizando contador...');
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    await transaction.commit();
    console.log(`🎉 Asiento FormPage4 #${siguienteAsiento} creado exitosamente`);
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento #${siguienteAsiento} - Factura Proveedor (IVA No Deducible) creado correctamente`,
      detalles: {
        lineas: totalRetencion > 0 ? 4 : 3,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura,
        documentoAsociado: archivo ? 'Sí' : 'No',
        datosAnaliticos: {
          codigoCanal: codigoCanal,
          codigoDepartamento: codigoDepartamento,
          codigoSeccion: codigoSeccion,
          codigoProyecto: codigoProyecto,
          idDelegacion: idDelegacion
        }
      }
    });
  } catch (err) {
    console.error('❌ Error detallado creando asiento FormPage4:', err);
    
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
// 🧾 ENDPOINT CORREGIDO FORMPAGE5 - PAGO PROVEEDOR CON GESTIÓN DE DOCUMENTOS
// ============================================

app.post('/api/asiento/pago-proveedor', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('🔨 Iniciando creación de asiento FormPage5 (Pago Proveedor) con Partes...');
    
    // Obtener datos analíticos del usuario
    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion,
      cuentaCaja
    } = userAnalytics;

    console.log('📊 Datos analíticos del usuario para inserción:', {
      codigoCanal: codigoCanal || 'EM',
      codigoProyecto: codigoProyecto || 'CIMI', 
      codigoSeccion: codigoSeccion || 'ALM',
      codigoDepartamento: codigoDepartamento || 'ALM',
      idDelegacion: idDelegacion || 'AND',
      cuentaCaja: cuentaCaja || '57000000'
    });
    
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const usuario = req.session.user?.usuario || 'Sistema';
    
    console.log(`📝 Asiento FormPage5 #${siguienteAsiento} - Usuario: ${usuario}`);
    
    const { 
      detalles, 
      proveedor, 
      serie, 
      numDocumento, 
      numFRA,
      fechaReg,
      fechaFactura, 
      fechaOper,
      concepto,
      cuentaGasto,
      analitico,
      archivo,  // 🔥 CORREGIDO: Solo recibe el nombre del archivo
      comentario,
      datosAnaliticos
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

    // 🔥 SOLUCIÓN: Usar fechas como STRINGS directamente
    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaFacturaStr = formatDateWithoutTimezone(fechaFactura);
    const fechaOperStr = formatDateWithoutTimezone(fechaOper);
    const fechaGrabacion = new Date();

    console.log('📅 FECHAS COMO STRING PARA INSERCIÓN:');
    console.log('- Fecha Asiento:', fechaAsientoStr);
    console.log('- Fecha Factura:', fechaFacturaStr);
    console.log('- Fecha Operación:', fechaOperStr);

    // Buscar cuenta proveedor real
    let cuentaProveedorReal = proveedor.cuentaProveedor || '400000000';
    try {
      const cuentaContableResult = await transaction.request()
        .input('codigoProveedor', sql.VarChar, proveedor.codigoProveedor)
        .query(`
          SELECT CodigoCuenta 
          FROM ClientesConta 
          WHERE CodigoClienteProveedor = @codigoProveedor
            AND CodigoEmpresa = 10000
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

    // 🔥 Comentarios diferenciados por partes
    const comentarioBase = comentario || `${numFRA || ''} - ${concepto}`.trim();
    const comentarioP1 = `P1 | ${comentarioBase}`.substring(0, 40);
    const comentarioP2 = `P2 | ${comentarioBase}`.substring(0, 40);

    console.log('📝 Comentarios diferenciados:');
    console.log('- Parte 1:', comentarioP1);
    console.log('- Parte 2:', comentarioP2);

    // ============================================
    // PARTE 1: FACTURA (3 líneas)
    // ============================================
    console.log('📋 Insertando PARTE 1 - Factura...');

    // 1. Línea: Gasto (DEBE) - Base Imponible
    const movPosicionGasto = uuidv4();
    console.log('Insertando línea 1 (P1): Gasto Base...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioP1)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalBase)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    // 2. Línea: IVA (DEBE) - MISMA CUENTA DE GASTO
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      console.log('Insertando línea 2 (P1): IVA en cuenta de gasto...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
        .input('Contrapartida', sql.VarChar(15), cuentaProveedorReal)
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioP1)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), '')
        .input('FechaVencimiento', sql.VarChar, null)
        .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);
    }

    // 3. Línea: Proveedor (HABER) - Total factura (base + IVA - retención)
    const movPosicionProveedor = uuidv4();
    console.log('Insertando línea 3 (P1): Proveedor...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioP1)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    // ============================================
    // 🔥 MOVIMIENTOSFACTURAS - CON FECHAS COMO STRING
    // ============================================
    console.log('Insertando en MovimientosFacturas (Parte 1)...');
    
    const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('TipoMov', sql.TinyInt, 0)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('Año', sql.SmallInt, 2025)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('Serie', sql.VarChar(10), serie || '')
      .input('Factura', sql.Int, parseInt(numDocumento) || 0)
      .input('SuFacturaNo', sql.VarChar(40), (numFRA || '').substring(0, 40))
      .input('FechaFactura', sql.VarChar, fechaFacturaStr)
      .input('Fecha347', sql.VarChar, fechaFacturaStr)
      .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
      .input('TipoFactura', sql.VarChar(1), 'R')
      .input('CodigoCuentaFactura', sql.VarChar(15), cuentaProveedorReal)
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
         CONVERT(DATE, @FechaFactura), CONVERT(DATE, @Fecha347), @ImporteFactura, @TipoFactura, @CodigoCuentaFactura, @CifDni, @Nombre,
         @CodigoRetencion, @BaseRetencion, @PorcentajeRetencion, @ImporteRetencion)
      `);

    console.log('✅ MovimientosFacturas insertado correctamente');

    // 🔥 MOVIMIENTOSIVA - CON FECHAS COMO STRING
    if (totalIVA > 0 && movPosicionIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '21';
      console.log('Insertando en MovimientosIva para IVA NO DEDUCIBLE...');
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 10000)
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
        .input('Deducible', sql.SmallInt, 0)  // 🔥 0 para IVA NO DEDUCIBLE
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
    }

    // ============================================
    // PARTE 2: PAGO EN CAJA (2 líneas)
    // ============================================
    console.log('📋 Insertando PARTE 2 - Pago en Caja...');

    // 4. Línea: Retención (HABER) si existe
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      console.log('Insertando línea 4 (P2): Retención...');
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'H')
        .input('CodigoCuenta', sql.VarChar(15), '475100000')
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioP2)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalRetencion)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), '')
        .input('FechaVencimiento', sql.VarChar, null)
        .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
        `);
    }

    // 5. Línea: Caja (DEBE) - Total a pagar (base + IVA - retención)
    const movPosicionCaja = uuidv4();
    console.log('Insertando línea 5 (P2): Caja...');
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja || '57000000')
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioP2)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    // 🔥 CORREGIDO: DOCUMENTOASOCIADO - RUTA FIJA CORRECTA
    if (archivo) {
      console.log('📎 Insertando documento asociado...');
      console.log(`- Nombre archivo recibido: ${archivo}`);
      
      // 🔥 RUTA FIJA CORRECTA - TODOS LOS ARCHIVOS EN DocumentosSage
      const rutaBase = 'C:\\Users\\sageinstall.MERIDIANOS-SSCC\\Desktop\\DocumentosSage\\';
      const rutaCompleta = rutaBase + archivo;
      
      console.log(`- Ruta completa construida: ${rutaCompleta}`);
      console.log(`- MovPosicion: ${movPosicionProveedor}`);
      console.log(`- CodigoTipoDocumento: PDF`);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);

        console.log('✅ Documento asociado insertado correctamente en DocumentosSage');
      } catch (error) {
        console.error('❌ Error insertando documento asociado:', error);
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }
    
    // Actualizar contador
    console.log('Actualizando contador...');
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    await transaction.commit();
    console.log(`🎉 Asiento FormPage5 #${siguienteAsiento} creado exitosamente con Partes 1 y 2`);
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento #${siguienteAsiento} - Factura con Pago en Caja creado correctamente (Partes 1 y 2)`,
      detalles: {
        lineas: 5,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura,
        cuentaGasto: cuentaGasto,
        documentoAsociado: archivo ? 'Sí' : 'No',
        movimientosIva: totalIVA > 0 ? 'Sí' : 'No',
        partes: {
          parte1: 'Factura (3 líneas)',
          parte2: 'Pago en Caja (2 líneas)'
        },
        datosAnaliticos: {
          codigoCanal: codigoCanal,
          codigoDepartamento: codigoDepartamento,
          codigoSeccion: codigoSeccion,
          codigoProyecto: codigoProyecto,
          idDelegacion: idDelegacion,
          cuentaCaja: cuentaCaja
        }
      }
    });
  } catch (err) {
    console.error('❌ Error detallado creando asiento FormPage5:', err);
    
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
// 💰 ENDPOINT FORMPAGE6 - INGRESO EN CAJA CON GESTIÓN DE DOCUMENTOS CORREGIDA
// ============================================

app.post('/api/asiento/ingreso-caja', requireAuth, async (req, res) => {
  let transaction;

  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('🔨 Iniciando creación de asiento FormPage6 (Ingreso en Caja)...');

    // Obtener datos analíticos del usuario
    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion,
      cuentaCaja
    } = userAnalytics;

    console.log('📊 Datos analíticos del usuario para inserción:', {
      codigoCanal: codigoCanal || 'EM',
      codigoProyecto: codigoProyecto || 'CIMI', 
      codigoSeccion: codigoSeccion || 'ALM',
      codigoDepartamento: codigoDepartamento || 'ALM',
      idDelegacion: idDelegacion || 'AND',
      cuentaCaja: cuentaCaja || '57000000'
    });

    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);

    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }

    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const usuario = req.session.user?.usuario || 'Sistema';

    console.log(`📝 Asiento FormPage6 #${siguienteAsiento} - Usuario: ${usuario}`);

    const {
      serie,
      numDocumento,
      fechaReg,
      concepto,
      comentario,
      analitico,
      cuentaIngreso,
      importe,
      archivo  // 🔥 CORREGIDO: Solo recibe el nombre del archivo
    } = req.body;

    // Validaciones
    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }
    if (!concepto) {
      throw new Error('Concepto requerido');
    }
    if (!importe || parseFloat(importe) <= 0) {
      throw new Error('Importe debe ser mayor a 0');
    }

    // 🔥 SOLUCIÓN: Usar fechas como STRINGS directamente
    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaGrabacion = new Date();

    console.log('📅 FECHAS COMO STRING PARA INSERCIÓN:');
    console.log('- Fecha Asiento:', fechaAsientoStr);

    const importeNum = parseFloat(importe);

    const comentarioCorto = comentario || concepto.substring(0, 40);

    // 🔥 LÍNEA 1: Caja (DEBE) - CON FECHAS COMO STRING
    const movPosicionCaja = uuidv4();
    console.log('Insertando línea 1: Caja con fechas como string...');

    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja || '57000000')
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    console.log('✅ Línea 1 insertada con fechas como DATE');

    // 🔥 LÍNEA 2: Ingreso (HABER) - CON FECHAS COMO STRING
    const movPosicionIngreso = uuidv4();
    console.log('Insertando línea 2: Ingreso con fechas como string...');

    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaIngreso)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    console.log('✅ Línea 2 insertada con fechas como DATE');

    // 🔥 CORREGIDO: DOCUMENTOASOCIADO - RUTA FIJA CORRECTA
    if (archivo) {
      console.log('📎 Insertando documento asociado para ingreso...');
      console.log(`- Nombre archivo recibido: ${archivo}`);
      
      // 🔥 RUTA FIJA CORRECTA - TODOS LOS ARCHIVOS EN DocumentosSage
      const rutaBase = 'C:\\Users\\sageinstall.MERIDIANOS-SSCC\\Desktop\\DocumentosSage\\';
      const rutaCompleta = rutaBase + archivo;
      
      console.log(`- Ruta completa construida: ${rutaCompleta}`);
      console.log(`- MovPosicion: ${movPosicionIngreso}`);
      console.log(`- CodigoTipoDocumento: PDF`);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);

        console.log('✅ Documento asociado insertado correctamente en DocumentosSage');
      } catch (error) {
        console.error('❌ Error insertando documento asociado:', error);
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }

    // Actualizar contador
    console.log('Actualizando contador...');
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);

    await transaction.commit();
    console.log(`🎉 Asiento FormPage6 #${siguienteAsiento} creado exitosamente`);

    res.json({
      success: true,
      asiento: siguienteAsiento,
      message: `Asiento #${siguienteAsiento} - Ingreso en Caja creado correctamente`,
      detalles: {
        lineas: 2,
        importe: importeNum,
        documentoAsociado: archivo ? 'Sí' : 'No',
        datosAnaliticos: {
          codigoCanal: codigoCanal,
          codigoDepartamento: codigoDepartamento,
          codigoSeccion: codigoSeccion,
          codigoProyecto: codigoProyecto,
          idDelegacion: idDelegacion,
          cuentaCaja: cuentaCaja
        }
      }
    });
  } catch (err) {
    console.error('❌ Error detallado creando asiento FormPage6:', err);

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
// 💰 ENDPOINT FORMPAGE7 - GASTO DIRECTO EN CAJA CON GESTIÓN DE DOCUMENTOS CORREGIDA
// ============================================

app.post('/api/asiento/gasto-directo-caja', requireAuth, async (req, res) => {
  let transaction;

  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('🔨 Iniciando creación de asiento FormPage7 (Gasto Directo en Caja)...');

    // Obtener datos analíticos del usuario
    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion,
      cuentaCaja
    } = userAnalytics;

    console.log('📊 Datos analíticos del usuario para inserción:', {
      codigoCanal: codigoCanal || '',
      codigoProyecto: codigoProyecto || '', 
      codigoSeccion: codigoSeccion || '',
      codigoDepartamento: codigoDepartamento || '',
      idDelegacion: idDelegacion || '',
      cuentaCaja: cuentaCaja || ''
    });

    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);

    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }

    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const usuario = req.session.user?.usuario || 'Sistema';

    console.log(`📝 Asiento FormPage7 #${siguienteAsiento} - Usuario: ${usuario}`);

    const {
      serie,
      numDocumento,
      fechaReg,
      concepto,
      comentario,
      analitico,
      cuentaGasto,
      importe,
      archivo  // 🔥 CORREGIDO: Solo recibe el nombre del archivo
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
    if (!importe || parseFloat(importe) <= 0) {
      throw new Error('Importe debe ser mayor a 0');
    }

    // 🔥 SOLUCIÓN: Usar fechas como STRINGS directamente
    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaGrabacion = new Date();

    console.log('📅 FECHAS COMO STRING PARA INSERCIÓN:');
    console.log('- Fecha Asiento:', fechaAsientoStr);

    const importeNum = parseFloat(importe);

    const comentarioCorto = comentario || concepto.substring(0, 40);

    // 🔥 LÍNEA 1: Gasto (DEBE) - CON FECHAS COMO STRING
    const movPosicionGasto = uuidv4();
    console.log('Insertando línea 1: Gasto con fechas como string...');

    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    console.log('✅ Línea 1 insertada con fechas como DATE');

    // 🔥 LÍNEA 2: Caja (HABER) - CON FECHAS COMO STRING
    const movPosicionCaja = uuidv4();
    console.log('Insertando línea 2: Caja con fechas como string...');

    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja || '57000000')
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || 'EM')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || 'ALM')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || 'ALM')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || 'CIMI')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || 'AND')
      .input('CodigoActividad', sql.VarChar(1), '')
      .input('Previsiones', sql.VarChar(1), '')
      .input('FechaVencimiento', sql.VarChar, null)
      .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
      .input('StatusConciliacion', sql.TinyInt, 0)
      .input('StatusSaldo', sql.TinyInt, 0)
      .input('StatusTraspaso', sql.TinyInt, 0)
      .input('CodigoUsuario', sql.TinyInt, 1)
      .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
      .query(`
        INSERT INTO Movimientos 
        (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
         Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
         StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
         StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion)
        VALUES 
        (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
         @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
         @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
         @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion)
      `);

    console.log('✅ Línea 2 insertada con fechas como DATE');

    // 🔥 CORREGIDO: DOCUMENTOASOCIADO - RUTA FIJA CORRECTA
    if (archivo) {
      console.log('📎 Insertando documento asociado para gasto...');
      console.log(`- Nombre archivo recibido: ${archivo}`);
      
      // 🔥 RUTA FIJA CORRECTA - TODOS LOS ARCHIVOS EN DocumentosSage
      const rutaBase = 'C:\\Users\\sageinstall.MERIDIANOS-SSCC\\Desktop\\DocumentosSage\\';
      const rutaCompleta = rutaBase + archivo;
      
      console.log(`- Ruta completa construida: ${rutaCompleta}`);
      console.log(`- MovPosicion: ${movPosicionGasto}`);
      console.log(`- CodigoTipoDocumento: PDF`);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);

        console.log('✅ Documento asociado insertado correctamente en DocumentosSage');
      } catch (error) {
        console.error('❌ Error insertando documento asociado:', error);
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }

    // Actualizar contador
    console.log('Actualizando contador...');
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = 2025 
          AND sysNombreContador = 'ASIENTOS'
      `);

    await transaction.commit();
    console.log(`🎉 Asiento FormPage7 #${siguienteAsiento} creado exitosamente`);

    res.json({
      success: true,
      asiento: siguienteAsiento,
      message: `Asiento #${siguienteAsiento} - Gasto Directo en Caja creado correctamente`,
      detalles: {
        lineas: 2,
        importe: importeNum,
        documentoAsociado: archivo ? 'Sí' : 'No',
        datosAnaliticos: {
          codigoCanal: codigoCanal,
          codigoDepartamento: codigoDepartamento,
          codigoSeccion: codigoSeccion,
          codigoProyecto: codigoProyecto,
          idDelegacion: idDelegacion,
          cuentaCaja: cuentaCaja
        }
      }
    });
  } catch (err) {
    console.error('❌ Error detallado creando asiento FormPage7:', err);

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
      WHERE ce.CodigoEmpresa = 10000
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
// 📋 ENDPOINTS PARA HISTORIAL DE ASIENTOS - FILTRADO POR CANAL
// ============================================

app.get('/api/historial-asientos', requireAuth, async (req, res) => {
  try {
    const pagina = parseInt(req.query.pagina) || 1;
    const porPagina = parseInt(req.query.porPagina) || 10;
    const codigoCanal = req.session.user?.codigoCanal;
    
    console.log('🔍 Solicitando historial:', { pagina, porPagina, codigoCanal });
    
    if (!codigoCanal) {
      return res.status(400).json({ 
        success: false,
        error: 'CodigoCanal no disponible en la sesión' 
      });
    }

    const offset = (pagina - 1) * porPagina;
    
    console.log(`📋 Obteniendo historial de asientos - Canal: ${codigoCanal}, Página: ${pagina}`);

    // Consulta principal con paginación
    const result = await pool.request()
      .input('CodigoCanal', sql.VarChar, codigoCanal)
      .input('Offset', sql.Int, offset)
      .input('PageSize', sql.Int, porPagina)
      .query(`
        SELECT 
          m.Asiento,
          m.Ejercicio,
          m.FechaAsiento,
          m.Comentario,
          m.CodigoCuenta,
          m.CargoAbono,
          m.ImporteAsiento,
          m.CodigoCanal,
          m.CodigoDepartamento,
          m.CodigoSeccion,
          m.CodigoProyecto,
          m.IdDelegacion,
          m.FechaGrabacion,
          COUNT(*) OVER() as TotalRegistros
        FROM Movimientos m
        WHERE m.CodigoEmpresa = 10000
          AND m.Ejercicio = 2025
          AND m.CodigoCanal = @CodigoCanal
          AND m.TipoMov = 0
        ORDER BY m.Asiento DESC, m.FechaGrabacion DESC
        OFFSET @Offset ROWS 
        FETCH NEXT @PageSize ROWS ONLY
      `);

    // Consulta para estadísticas
    const statsResult = await pool.request()
      .input('CodigoCanal', sql.VarChar, codigoCanal)
      .query(`
        SELECT 
          COUNT(*) as TotalAsientos,
          SUM(CASE WHEN CargoAbono = 'D' THEN ImporteAsiento ELSE 0 END) as TotalDebe,
          SUM(CASE WHEN CargoAbono = 'H' THEN ImporteAsiento ELSE 0 END) as TotalHaber
        FROM Movimientos 
        WHERE CodigoEmpresa = 10000
          AND Ejercicio = 2025
          AND CodigoCanal = @CodigoCanal
          AND TipoMov = 0
      `);

    const totalRegistros = result.recordset.length > 0 ? result.recordset[0].TotalRegistros : 0;
    const totalPaginas = Math.ceil(totalRegistros / porPagina);

    // Agrupar movimientos por asiento
    const asientosAgrupados = {};
    result.recordset.forEach(movimiento => {
      const asiento = movimiento.Asiento;
      if (!asientosAgrupados[asiento]) {
        asientosAgrupados[asiento] = {
          asiento: asiento,
          ejercicio: movimiento.Ejercicio,
          fechaAsiento: movimiento.FechaAsiento,
          comentario: movimiento.Comentario,
          codigoCanal: movimiento.CodigoCanal,
          fechaGrabacion: movimiento.FechaGrabacion,
          movimientos: [],
          totalDebe: 0,
          totalHaber: 0
        };
      }
      
      asientosAgrupados[asiento].movimientos.push({
        codigoCuenta: movimiento.CodigoCuenta,
        cargoAbono: movimiento.CargoAbono,
        importeAsiento: parseFloat(movimiento.ImporteAsiento),
        codigoDepartamento: movimiento.CodigoDepartamento,
        codigoSeccion: movimiento.CodigoSeccion,
        codigoProyecto: movimiento.CodigoProyecto,
        idDelegacion: movimiento.IdDelegacion
      });

      // Calcular totales
      if (movimiento.CargoAbono === 'D') {
        asientosAgrupados[asiento].totalDebe += parseFloat(movimiento.ImporteAsiento);
      } else {
        asientosAgrupados[asiento].totalHaber += parseFloat(movimiento.ImporteAsiento);
      }
    });

    const asientos = Object.values(asientosAgrupados);

    console.log(`✅ Historial obtenido: ${asientos.length} asientos de ${totalRegistros} totales`);

    res.json({
      success: true,
      asientos,
      paginacion: {
        paginaActual: pagina,
        porPagina: porPagina,
        totalRegistros,
        totalPaginas
      },
      estadisticas: {
        totalAsientos: statsResult.recordset[0]?.TotalAsientos || 0,
        totalDebe: parseFloat(statsResult.recordset[0]?.TotalDebe || 0),
        totalHaber: parseFloat(statsResult.recordset[0]?.TotalHaber || 0)
      }
    });

  } catch (err) {
    console.error('❌ Error obteniendo historial de asientos:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo historial de asientos: ' + err.message 
    });
  }
});

// Endpoint para buscar asientos específicos
app.get('/api/historial-asientos/buscar', requireAuth, async (req, res) => {
  try {
    const { asiento, fechaDesde, fechaHasta, cuenta } = req.query;
    const codigoCanal = req.session.user?.codigoCanal;
    
    console.log('🔍 Búsqueda de asientos:', { asiento, fechaDesde, fechaHasta, cuenta, codigoCanal });
    
    if (!codigoCanal) {
      return res.status(400).json({ 
        success: false,
        error: 'CodigoCanal no disponible en la sesión' 
      });
    }

    let query = `
      SELECT 
        m.Asiento,
        m.Ejercicio,
        m.FechaAsiento,
        m.Comentario,
        m.CodigoCuenta,
        m.CargoAbono,
        m.ImporteAsiento,
        m.CodigoCanal,
        m.CodigoDepartamento,
        m.CodigoSeccion,
        m.CodigoProyecto,
        m.IdDelegacion,
        m.FechaGrabacion
      FROM Movimientos m
      WHERE m.CodigoEmpresa = 10000
        AND m.Ejercicio = 2025
        AND m.CodigoCanal = @CodigoCanal
        AND m.TipoMov = 0
    `;

    const request = pool.request().input('CodigoCanal', sql.VarChar, codigoCanal);

    if (asiento) {
      query += ` AND m.Asiento = @Asiento`;
      request.input('Asiento', sql.Int, parseInt(asiento));
    }
    
    if (fechaDesde) {
      query += ` AND m.FechaAsiento >= @FechaDesde`;
      request.input('FechaDesde', sql.Date, new Date(fechaDesde));
    }
    
    if (fechaHasta) {
      query += ` AND m.FechaAsiento <= @FechaHasta`;
      request.input('FechaHasta', sql.Date, new Date(fechaHasta));
    }
    
    if (cuenta) {
      query += ` AND m.CodigoCuenta LIKE @Cuenta`;
      request.input('Cuenta', sql.VarChar, cuenta + '%');
    }

    query += ` ORDER BY m.Asiento DESC, m.FechaGrabacion DESC`;

    const result = await request.query(query);

    // Agrupar movimientos por asiento
    const asientosAgrupados = {};
    result.recordset.forEach(movimiento => {
      const asiento = movimiento.Asiento;
      if (!asientosAgrupados[asiento]) {
        asientosAgrupados[asiento] = {
          asiento: asiento,
          ejercicio: movimiento.Ejercicio,
          fechaAsiento: movimiento.FechaAsiento,
          comentario: movimiento.Comentario,
          codigoCanal: movimiento.CodigoCanal,
          fechaGrabacion: movimiento.FechaGrabacion,
          movimientos: [],
          totalDebe: 0,
          totalHaber: 0
        };
      }
      
      asientosAgrupados[asiento].movimientos.push({
        codigoCuenta: movimiento.CodigoCuenta,
        cargoAbono: movimiento.CargoAbono,
        importeAsiento: parseFloat(movimiento.ImporteAsiento),
        codigoDepartamento: movimiento.CodigoDepartamento,
        codigoSeccion: movimiento.CodigoSeccion,
        codigoProyecto: movimiento.CodigoProyecto,
        idDelegacion: movimiento.IdDelegacion
      });

      if (movimiento.CargoAbono === 'D') {
        asientosAgrupados[asiento].totalDebe += parseFloat(movimiento.ImporteAsiento);
      } else {
        asientosAgrupados[asiento].totalHaber += parseFloat(movimiento.ImporteAsiento);
      }
    });

    const asientos = Object.values(asientosAgrupados);

    res.json({
      success: true,
      asientos,
      totalRegistros: asientos.length
    });

  } catch (err) {
    console.error('❌ Error buscando asientos:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error buscando asientos: ' + err.message 
    });
  }
});

// ============================================
// 📁 SERVIR ARCHIVOS ESTÁTICOS - CONFIGURACIÓN MEJORADA
// ============================================

if (hasFrontend) {
  console.log('📁 Configurando servidor de archivos estáticos...');
  
  // Servir archivos estáticos del frontend
  app.use(express.static(frontendPath, {
    index: false, // No servir index.html automáticamente
    etag: true,
    lastModified: true,
    maxAge: '1d'
  }));
  
  // Middleware para logging de requests estáticos
  app.use((req, res, next) => {
    if (req.path.startsWith('/static/') || 
        req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|txt)$/)) {
      console.log(`📄 Sirviendo archivo estático: ${req.path}`);
    }
    next();
  });

  // Manejar rutas SPA - para React Router
  app.get(['/', '/dashboard', '/form4', '/form5', '/form6', '/form7', '/historial', '/login'], (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log(`🎯 Sirviendo index.html para ruta: ${req.path}`);
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ 
        error: 'Frontend no configurado correctamente',
        message: 'index.html no encontrado'
      });
    }
  });

  // Para cualquier otra ruta que no sea API, servir el frontend
  app.get('*', (req, res, next) => {
    // Si es una ruta de API, continuar
    if (req.path.startsWith('/api') || req.path.startsWith('/login') || req.path.startsWith('/logout')) {
      return next();
    }
    
    // Para cualquier otra ruta, servir el frontend
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log(`🔄 Redirigiendo ruta SPA: ${req.path} -> index.html`);
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: 'Frontend no disponible',
        availableRoutes: ['/api/*', '/login', '/logout']
      });
    }
  });
  
  console.log('✅ Frontend configurado correctamente en:', frontendPath);
} else {
  // Modo solo API
  app.get('/', (req, res) => {
    res.json({
      message: '🚀 Servidor Backend Sage200 Contabilidad',
      status: 'online',
      mode: 'api-only',
      frontend: 'no-detectado',
      instructions: 'Para servir el frontend, construya la aplicación React y colóquela en la carpeta build/',
      endpoints: {
        auth: 'POST /login, POST /logout, GET /api/session',
        providers: 'GET /api/proveedores, GET /api/proveedores/cuentas',
        accounting: 'POST /api/asiento/factura, POST /api/asiento/ingreso-caja, POST /api/asiento/gasto-directo-caja',
        history: 'GET /api/historial-asientos',
        counter: 'GET /api/contador'
      }
    });
  });
}

// ============================================
// 🚀 INICIAR SERVIDOR MEJORADO
// ============================================

const startServer = async () => {
  try {
    // Conectar a la base de datos
    console.log('🔗 Conectando a la base de datos Sage200...');
    pool = await sql.connect(dbConfig);
    console.log('✅ Conexión a BD establecida');

    // Iniciar servidor
    app.listen(PORT, HOST, () => {
      console.log('\n🎉 SERVIDOR INICIADO EXITOSAMENTE');
      console.log('==================================');
      console.log(`📍 Host: ${HOST}`);
      console.log(`📍 Puerto: ${PORT}`);
      console.log(`🌐 URL Red: http://192.168.200.236:${PORT}`);
      console.log(`📁 Frontend: ${hasFrontend ? 'SIRVIENDO DESDE: ' + frontendPath : 'NO DETECTADO'}`);
      console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log('==================================\n');
    });
    
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error.message);
    process.exit(1);
  }
};

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});

// Iniciar servidor
startServer();