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
  
  try {
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    
    return result;
    
  } catch (error) {
    return null;
  }
};

// ============================================
// 📁 CONFIGURACIÓN MEJORADA DE FRONTEND
// ============================================

const getFrontendPath = () => {
  const possiblePaths = [
    path.join(__dirname, 'build'),
    path.join(__dirname, 'dist'),
    path.join(__dirname, '../client/build'),
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, '../frontend/build'),
    path.join(__dirname, '../frontend/dist'),
    path.join(__dirname, 'public'),
    path.join(__dirname, '../public'),
    path.join(__dirname, '../build'),
    path.join(process.cwd(), 'build'),
    path.join(process.cwd(), 'dist')
  ];

  for (const frontendPath of possiblePaths) {
    if (fs.existsSync(frontendPath)) {
      const indexPath = path.join(frontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return frontendPath;
      }
    }
  }
  
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

const connectDB = async () => {
  try {
    pool = await sql.connect(dbConfig);
  } catch (err) {
    process.exit(1);
  }
};

connectDB();


// ============================================
// ⚙️ CONFIGURACIÓN CORS MEJORADA
// ============================================

const corsOptions = {
  origin: function (origin, callback) {
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
      `http://${HOST}:${PORT}`,
      `http://${HOST}`
    ];
    
    if (!origin || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie', 'Set-Cookie']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'sage200-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// ============================================
// 🌐 FUNCIÓN HELPER PARA RUTAS DE RED
// ============================================

function construirRutaRed(nombreArchivo) {
  // Ruta base de red
  const rutaBaseRed = '\\\\192.168.200.235\\control\\';
  
  // Si el nombreArchivo ya es una ruta completa de red, úsalo directamente
  if (nombreArchivo && nombreArchivo.startsWith('\\\\192.168.200.235\\')) {
    return nombreArchivo;
  }
  
  // Si solo es el nombre del archivo, concaténalo con la ruta base
  return rutaBaseRed + (nombreArchivo || '');
}

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
        codigoCanal: userData.CodigoCanal || '',
        codigoProyecto: userData.CodigoProyecto || '',
        codigoSeccion: userData.CodigoSeccion || '',
        codigoDepartamento: userData.CodigoDepartamento || '',
        cuentaCaja: userData.CuentaCaja || '',
        idDelegacion: userData.IdDelegacion || ''
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

// ============================================
// 🟢 ENDPOINT PARA VERIFICAR SESIÓN
// ============================================

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
// 🔄 FUNCIÓN AUXILIAR PARA EFECTOS - VERSIÓN CORREGIDA DEFINITIVA
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

  if (!fechaVencimiento) {
    return null;
  }

  try {
    // ✅ 1. TRANSFORMAR CÓDIGOS ESPECIALES Y OBTENER DATOS CORRECTOS
    let codigoClienteProveedorFinal = codigoClienteProveedor;
    let cuentaFinal = codigoCuenta;
    let remesaHabitual = '572000000'; // Contrapartida por defecto

    // Casos especiales de nuevo proveedor/acreedor
    if (codigoClienteProveedor === '4000') {
      codigoClienteProveedorFinal = '400000000';
      cuentaFinal = '400000000'; // ✅ Cuenta para nuevo proveedor
    } else if (codigoClienteProveedor === '4100') {
      codigoClienteProveedorFinal = '410000000';
      cuentaFinal = '410000000'; // ✅ Cuenta para nuevo acreedor
    } else {
      // ✅ Para proveedores existentes, buscar en ClientesConta
      const clienteContaResult = await transaction.request()
        .input('CodigoClienteProveedor', sql.VarChar(15), codigoClienteProveedor)
        .input('CodigoEmpresa', sql.SmallInt, codigoEmpresa || 10000)
        .query(`
          SELECT CodigoCuenta, RemesaHabitual 
          FROM ClientesConta 
          WHERE CodigoClienteProveedor = @CodigoClienteProveedor
            AND CodigoEmpresa = @CodigoEmpresa
        `);
      
      if (clienteContaResult.recordset.length > 0) {
        const clienteConta = clienteContaResult.recordset[0];
        // ✅ Usar la cuenta contable específica del proveedor
        cuentaFinal = clienteConta.CodigoCuenta || codigoCuenta;
        // ✅ Usar remesa habitual si existe, si no 572000000
        if (clienteConta.RemesaHabitual && clienteConta.RemesaHabitual.trim() !== '') {
          remesaHabitual = clienteConta.RemesaHabitual.trim();
        }
      } else {
        // Si no se encuentra en ClientesConta, usar la cuenta proporcionada
        cuentaFinal = codigoCuenta;
      }
    }

    if (esPago) {
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
        return true;
      }

      const insertResult = await transaction.request()
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
        .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
        .input('Prevision', sql.VarChar(1), 'P')
        .input('Aceptado', sql.SmallInt, -1)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('Comentario', sql.VarChar(40), comentario || '')
        .input('CodigoClienteProveedor', sql.VarChar(15), codigoClienteProveedorFinal)
        .input('CodigoCuenta', sql.VarChar(15), cuentaFinal)
        .input('Contrapartida', sql.VarChar(15), remesaHabitual)
        .input('FechaEmision', sql.VarChar, fechaAsiento)
        .input('FechaFactura', sql.VarChar, fechaAsiento)
        .input('FechaVencimiento', sql.VarChar, fechaVencimiento)
        .input('EnEuros_', sql.SmallInt, -1)
        .input('ImporteEfecto', sql.Decimal(18, 2), importe)
        .input('ImportePendiente', sql.Decimal(18, 2), importe)
        .input('SuFacturaNo', sql.VarChar(40), suFacturaNo || '')
        .input('CodigoEmpresa', sql.SmallInt, codigoEmpresa || 10000)
        .query(`
          INSERT INTO CarteraEfectos 
          (IdDelegacion, MovPosicion, Prevision, Aceptado, Ejercicio, Comentario,
           CodigoClienteProveedor, CodigoCuenta, Contrapartida, FechaEmision, FechaFactura, FechaVencimiento, EnEuros_,
           ImporteEfecto, ImportePendiente, SuFacturaNo, CodigoEmpresa)
          VALUES 
          (@IdDelegacion, @MovPosicion, @Prevision, @Aceptado, @Ejercicio, @Comentario,
           @CodigoClienteProveedor, @CodigoCuenta, @Contrapartida, CONVERT(DATE, @FechaEmision), CONVERT(DATE, @FechaFactura), CONVERT(DATE, @FechaVencimiento), @EnEuros_,
           @ImporteEfecto, @ImportePendiente, @SuFacturaNo, @CodigoEmpresa)
        `);
      
      return true;
    }
  } catch (error) {
    throw new Error(`Error gestionando efecto: ${error.message}`);
  }
};

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
      WHERE CodigoEmpresa = 10000
        AND BajaEmpresaLc = 0
      ORDER BY RazonSocial
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ 
      error: 'Error obteniendo proveedores',
      details: err.message 
    });
  }
});

