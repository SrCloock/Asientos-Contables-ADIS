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

// 📅 FUNCIÓN PARA OBTENER EJERCICIO DESDE FECHA
const obtenerEjercicioDesdeFecha = (dateString) => {
  if (!dateString) return new Date().getFullYear();
  
  try {
    // Intentar extraer el año de la fecha
    const fecha = new Date(dateString);
    return fecha.getFullYear();
  } catch (error) {
    // Si hay error, devolver año actual
    return new Date().getFullYear();
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
    serieFactura,
    factura,
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
      // 🔄 ACTUALIZAR EFECTO EXISTENTE (PARA PAGOS)
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
      // 🔍 VERIFICAR SI EL EFECTO YA EXISTE
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
        return true; // Ya existe, no hacer nada
      }

      // ✅ INSERCIÓN COMPLETA EN CARTERAEFECTOS
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
        .input('SerieFactura', sql.VarChar(10), serieFactura || '')
        .input('Factura', sql.VarChar(9), factura || '')
        .query(`
          INSERT INTO CarteraEfectos 
          (IdDelegacion, MovPosicion, Prevision, Aceptado, Ejercicio, Comentario,
           CodigoClienteProveedor, CodigoCuenta, Contrapartida, FechaEmision, FechaFactura, FechaVencimiento, EnEuros_,
           ImporteEfecto, ImportePendiente, SuFacturaNo, CodigoEmpresa, SerieFactura, Factura)
          VALUES 
          (@IdDelegacion, @MovPosicion, @Prevision, @Aceptado, @Ejercicio, @Comentario,
           @CodigoClienteProveedor, @CodigoCuenta, @Contrapartida, CONVERT(DATE, @FechaEmision), CONVERT(DATE, @FechaFactura), CONVERT(DATE, @FechaVencimiento), @EnEuros_,
           @ImporteEfecto, @ImportePendiente, @SuFacturaNo, @CodigoEmpresa, @SerieFactura, @Factura)
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
      SELECT CodigoRetencion, Retencion, [%Retencion] as PorcentajeRetencion, CuentaAbono
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
  let transaction;
  
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 📅 OBTENER EJERCICIO DINÁMICO DESDE QUERY PARAMETER O USAR AÑO ACTUAL
    const ejercicioParam = req.query.ejercicio;
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam) : new Date().getFullYear();
    
    // Validar que el ejercicio sea un número válido
    if (isNaN(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
      throw new Error('Ejercicio inválido. Debe ser un año entre 2000 y 2100');
    }
    
    // 🔍 BUSCAR CONTADOR EXISTENTE PARA EL EJERCICIO
    const result = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = ${ejercicio}
          AND sysNombreContador = 'ASIENTOS'
      `);

    let contador;
    let contadorCreado = false;

    if (result.recordset.length === 0) {
      // 🔄 CONTADOR NO EXISTE - CREAR UNO NUEVO CON VALOR INICIAL 0
      console.log(`Contador para ejercicio ${ejercicio} no encontrado. Creando nuevo...`);
      
      // 🔹 VALOR INICIAL: 0 (para que el primer asiento sea 1)
      // Explicación: 
      // - Si creamos con 0, el primer asiento será: 0 + 1 = 1
      // - En los endpoints de asientos, hacen: siguienteAsiento = contador actual
      // - Luego actualizan: contador = contador + 1
      // - Por lo tanto: si contador = 0 -> asiento = 0 -> luego contador = 1 ❌ PROBLEMA
      
      // 🔹 REVISIÓN DE LÓGICA:
      // En los endpoints de asientos vi que usan:
      // const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
      // Esto significa que si contador = 0, el asiento sería 0, lo cual NO es correcto
      
      // 🔹 CORRECCIÓN:
      // Si la lógica en los endpoints de asientos es:
      // 1. Obtener contador actual (ej: 0)
      // 2. Usar ese valor como número de asiento (0) ← Esto está MAL
      // 3. Actualizar contador a 1
      
      // Para corregir esto, necesitamos:
      // Opción 1: Crear contador con valor 1
      // Opción 2: Cambiar la lógica en los endpoints de asiento
      
      // Dado que no podemos cambiar todos los endpoints ahora, vamos con Opción 1:
      // Crear contador con valor 1, para que el primer asiento sea 1
      
      const valorInicial = 1;
      
      // 🔹 Crear nuevo registro de contador con valor inicial 1
      await transaction.request()
        .query(`
          INSERT INTO LsysContadores 
          (sysAplicacion, sysGrupo, sysEjercicio, sysNombreContador, sysContadorValor)
          VALUES ('CON', '10000', ${ejercicio}, 'ASIENTOS', ${valorInicial})
        `);
      
      contador = valorInicial;
      contadorCreado = true;
      
      console.log(`✅ Contador creado para ejercicio ${ejercicio} con valor inicial: ${valorInicial}`);
      
      // 🔹 NOTA IMPORTANTE: 
      // Si los endpoints de asiento usan esta lógica:
      // - Obtienen contador (ej: 1)
      // - Usan ese valor como número de asiento (1) ← Bueno
      // - Actualizan contador a 2 ← Bueno
      // Entonces el próximo asiento será 2
      
    } else {
      // ✅ CONTADOR EXISTE - OBTENER VALOR ACTUAL
      contador = result.recordset[0].sysContadorValor;
    }
    
    await transaction.commit();
    
    // 🔄 CÁLCULO DEL PRÓXIMO ASIENTO SEGÚN LA LÓGICA DE LOS ENDPOINTS
    let proximoAsiento;
    let mensajeLogica;
    
    // Según lo que veo en los endpoints de asiento:
    // 1. Obtienen el contador actual
    // 2. Lo usan directamente como número de asiento
    // 3. Luego actualizan el contador sumando 1
    
    // Por lo tanto:
    // - Si contador = 4500, el próximo asiento sería 4500
    // - Después de crear ese asiento, el contador pasaría a 4501
    
    proximoAsiento = contador;
    mensajeLogica = `Próximo asiento: ${proximoAsiento} (contador actual: ${contador})`;
    
    res.json({ 
      success: true,
      ejercicio: ejercicio,
      contador: contador,
      proximoAsiento: proximoAsiento,
      contadorCreado: contadorCreado,
      mensajeLogica: mensajeLogica,
      message: contadorCreado 
        ? `✅ Contador creado para ejercicio ${ejercicio}. ${mensajeLogica}` 
        : `📊 Contador obtenido para ejercicio ${ejercicio}. ${mensajeLogica}`
    });
    
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Error en rollback:', rollbackErr);
      }
    }
    
    console.error('Error en endpoint /api/contador:', err);
    
    // Manejo específico de errores de clave duplicada (si dos usuarios intentan crear al mismo tiempo)
    let errorMessage = 'Error obteniendo/creando contador';
    
    if (err.code === 'EREQUEST') {
      if (err.number === 2627 || err.message.includes('Violation of PRIMARY KEY')) {
        errorMessage = 'El contador ya fue creado por otra solicitud. Intenta nuevamente.';
        
        // 🔄 Reintentar obteniendo el contador (ya debería existir)
        try {
          const reintentoResult = await pool.request()
            .query(`
              SELECT sysContadorValor 
              FROM LsysContadores 
              WHERE sysAplicacion = 'CON' 
                AND sysGrupo = '10000' 
                AND sysEjercicio = ${ejercicioParam ? parseInt(ejercicioParam) : new Date().getFullYear()}
                AND sysNombreContador = 'ASIENTOS'
            `);
          
          if (reintentoResult.recordset.length > 0) {
            const contador = reintentoResult.recordset[0].sysContadorValor;
            return res.json({
              success: true,
              ejercicio: ejercicioParam ? parseInt(ejercicioParam) : new Date().getFullYear(),
              contador: contador,
              proximoAsiento: contador,
              contadorCreado: false,
              mensajeLogica: `Contador ya existía. Próximo asiento: ${contador}`,
              message: 'Contador obtenido después de intento de creación duplicado'
            });
          }
        } catch (reintentoErr) {
          console.error('Error en reintento:', reintentoErr);
        }
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage + ': ' + err.message,
      detalles: err.details || null
    });
  }
});