app.get('/api/proveedores/cuentas', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        p.CodigoProveedor as codigo,
        p.RazonSocial as nombre,
        ISNULL(cc.CodigoCuenta, '40000000') as cuenta
      FROM Proveedores p
      LEFT JOIN ClientesConta cc ON p.CodigoProveedor = cc.CodigoClienteProveedor
        AND cc.CodigoEmpresa = 10000
      WHERE p.CodigoEmpresa = 10000
        AND p.BajaEmpresaLc = 0
      ORDER BY p.RazonSocial
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ 
      error: 'Error obteniendo cuentas de proveedores',
      details: err.message 
    });
  }
});

app.get('/api/cuentas/gastos', requireAuth, async (req, res) => {
  try {
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

    if (result.recordset.length === 0) {
      const cuentasPorDefecto = [
        { id: '60000000', nombre: 'COMPRAS DE MERCADERÍAS', tipo: 'G' },
        { id: '60100000', nombre: 'COMPRAS DE MATERIAS PRIMAS', tipo: 'G' },
        { id: '60200000', nombre: 'COMPRAS DE OTROS APROVISIONAMIENTOS', tipo: 'G' },
        { id: '60700000', nombre: 'TRABAJOS REALIZADOS POR OTRAS EMPRESAS', tipo: 'G' },
        { id: '62100000', nombre: 'ARRENDAMIENTOS Y CÁNONES', tipo: 'G' },
        { id: '62200000', nombre: 'REPARACIONES Y CONSERVACIÓN', tipo: 'G' },
        { id: '62300000', nombre: 'SERVICIOS DE PROFESIONALES INDEPENDIENTES', tipo: 'G' },
        { id: '62400000', nombre: 'TRANSPORTES', tipo: 'G' },
        { id: '62500000', nombre: 'PRIMAS DE SEGUROS', tipo: 'G' },
        { id: '62600000', nombre: 'SERVICIOS BANCARIOS Y SIMILARES', tipo: 'G' },
        { id: '62700000', nombre: 'PUBLICIDAD, PUBLICACIONES Y RELACIONES PÚBLICAS', tipo: 'G' },
        { id: '62800000', nombre: 'SUMINISTROS', tipo: 'G' },
        { id: '62900000', nombre: 'OTROS SERVICIOS', tipo: 'G' }
      ];
      return res.json(cuentasPorDefecto);
    }

    res.json(result.recordset);
  } catch (err) {
    const cuentasPorDefecto = [
      { id: '60000000', nombre: 'COMPRAS DE MERCADERÍAS', tipo: 'G' },
      { id: '62100000', nombre: 'ARRENDAMIENTOS Y CÁNONES', tipo: 'G' },
      { id: '62200000', nombre: 'REPARACIONES Y CONSERVACIÓN', tipo: 'G' },
      { id: '62300000', nombre: 'SERVICIOS DE PROFESIONALES INDEPENDIENTES', tipo: 'G' },
      { id: '62400000', nombre: 'TRANSPORTES', tipo: 'G' },
      { id: '62600000', nombre: 'SERVICIOS BANCARIOS Y SIMILARES', tipo: 'G' },
      { id: '62700000', nombre: 'PUBLICIDAD, PUBLICACIONES Y RELACIONES PÚBLICAS', tipo: 'G' },
      { id: '62800000', nombre: 'SUMINISTROS', tipo: 'G' },
      { id: '62900000', nombre: 'OTROS SERVICIOS', tipo: 'G' }
    ];
    
    res.json(cuentasPorDefecto);
  }
});

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
    
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ 
      error: 'Error obteniendo cuentas',
      details: err.message 
    });
  }
});

app.get('/api/cuentas/ingresos', requireAuth, async (req, res) => {
  try {
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

    if (result.recordset.length === 0) {
      const cuentasPorDefecto = [
        { id: '70000000', nombre: 'VENTAS DE MERCADERÍAS', tipo: 'I' },
        { id: '70100000', nombre: 'VENTAS DE PRODUCTOS TERMINADOS', tipo: 'I' },
        { id: '70200000', nombre: 'VENTAS DE PRODUCTOS SEMITERMINADOS', tipo: 'I' },
        { id: '70300000', nombre: 'VENTAS DE SUBPRODUCTOS Y RESIDUOS', tipo: 'I' },
        { id: '70400000', nombre: 'VENTAS DE ENVASES Y EMBALAJES', tipo: 'I' },
        { id: '70500000', nombre: 'PRESTACIONES DE SERVICIOS', tipo: 'I' },
        { id: '70600000', nombre: 'DESCUENTOS SOBRE VENTAS POR PRONTO PAGO', tipo: 'I' },
        { id: '70800000', nombre: 'DEVOLUCIONES DE VENTAS Y OPERACIONES SIMILARES', tipo: 'I' },
        { id: '70900000', nombre: 'RAPPELS SOBRE VENTAS', tipo: 'I' }
      ];
      return res.json(cuentasPorDefecto);
    }

    res.json(result.recordset);
  } catch (err) {
    const cuentasPorDefecto = [
      { id: '70500000', nombre: 'PRESTACIONES DE SERVICIOS', tipo: 'I' },
      { id: '75800000', nombre: 'INGRESOS POR ARRENDAMIENTOS', tipo: 'I' },
      { id: '75900000', nombre: 'INGRESOS POR SERVICIOS PRESTADOS', tipo: 'I' },
      { id: '77000000', nombre: 'INGRESOS DIVERSOS DE GESTIÓN', tipo: 'I' }
    ];
    
    res.json(cuentasPorDefecto);
  }
});