// ============================================
// 🧾 ENDPOINT FORMPAGE4 - FACTURA IVA NO DEDUCIBLE CORREGIDO
// ============================================

app.post('/api/asiento/factura-iva-no-deducible', requireAuth, async (req, res) => {
  let transaction;
  let transactionIniciada = false;
  
  try {
    // ✅ INICIAR TRANSACCIÓN CON VALIDACIÓN
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    transactionIniciada = true;
    
    console.log('✅ Transacción iniciada correctamente');

    const userAnalytics = req.session.user;
    const {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion
    } = userAnalytics;
    
    // 📅 OBTENER EJERCICIO DINÁMICO DESDE LA FECHA
    const ejercicio = obtenerEjercicioDesdeFecha(req.body.fechaReg);
    
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = ${ejercicio}
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    
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

    // VALIDACIONES BÁSICAS
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

    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaFacturaStr = formatDateWithoutTimezone(fechaFactura);
    const fechaOperStr = formatDateWithoutTimezone(fechaOper);
    const fechaVencimientoStr = formatDateWithoutTimezone(vencimiento);
    const fechaGrabacion = new Date();

    // ✅ CORRECCIÓN: CUENTA PROVEEDOR/ACREEDOR CORRECTA
    let cuentaProveedorReal = '400000000';
    
    if (proveedor.codigoProveedor === '4100') {
      cuentaProveedorReal = '410000000';
    } else if (proveedor.codigoProveedor === '4000') {
      cuentaProveedorReal = '400000000';
    } else {
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
        console.log('Usando cuenta por defecto:', cuentaProveedorReal);
      }
    }

    // CÁLCULO DE TOTALES
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
    
    // ✅ LÍNEA 1: PROVEEDOR/ACREEDOR (HABER)
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ GESTIÓN DE EFECTOS
    if (vencimiento) {
      let remesaHabitual = '572000000';
      
      try {
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

      // ✅ LLAMADA A GESTIONAREFECTO
      await gestionarEfecto(transaction, {
        movPosicion: movPosicionProveedor,
        ejercicio: ejercicio,
        codigoEmpresa: 10000,
        idDelegacion: idDelegacion || '',
        fechaAsiento: fechaAsientoStr,
        fechaVencimiento: fechaVencimientoStr,
        importe: totalFactura,
        comentario: comentarioCorto,
        codigoClienteProveedor: proveedor.codigoProveedor,
        suFacturaNo: numDocumento,
        codigoCuenta: cuentaProveedorReal,
        serieFactura: serie,
        factura: numDocumento,
        esPago: false
      });
    }
    
    // ✅ LÍNEA 2: GASTO IVA (DEBE)
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionIVA)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), serie || '')
        .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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
    
    // ✅ LÍNEA 3: GASTO (DEBE)
    const movPosicionGasto = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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
    
    // ✅ LÍNEA 4: RETENCIÓN (HABER) - CON CUENTA CORRECTA
    let movPosicionRetencion = null;
    // 🔍 CORRECCIÓN: Definir cuentaRetencionForm4 fuera del if con valor por defecto
    let cuentaRetencionForm4 = 'N/A'; // Valor por defecto cuando no hay retención
    
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      
      // 🔍 OBTENER CUENTA DE ABONO CORRECTA
      cuentaRetencionForm4 = '475100000'; // Cambiar a variable ya definida
      const retencionPrincipal = detalles[0]?.retencion || '0';
      
      const detalleConRetencion = detalles.find(d => d.cuentaAbonoRetencion);
      if (detalleConRetencion?.cuentaAbonoRetencion) {
        cuentaRetencionForm4 = detalleConRetencion.cuentaAbonoRetencion;
      } else if (retencionPrincipal !== '0') {
        try {
          const retencionResult = await transaction.request()
            .input('PorcentajeRetencion', sql.Decimal(5,2), parseFloat(retencionPrincipal))
            .query(`
              SELECT TOP 1 CuentaAbono 
              FROM TiposRetencion 
              WHERE CAST([%Retencion] AS DECIMAL(5,2)) = @PorcentajeRetencion
              OR [%Retencion] = @PorcentajeRetencion
            `);
          
          if (retencionResult.recordset.length > 0) {
            cuentaRetencionForm4 = retencionResult.recordset[0].CuentaAbono;
          } else {
            const porcentaje = parseFloat(retencionPrincipal);
            if (porcentaje === 15) cuentaRetencionForm4 = '475100000';
            else if (porcentaje === 19) cuentaRetencionForm4 = '475200000';
            else if (porcentaje === 7) cuentaRetencionForm4 = '475300000';
          }
        } catch (error) {
          console.error('Error buscando cuenta de retención:', error);
        }
      }
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'H')
        .input('CodigoCuenta', sql.VarChar(15), cuentaRetencionForm4)
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), serie || '')
        .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ MOVIMIENTOSFACTURAS
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
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('Año', sql.SmallInt, ejercicio)
      .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
      .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
      .input('Serie', sql.VarChar(10), serie || '')
      .input('Factura', sql.VarChar(9), numDocumento || '')
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

    // ✅ MOVIMIENTOSIVA (si hay IVA)
    if (totalIVA > 0 && movPosicionIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '';
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Orden', sql.TinyInt, 1)
        .input('Año', sql.SmallInt, ejercicio)
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

    // ✅ DOCUMENTO ASOCIADO
    if (archivo) {
      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor)
          .input('PathUbicacion', sql.VarChar(500), archivo)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        console.error('Error al guardar documento asociado:', error);
      }
    }
    
    // ✅ ACTUALIZAR CONTADOR
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = ${ejercicio}
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    // ✅ COMMIT EXITOSO
    await transaction.commit();
    transactionIniciada = false;
    
    // ✅ CORRECCIÓN: Ahora cuentaRetencionForm4 siempre está definida
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) creado correctamente`,
      detalles: {
        lineas: totalRetencion > 0 ? 4 : 3,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura,
        cuentaRetencion: cuentaRetencionForm4 // ← Ahora siempre definida
      }
    });
    
  } catch (err) {
    // ✅ MANEJO DE ERRORES ROBUSTO
    console.error('❌ Error en endpoint factura-iva-no-deducible:', err.message);
    console.error('Stack trace:', err.stack);
    
    if (transaction && transactionIniciada) {
      try {
        console.log('Intentando rollback...');
        await transaction.rollback();
        console.log('Rollback exitoso');
      } catch (rollbackErr) {
        console.error('Error en rollback:', rollbackErr.message);
      }
    } else {
      console.log('No se requiere rollback (transacción no iniciada)');
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
      detalles: err.details || null,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  } finally {
    if (transaction && transactionIniciada) {
      try {
        console.log('Limpiando transacción en finally...');
        await transaction.rollback();
      } catch (finalErr) {
        console.error('Error limpiando transacción:', finalErr.message);
      }
    }
  }
});
// ============================================
// 🧾 ENDPOINT FORMPAGE5 - PAGO PROVEEDOR CORREGIDO COMPLETO
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
    
    // 📅 OBTENER EJERCICIO DINÁMICO DESDE LA FECHA
    const ejercicio = obtenerEjercicioDesdeFecha(req.body.fechaReg);
    
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = ${ejercicio}
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    
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
      archivo
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
    let cuentaRetencion = '475100000'; // Valor por defecto
    
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
        
        // Obtener la cuenta de abono de retención de la línea si existe
        if (linea.cuentaAbonoRetencion) {
          cuentaRetencion = linea.cuentaAbonoRetencion;
        }
      }
    });

    totalBase = parseFloat(totalBase.toFixed(2));
    totalIVA = parseFloat(totalIVA.toFixed(2));
    totalRetencion = parseFloat(totalRetencion.toFixed(2));
    const totalFactura = parseFloat((totalBase + totalIVA - totalRetencion).toFixed(2));

    // ✅ CORRECCIÓN: Usar solo concepto, no concatenar con numFRA
    const comentarioCorto = `${concepto}`.trim().substring(0, 40);

    // ✅ LÍNEA 1 - PROVEEDOR (HABER) - FACTURA
    const movPosicionProveedorHaber = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), cuentaCaja)
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ LÍNEA 2 - GASTO (BASE) - DEBE
    const movPosicionGastoBase = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGastoBase)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), '')
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ LÍNEA 3 - GASTO (IVA) - DEBE
    let movPosicionGastoIVA = null;
    if (totalIVA > 0) {
      movPosicionGastoIVA = uuidv4();
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionGastoIVA)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'D')
        .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), serie || '')
        .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ LÍNEA 4 - CAJA (HABER) - PAGO
    const movPosicionCaja = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCaja)
      .input('Contrapartida', sql.VarChar(15), cuentaProveedorReal)
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ LÍNEA 5 - PROVEEDOR (DEBE) - PAGO
    const movPosicionProveedorDebe = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorDebe)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaProveedorReal)
      .input('Contrapartida', sql.VarChar(15), cuentaCaja)
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ LÍNEA 6 - RETENCIÓN (HABER) - CON CUENTA DE ABONO CORRESPONDIENTE
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();
      
      // 🔍 OBTENER CUENTA DE ABONO CORRECTA DESDE TIPOSRETENCION
      if (!cuentaRetencion || cuentaRetencion === '475100000') {
        const retencionPrincipal = detalles[0]?.retencion || '0';
        const retencionResult = await transaction.request()
          .input('PorcentajeRetencion', sql.Decimal(5,2), parseFloat(retencionPrincipal))
          .query(`
            SELECT CuentaAbono 
            FROM TiposRetencion 
            WHERE [%Retencion] = @PorcentajeRetencion
          `);
        
        if (retencionResult.recordset.length > 0) {
          cuentaRetencion = retencionResult.recordset[0].CuentaAbono;
        }
      }
      
      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionRetencion)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), 'H')
        .input('CodigoCuenta', sql.VarChar(15), cuentaRetencion) // ✅ CUENTA CORRECTA
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), serie || '')
        .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
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

    // ✅ INSERTAR EN MOVIMIENTOSFACTURAS
    const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
      .input('TipoMov', sql.TinyInt, 0)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('Año', sql.SmallInt, ejercicio)
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

    // ✅ INSERTAR EN MOVIMIENTOSIVA (si hay IVA)
    if (totalIVA > 0 && movPosicionGastoIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '';
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 10000)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Orden', sql.TinyInt, 1)
        .input('Año', sql.SmallInt, ejercicio)
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

    // ✅ DOCUMENTO ASOCIADO
    if (archivo) {
      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
          .input('PathUbicacion', sql.VarChar(500), archivo)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        console.error('Error al guardar documento asociado:', error);
      }
    }

    // ✅ ACTUALIZAR CONTADOR
    await transaction.request()
      .query(`
        UPDATE LsysContadores 
        SET sysContadorValor = sysContadorValor + 1
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = ${ejercicio}
          AND sysNombreContador = 'ASIENTOS'
      `);

    await transaction.commit();
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Pago Proveedor creado correctamente`,
      detalles: {
        lineas: totalRetencion > 0 ? 6 : 5,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura,
        cuentaRetencion: cuentaRetencion,
        documentoAsociado: archivo ? 'Sí' : 'No'
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
    
    console.error('Error en pago-proveedor:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error creando asiento de pago: ' + err.message
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
    
    // 📅 OBTENER EJERCICIO DINÁMICO DESDE LA FECHA
    const ejercicio = obtenerEjercicioDesdeFecha(req.body.fechaReg);
    
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = ${ejercicio}
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
      cuentaCaja: cuentaCajaBody,
      importe,
      archivo
    } = req.body;

    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaGrabacion = new Date();
    
    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }
    
    if (!importe || parseFloat(importe) <= 0) {
      throw new Error('Importe válido requerido');
    }

    // Cuenta fija para ingresos
    const cuentaIngresoFija = '519000000';
    const importeDecimal = parseFloat(importe);

    const comentarioCorto = comentario || `${concepto}`.trim().substring(0, 40);

    // ✅ LÍNEA 1: CAJA (DEBE) - CON TipoDocumento y DocumentoConta
    const movPosicionCaja = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCajaBody || cuentaCaja)
      .input('Contrapartida', sql.VarChar(15), cuentaIngresoFija)
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeDecimal)
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

    // ✅ LÍNEA 2: INGRESO (HABER) - CON TipoDocumento y DocumentoConta
    const movPosicionIngreso = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaIngresoFija)
      .input('Contrapartida', sql.VarChar(15), cuentaCajaBody || cuentaCaja)
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeDecimal)
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

    // ✅ MODIFICACIÓN: GUARDAR ARCHIVO CON RUTA COMPLETA
    if (archivo) {
      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
          .input('PathUbicacion', sql.VarChar(500), archivo) // Usar directamente la ruta proporcionada
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
          AND sysEjercicio = ${ejercicio}
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    await transaction.commit();
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Ingreso en Caja creado correctamente`,
      detalles: {
        lineas: 2,
        debe: importeDecimal,
        haber: importeDecimal,
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
    
    // 📅 OBTENER EJERCICIO DINÁMICO DESDE LA FECHA
    const ejercicio = obtenerEjercicioDesdeFecha(req.body.fechaReg);
    
    const contadorResult = await transaction.request()
      .query(`
        SELECT sysContadorValor 
        FROM LsysContadores 
        WHERE sysAplicacion = 'CON' 
          AND sysGrupo = '10000' 
          AND sysEjercicio = ${ejercicio}
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
      cuentaCaja: cuentaCajaBody,
      importe,
      archivo
    } = req.body;

    const fechaAsientoStr = formatDateWithoutTimezone(fechaReg) || new Date().toISOString().split('T')[0];
    const fechaGrabacion = new Date();
    
    if (!numDocumento) {
      throw new Error('Número de documento requerido');
    }
    
    if (!cuentaGasto) {
      throw new Error('Cuenta de gasto requerida');
    }
    
    if (!importe || parseFloat(importe) <= 0) {
      throw new Error('Importe válido requerido');
    }

    const importeDecimal = parseFloat(importe);
    const comentarioCorto = comentario || `${concepto}`.trim().substring(0, 40);

    // ✅ LÍNEA 1: GASTO (DEBE) - CON TipoDocumento y DocumentoConta
    const movPosicionGasto = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaGasto)
      .input('Contrapartida', sql.VarChar(15), cuentaCajaBody || cuentaCaja)
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeDecimal)
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

    // ✅ LÍNEA 2: CAJA (HABER) - CON TipoDocumento y DocumentoConta
    const movPosicionCaja = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 10000)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCajaBody || cuentaCaja)
      .input('Contrapartida', sql.VarChar(15), cuentaGasto)
      .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
      .input('TipoDocumento', sql.VarChar(6), serie || '')
      .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), importeDecimal)
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

    // ✅ MODIFICACIÓN: GUARDAR ARCHIVO CON RUTA COMPLETA
    if (archivo) {
      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
          .input('PathUbicacion', sql.VarChar(500), archivo) // Usar directamente la ruta proporcionada
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
          AND sysEjercicio = ${ejercicio}
          AND sysNombreContador = 'ASIENTOS'
      `);
    
    await transaction.commit();
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Gasto Directo en Caja creado correctamente`,
      detalles: {
        lineas: 2,
        debe: importeDecimal,
        haber: importeDecimal,
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
// 🔍 ENDPOINT PARA CONSULTAR EFECTOS
// ============================================

app.get('/api/efectos/:codigoProveedor?', requireAuth, async (req, res) => {
  try {
    const { codigoProveedor } = req.params;
    
    // 📅 OBTENER EJERCICIO DINÁMICO DESDE QUERY PARAMETER O USAR AÑO ACTUAL
    const ejercicioParam = req.query.ejercicio;
    const ejercicio = ejercicioParam ? parseInt(ejercicioParam) : new Date().getFullYear();
    
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
        AND ce.Ejercicio = @Ejercicio
        AND ce.StatusBorrado = 0
    `;
    
    const request = pool.request()
      .input('Ejercicio', sql.Int, ejercicio);
    
    if (codigoProveedor) {
      query += ` AND ce.CodigoClienteProveedor = @CodigoProveedor`;
      request.input('CodigoProveedor', sql.VarChar, codigoProveedor);
    }
    
    query += ` ORDER BY ce.FechaVencimiento ASC`;
    
    const result = await request.query(query);
    
    res.json({
      success: true,
      ejercicio: ejercicio,
      totalEfectos: result.recordset.length,
      efectos: result.recordset
    });
    
  } catch (err) {
    console.error('Error obteniendo efectos:', err);
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo efectos: ' + err.message 
    });
  }
});
// ============================================
// 📋 ENDPOINTS PARA HISTORIAL DE ASIENTOS - FILTRADO POR CANAL
// ============================================

// ============================================
// 📋 ENDPOINTS PARA HISTORIAL DE ASIENTOS - TODOS LOS AÑOS
// ============================================

app.get('/api/historial-asientos', requireAuth, async (req, res) => {
  try {
    const pagina = parseInt(req.query.pagina) || 1;
    const porPagina = parseInt(req.query.porPagina) || 50;
    const codigoCanal = req.session.user?.codigoCanal;
    
    // 📅 EJERCICIO OPCIONAL - si no se especifica, muestra todos
    const ejercicioParam = req.query.ejercicio;
    
    if (!codigoCanal) {
      return res.status(400).json({ 
        success: false,
        error: 'CodigoCanal no disponible en la sesión' 
      });
    }

    const offset = (pagina - 1) * porPagina;
    
    // Construir query dinámica
    let queryBase = `
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
        AND m.CodigoCanal = @CodigoCanal
        AND m.TipoMov = 0
    `;
    
    let queryStats = `
      SELECT 
        COUNT(*) as TotalAsientos,
        SUM(CASE WHEN CargoAbono = 'D' THEN ImporteAsiento ELSE 0 END) as TotalDebe,
        SUM(CASE WHEN CargoAbono = 'H' THEN ImporteAsiento ELSE 0 END) as TotalHaber
      FROM Movimientos 
      WHERE CodigoEmpresa = 10000
        AND CodigoCanal = @CodigoCanal
        AND TipoMov = 0
    `;
    
    const request = pool.request()
      .input('CodigoCanal', sql.VarChar, codigoCanal);
    
    const requestStats = pool.request()
      .input('CodigoCanal', sql.VarChar, codigoCanal);
    
    // ✅ FILTRO OPCIONAL POR EJERCICIO
    if (ejercicioParam) {
      const ejercicio = parseInt(ejercicioParam);
      if (!isNaN(ejercicio)) {
        queryBase += ` AND m.Ejercicio = @Ejercicio`;
        queryStats += ` AND Ejercicio = @Ejercicio`;
        request.input('Ejercicio', sql.Int, ejercicio);
        requestStats.input('Ejercicio', sql.Int, ejercicio);
      }
    }
    
    // ✅ ORDENACIÓN: PRIMERO POR EJERCICIO DESC, LUEGO POR ASIENTO DESC
    queryBase += ` 
      ORDER BY m.Ejercicio DESC, m.Asiento DESC, m.FechaGrabacion DESC
      OFFSET @Offset ROWS 
      FETCH NEXT @PageSize ROWS ONLY
    `;
    
    request.input('Offset', sql.Int, offset);
    request.input('PageSize', sql.Int, porPagina);
    
    const result = await request.query(queryBase);
    const statsResult = await requestStats.query(queryStats);
    
    const totalRegistros = result.recordset.length > 0 ? result.recordset[0].TotalRegistros : 0;
    const totalPaginas = Math.ceil(totalRegistros / porPagina);
    
    // Obtener lista de años disponibles para este canal
    const yearsResult = await pool.request()
      .input('CodigoCanal', sql.VarChar, codigoCanal)
      .query(`
        SELECT DISTINCT Ejercicio 
        FROM Movimientos 
        WHERE CodigoEmpresa = 10000
          AND CodigoCanal = @CodigoCanal
          AND TipoMov = 0
        ORDER BY Ejercicio DESC
      `);
    
    const añosDisponibles = yearsResult.recordset.map(row => row.Ejercicio);

    const asientosAgrupados = {};
    result.recordset.forEach(movimiento => {
      const key = `${movimiento.Ejercicio}-${movimiento.Asiento}`;
      if (!asientosAgrupados[key]) {
        asientosAgrupados[key] = {
          ejercicio: movimiento.Ejercicio,
          asiento: movimiento.Asiento,
          fechaAsiento: movimiento.FechaAsiento,
          comentario: movimiento.Comentario,
          codigoCanal: movimiento.CodigoCanal,
          fechaGrabacion: movimiento.FechaGrabacion,
          movimientos: [],
          totalDebe: 0,
          totalHaber: 0
        };
      }
      
      asientosAgrupados[key].movimientos.push({
        codigoCuenta: movimiento.CodigoCuenta,
        cargoAbono: movimiento.CargoAbono,
        importeAsiento: parseFloat(movimiento.ImporteAsiento),
        codigoDepartamento: movimiento.CodigoDepartamento,
        codigoSeccion: movimiento.CodigoSeccion,
        codigoProyecto: movimiento.CodigoProyecto,
        idDelegacion: movimiento.IdDelegacion
      });

      if (movimiento.CargoAbono === 'D') {
        asientosAgrupados[key].totalDebe += parseFloat(movimiento.ImporteAsiento);
      } else {
        asientosAgrupados[key].totalHaber += parseFloat(movimiento.ImporteAsiento);
      }
    });

    // Convertir a array y ordenar por ejercicio y asiento descendente
    const asientos = Object.values(asientosAgrupados)
      .sort((a, b) => {
        if (a.ejercicio !== b.ejercicio) {
          return b.ejercicio - a.ejercicio; // Ejercicio descendente
        }
        return b.asiento - a.asiento; // Asiento descendente dentro del mismo ejercicio
      });

    res.json({
      success: true,
      filtroEjercicio: ejercicioParam ? parseInt(ejercicioParam) : 'Todos',
      añosDisponibles,
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
      },
      ordenamiento: 'Ejercicio DESC, Asiento DESC (más reciente primero)'
    });

  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: 'Error obteniendo historial de asientos: ' + err.message 
    });
  }
});

// Endpoint para buscar asientos específicos con filtros avanzados
app.get('/api/historial-asientos/buscar', requireAuth, async (req, res) => {
  try {
    const { 
      asiento, 
      fechaDesde, 
      fechaHasta, 
      cuenta, 
      ejercicio: ejercicioParam,
      comentario,
      codigoDepartamento,
      codigoSeccion,
      codigoProyecto
    } = req.query;
    
    const codigoCanal = req.session.user?.codigoCanal;
    
    if (!codigoCanal) {
      return res.status(400).json({ 
        success: false,
        error: 'CodigoCanal no disponible en la sesión' 
      });
    }

    // Construir query dinámica
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
        AND m.CodigoCanal = @CodigoCanal
        AND m.TipoMov = 0
    `;

    const request = pool.request()
      .input('CodigoCanal', sql.VarChar, codigoCanal);

    // ✅ FILTRO OPCIONAL POR EJERCICIO
    if (ejercicioParam && !isNaN(parseInt(ejercicioParam))) {
      query += ` AND m.Ejercicio = @Ejercicio`;
      request.input('Ejercicio', sql.Int, parseInt(ejercicioParam));
    }
    
    if (asiento && !isNaN(parseInt(asiento))) {
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
    
    if (comentario) {
      query += ` AND m.Comentario LIKE @Comentario`;
      request.input('Comentario', sql.VarChar, `%${comentario}%`);
    }
    
    if (codigoDepartamento) {
      query += ` AND m.CodigoDepartamento = @CodigoDepartamento`;
      request.input('CodigoDepartamento', sql.VarChar, codigoDepartamento);
    }
    
    if (codigoSeccion) {
      query += ` AND m.CodigoSeccion = @CodigoSeccion`;
      request.input('CodigoSeccion', sql.VarChar, codigoSeccion);
    }
    
    if (codigoProyecto) {
      query += ` AND m.CodigoProyecto = @CodigoProyecto`;
      request.input('CodigoProyecto', sql.VarChar, codigoProyecto);
    }

    // ✅ ORDENACIÓN: PRIMERO POR EJERCICIO DESC, LUEGO POR ASIENTO DESC
    query += ` ORDER BY m.Ejercicio DESC, m.Asiento DESC, m.FechaGrabacion DESC`;

    const result = await request.query(query);

    // Agrupar asientos por ejercicio y número
    const asientosAgrupados = {};
    result.recordset.forEach(movimiento => {
      const key = `${movimiento.Ejercicio}-${movimiento.Asiento}`;
      if (!asientosAgrupados[key]) {
        asientosAgrupados[key] = {
          ejercicio: movimiento.Ejercicio,
          asiento: movimiento.Asiento,
          fechaAsiento: movimiento.FechaAsiento,
          comentario: movimiento.Comentario,
          codigoCanal: movimiento.CodigoCanal,
          fechaGrabacion: movimiento.FechaGrabacion,
          movimientos: [],
          totalDebe: 0,
          totalHaber: 0
        };
      }
      
      asientosAgrupados[key].movimientos.push({
        codigoCuenta: movimiento.CodigoCuenta,
        cargoAbono: movimiento.CargoAbono,
        importeAsiento: parseFloat(movimiento.ImporteAsiento),
        codigoDepartamento: movimiento.CodigoDepartamento,
        codigoSeccion: movimiento.CodigoSeccion,
        codigoProyecto: movimiento.CodigoProyecto,
        idDelegacion: movimiento.IdDelegacion
      });

      if (movimiento.CargoAbono === 'D') {
        asientosAgrupados[key].totalDebe += parseFloat(movimiento.ImporteAsiento);
      } else {
        asientosAgrupados[key].totalHaber += parseFloat(movimiento.ImporteAsiento);
      }
    });

    // Convertir a array y mantener orden natural (ya viene ordenado de la consulta)
    const asientos = Object.values(asientosAgrupados);

    // Calcular estadísticas de los resultados
    let totalDebeResultados = 0;
    let totalHaberResultados = 0;
    
    asientos.forEach(asiento => {
      totalDebeResultados += asiento.totalDebe;
      totalHaberResultados += asiento.totalHaber;
    });

    // Obtener años disponibles en los resultados
    const añosResultados = [...new Set(asientos.map(a => a.ejercicio))].sort((a, b) => b - a);

    res.json({
      success: true,
      filtrosAplicados: {
        ejercicio: ejercicioParam || 'Todos',
        asiento: asiento || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        cuenta: cuenta || null,
        comentario: comentario || null
      },
      añosResultados,
      asientos,
      totalRegistros: asientos.length,
      estadisticasResultados: {
        totalDebe: totalDebeResultados,
        totalHaber: totalHaberResultados,
        diferencia: Math.abs(totalDebeResultados - totalHaberResultados)
      },
      ordenamiento: 'Ejercicio DESC, Asiento DESC (más reciente primero)'
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