// ============================================
// 📋 ENDPOINTS DE TIPOS DE IVA Y RETENCIÓN
// ============================================

app.get('/api/tipos-iva', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT CodigoIva, Iva, [%Iva] as PorcentajeIva
      FROM TiposIva 
      WHERE CodigoTerritorio = '0'
      ORDER BY CodigoIva
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ 
      error: 'Error obteniendo tipos de IVA',
      details: err.message 
    });
  }
});

app.get('/api/tipos-retencion', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT CodigoRetencion, Retencion, [%Retencion] as PorcentajeRetencion
      FROM TiposRetencion
      ORDER BY CodigoRetencion
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ 
      error: 'Error obteniendo tipos de retención',
      details: err.message 
    });
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
    res.json({ contador });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo contador' });
  }
});

// ============================================
// 🧾 ENDPOINT FORMPAGE4 - FACTURA IVA NO DEDUCIBLE CORREGIDO
// ============================================

app.post('/api/asiento/factura-iva-no-deducible', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion
    } = userAnalytics;
    
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
      archivo
    } = req.body;

    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaFacturaStr = formatDateWithoutTimezone(fechaFactura);
    const fechaOperStr = formatDateWithoutTimezone(fechaOper);
    const fechaVencimientoStr = formatDateWithoutTimezone(vencimiento);
    const fechaGrabacion = new Date();
    
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
      }
    } catch (error) {
      throw new Error(`Error buscando cuenta contable: ${error.message}`);
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
    
    const totalFactura = totalBase + totalIVA - totalRetencion;
    
    const comentarioCorto = `${concepto}`.trim().substring(0, 40);
    
    const movPosicionProveedor = uuidv4();
    
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
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ GESTIÓN DE EFECTOS CORREGIDA
    if (vencimiento) {
      // OBTENER REMESA HABITUAL DESDE CLIENTESCONTA PARA PROVEEDORES EXISTENTES
      let remesaHabitual = '572000000'; // Valor por defecto
      
      try {
        // Solo buscar para proveedores existentes, no para nuevos (4000/4100)
        if (proveedor.codigoProveedor !== '4000' && proveedor.codigoProveedor !== '4100') {
          const remesaResult = await transaction.request()
            .input('CodigoClienteProveedor', sql.VarChar(15), proveedor.codigoProveedor)
            .input('CodigoEmpresa', sql.SmallInt, 10000)
            .query(`
              SELECT RemesaHabitual 
              FROM ClientesConta 
              WHERE CodigoClienteProveedor = @CodigoClienteProveedor
                AND CodigoEmpresa = @CodigoEmpresa
            `);
          
          if (remesaResult.recordset.length > 0 && remesaResult.recordset[0].RemesaHabitual) {
            remesaHabitual = remesaResult.recordset[0].RemesaHabitual.trim();
          }
        }
      } catch (error) {
        console.log('Usando remesa por defecto:', remesaHabitual);
      }

      // ✅ LLAMADA A GESTIONAREFECTO CON DATOS TRANSFORMADOS
      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedor,
        ejercicio: 2025,
        codigoEmpresa: 10000,
        idDelegacion: idDelegacion || '',
        fechaAsiento: fechaAsientoStr,
        fechaVencimiento: fechaVencimientoStr,
        importe: totalFactura,
        comentario: comentarioCorto,
        codigoClienteProveedor: proveedor.codigoProveedor,
        suFacturaNo: numDocumento,
        codigoCuenta: cuentaProveedorReal,
        esPago: false
      });
    }
    
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
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
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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
    
    const movPosicionGasto = uuidv4();
    
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
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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
    
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      
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
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ TRANSFORMAR CÓDIGOS PARA MOVIMIENTOSFACTURAS
    let codigoFacturaParaMovimientos = proveedor.codigoProveedor;
    let cuentaFacturaParaMovimientos = cuentaProveedorReal;

    if (proveedor.codigoProveedor === '4000') {
      codigoFacturaParaMovimientos = '400000000';
      cuentaFacturaParaMovimientos = '400000000';
    } else if (proveedor.codigoProveedor === '4100') {
      codigoFacturaParaMovimientos = '410000000';
      cuentaFacturaParaMovimientos = '410000000';
    }

    const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('TipoMov', sql.TinyInt, 0)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('Año', sql.SmallInt, 2025)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
      .input('Serie', sql.VarChar(10), serie || '')
      .input('Factura', sql.Int, parseInt(numDocumento) || 0)
      .input('SuFacturaNo', sql.VarChar(40), (numFRA || '').substring(0, 40))
      .input('FechaFactura', sql.VarChar, fechaFacturaStr)
      .input('Fecha347', sql.VarChar, fechaFacturaStr)
      .input('FechaOperacion', sql.VarChar, fechaOperStr)
      .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
      .input('TipoFactura', sql.VarChar(1), 'R')
      .input('CodigoCuentaFactura', sql.VarChar(15), cuentaFacturaParaMovimientos)
      .input('CifDni', sql.VarChar(13), (proveedor.cif || '').substring(0, 13))
      .input('Nombre', sql.VarChar(35), (proveedor.nombre || '').substring(0, 35))
      .input('CodigoRetencion', sql.SmallInt, totalRetencion > 0 ? parseInt(retencionPrincipal) : 0)
      .input('BaseRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? totalBase : 0)
      .input('PorcentajeRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? parseFloat(retencionPrincipal) : 0)
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

    if (totalIVA > 0 && movPosicionIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '';
      
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

    // ✅ MODIFICACIÓN: USAR RUTA DE RED PARA ARCHIVOS
    if (archivo) {
      const rutaCompleta = construirRutaRed(archivo);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }
    
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
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
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
// 🧾 ENDPOINT FORMPAGE5 - PAGO PROVEEDOR CORREGIDO CON CONTRAPARTIDAS
// ============================================

app.post('/api/asiento/pago-proveedor', requireAuth, async (req, res) => {
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion,
      cuentaCaja
    } = userAnalytics;
    
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
      archivo,
      comentario
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

    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaFacturaStr = formatDateWithoutTimezone(fechaFactura);
    const fechaOperStr = formatDateWithoutTimezone(fechaOper);
    const fechaGrabacion = new Date();

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
      }
    } catch (error) {
      throw new Error(`Error buscando cuenta contable: ${error.message}`);
    }

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

    const comentarioBase = comentario || `${numFRA || ''} - ${concepto}`.trim();
    const comentarioCorto = comentarioBase.substring(0, 40);

    // ✅ LÍNEA 1 - PROVEEDOR (HABER) - FACTURA - CONTRAPARTIDA: CAJA
    const movPosicionProveedorHaber = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), cuentaCaja) // ✅ CONTRAPARTIDA: CAJA
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ LÍNEA 2 - GASTO (BASE) - DEBE - SIN CONTRAPARTIDA
    const movPosicionGastoBase = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGastoBase)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '') // ✅ SIN CONTRAPARTIDA
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalBase)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ LÍNEA 3 - GASTO (IVA) - DEBE - SIN CONTRAPARTIDA
    let movPosicionGastoIVA = null;
    if (totalIVA > 0) {
      movPosicionGastoIVA = uuidv4();
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionGastoIVA)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
        .input('Contrapartida', sql.VarChar(15), '') // ✅ SIN CONTRAPARTIDA
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ LÍNEA 4 - CAJA (HABER) - PAGO - CONTRAPARTIDA: PROVEEDOR
    const movPosicionCaja = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja)
      .input('Contrapartida', sql.VarChar(15), cuentaProveedorReal) // ✅ CONTRAPARTIDA: PROVEEDOR
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ LÍNEA 5 - PROVEEDOR (DEBE) - PAGO - CONTRAPARTIDA: CAJA
    const movPosicionProveedorDebe = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorDebe)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), cuentaCaja) // ✅ CONTRAPARTIDA: CAJA
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ LÍNEA 6 - RETENCIÓN (HABER) - SIN CONTRAPARTIDA
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'H')
        .input('CodigoCuenta', sql.VarChar(15), '475100000')
        .input('Contrapartida', sql.VarChar(15), '') // ✅ SIN CONTRAPARTIDA
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalRetencion)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ TRANSFORMAR CÓDIGOS PARA MOVIMIENTOSFACTURAS
    let codigoFacturaParaMovimientos = proveedor.codigoProveedor;
    let cuentaFacturaParaMovimientos = cuentaProveedorReal;

    if (proveedor.codigoProveedor === '4000') {
      codigoFacturaParaMovimientos = '400000000';
      cuentaFacturaParaMovimientos = '400000000';
    } else if (proveedor.codigoProveedor === '4100') {
      codigoFacturaParaMovimientos = '410000000';
      cuentaFacturaParaMovimientos = '410000000';
    }

    const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
      .input('TipoMov', sql.TinyInt, 0)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('Año', sql.SmallInt, 2025)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
      .input('Serie', sql.VarChar(10), serie || '')
      .input('Factura', sql.Int, parseInt(numDocumento) || 0)
      .input('SuFacturaNo', sql.VarChar(40), (numFRA || '').substring(0, 40))
      .input('FechaFactura', sql.VarChar, fechaFacturaStr)
      .input('Fecha347', sql.VarChar, fechaFacturaStr)
      .input('FechaOperacion', sql.VarChar, fechaOperStr)
      .input('ImporteFactura', sql.Decimal(18, 2), totalFactura)
      .input('TipoFactura', sql.VarChar(1), 'R')
      .input('CodigoCuentaFactura', sql.VarChar(15), cuentaFacturaParaMovimientos)
      .input('CifDni', sql.VarChar(13), (proveedor.cif || '').substring(0, 13))
      .input('Nombre', sql.VarChar(35), (proveedor.nombre || '').substring(0, 35))
      .input('CodigoRetencion', sql.SmallInt, totalRetencion > 0 ? parseInt(retencionPrincipal) : 0)
      .input('BaseRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? totalBase : 0)
      .input('PorcentajeRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? parseFloat(retencionPrincipal) : 0)
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

    // Insertar en MovimientosIva si hay IVA
    if (totalIVA > 0 && movPosicionGastoIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '';
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Orden', sql.TinyInt, 1)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoIva', sql.SmallInt, parseInt(tipoIVAPrincipal))
        .input('IvaPosicion', sql.UniqueIdentifier, movPosicionGastoIVA)
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

    // ✅ MODIFICACIÓN: USAR RUTA DE RED PARA ARCHIVOS
    if (archivo) {
      const rutaCompleta = construirRutaRed(archivo);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        console.error('Error al guardar documento asociado:', error);
      }
    }
    
    // Actualizar contador
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
    
    // Calcular número total de líneas
    const lineasTotales = 5 + (totalRetencion > 0 ? 1 : 0);
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      message: `Asiento #${siguienteAsiento} - Factura con Pago en Caja creado correctamente`,
      detalles: {
        lineas: lineasTotales,
        cuentaGasto: cuentaGasto,
        partes: {
          parte1: 'Factura proveedor',
          parte2: 'Pago en caja'
        }
      }
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Error durante rollback:', rollbackErr);
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

    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion,
      cuentaCaja
    } = userAnalytics;

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

    const {
      serie,
      numDocumento,
      fechaReg,
      concepto,
      comentario,
      analitico,
      importe,
      archivo
    } = req.body;

    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }
    if (!concepto) {
      throw new Error('Concepto requerido');
    }
    if (!importe || parseFloat(importe) <= 0) {
      throw new Error('Importe debe ser mayor a 0');
    }

    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaGrabacion = new Date();

    const importeNum = parseFloat(importe);
    const comentarioCorto = comentario || concepto.substring(0, 40);

    const movPosicionCaja = uuidv4();

    // PRIMER MOVIMIENTO - DEBE (Cuenta de Caja)
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
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    const movPosicionIngreso = uuidv4();

    // SEGUNDO MOVIMIENTO - HABER (Cuenta Fija 519000000)
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), '51900000') // CUENTA FIJA
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), '')
      .input('DocumentoConta', sql.VarChar(9), '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeNum)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ MODIFICACIÓN: USAR RUTA DE RED PARA ARCHIVOS
    if (archivo) {
      const rutaCompleta = construirRutaRed(archivo);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }

    // ACTUALIZAR CONTADOR
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
        },
        movimientos: {
          debe: {
            cuenta: cuentaCaja || '',
            importe: importeNum
          },
          haber: {
            cuenta: '519000000', // CUENTA FIJA
            importe: importeNum
          }
        }
      }
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Error en rollback:', rollbackErr);
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

    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion,
      cuentaCaja
    } = userAnalytics;

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

    const {
      serie,
      numDocumento,
      fechaReg,
      concepto,
      comentario,
      analitico,
      cuentaGasto,
      importe,
      archivo
    } = req.body;

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

    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaGrabacion = new Date();

    const importeNum = parseFloat(importe);
    const comentarioCorto = comentario || concepto.substring(0, 40);

    const movPosicionGasto = uuidv4();

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
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    const movPosicionCaja = uuidv4();

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
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
      .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
      .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
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

    // ✅ MODIFICACIÓN: USAR RUTA DE RED PARA ARCHIVOS
    if (archivo) {
      const rutaCompleta = construirRutaRed(archivo);

      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
          .input('PathUbicacion', sql.VarChar(500), rutaCompleta)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }

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
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
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
    
    res.json(result.recordset);
    
  } catch (err) {
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
    
    if (!codigoCanal) {
      return res.status(400).json({ 
        success: false,
        error: 'CodigoCanal no disponible en la sesión' 
      });
    }

    const offset = (pagina - 1) * porPagina;
    
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
  app.use(express.static(frontendPath, {
    index: false,
    etag: true,
    lastModified: true,
    maxAge: '1d'
  }));
  
  app.use((req, res, next) => {
    if (req.path.startsWith('/static/') || 
        req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|txt)$/)) {
    }
    next();
  });

  app.get(['/', '/dashboard', '/form4', '/form5', '/form6', '/form7', '/historial', '/login'], (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ 
        error: 'Frontend no configurado correctamente',
        message: 'index.html no encontrado'
      });
    }
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/login') || req.path.startsWith('/logout')) {
      return next();
    }
    
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: 'Frontend no disponible',
        availableRoutes: ['/api/*', '/login', '/logout']
      });
    }
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'Servidor Backend Sage200 Contabilidad',
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
    pool = await sql.connect(dbConfig);

    app.listen(PORT, HOST, () => {
      console.log('\n🎉 SERVIDOR INICIADO EXITOSAMENTE');
      console.log(`🌐 URL Red: http://192.168.200.236:${PORT}`);
    });
    
  } catch (error) {
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
});

process.on('unhandledRejection', (reason, promise) => {
});

startServer();

