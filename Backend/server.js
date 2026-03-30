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
          IdDelegacion,
          CodigoEmpresa  -- ← Añade esto para debug
        FROM CLIENTES 
        WHERE UsuarioLogicNet = @username 
        AND ContraseñaLogicNet = @password
        AND CodigoCategoriaCliente_ = 'EMP'
        AND codigoempresa = 1
      `);

    console.log('🔍 RESULTADO DE LOGIN:', {
      registros: result.recordset.length,
      datos: result.recordset[0] || 'No hay datos'
    });

    if (result.recordset.length > 0) {
      const userData = result.recordset[0];
      const isAdmin = userData.StatusAdministrador === -1;
      
      console.log('🔍 USUARIO ENCONTRADO:', {
        codigoCliente: userData.CodigoCliente,
        codigoEmpresa: userData.CodigoEmpresa,
        codigoProyecto: userData.CodigoProyecto,
        codigoCanal: userData.CodigoCanal,
        codigoDepartamento: userData.CodigoDepartamento,
        idDelegacion: userData.IdDelegacion
      });
      
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
        codigoProyecto: userData.CodigoProyecto || '',  // ← ¡Ahora debería ser "ADS"!
        codigoSeccion: userData.CodigoSeccion || '',
        codigoDepartamento: userData.CodigoDepartamento || '',
        cuentaCaja: userData.CuentaCaja || '',
        idDelegacion: userData.IdDelegacion || '',
        codigoEmpresa: userData.CodigoEmpresa || 1  // ← Añade esto también
      };

      return res.status(200).json({ 
        success: true, 
        user: req.session.user
      });
    } else {
      console.log('⚠️ No se encontró usuario con codigoempresa = 1, probando sin filtro...');
      
      const resultSinFiltro = await pool.request()
        .input('username', sql.VarChar, username)
        .input('password', sql.VarChar, password)
        .query(`
          SELECT CodigoCliente, UsuarioLogicNet, CodigoEmpresa, CodigoProyecto
          FROM CLIENTES 
          WHERE UsuarioLogicNet = @username 
          AND ContraseñaLogicNet = @password
          AND CodigoCategoriaCliente_ = 'EMP'
        `);
      
      console.log('🔍 RESULTADO SIN FILTRO EMPRESA:', resultSinFiltro.recordset);
      
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas o no tiene permisos en la empresa 1' 
      });
    }
  } catch (error) {
    console.error('❌ Error en login:', error);
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
    // 🔍 AÑADE LOG PARA VERIFICAR
    console.log('🔍 SESIÓN ACTUAL:', {
      usuario: req.session.user.usuario,
      codigoProyecto: req.session.user.codigoProyecto,
      sessionID: req.sessionID
    });
    
    res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ============================================
// 🔄 FUNCIÓN AUXILIAR PARA EFECTOS (VERSIÓN COMPLETA)
// ============================================

const gestionarEfecto = async (transaction, data) => {
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
        esPago = false,
        // Nuevos campos
        codigoCanal,
        tipoDocumento,
        remesaHabitual,
        codigoBanco,
        codigoAgencia,
        dc,
        ccc,
        iban,
        codigoTipoEfecto,
        tipoEfecto
    } = data;

    if (!fechaVencimiento) {
        return null;
    }

    try {
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

            // ✅ INSERCIÓN COMPLETA CON TODOS LOS CAMPOS
            const insertResult = await transaction.request()
                .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
                .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
                .input('Prevision', sql.VarChar(1), 'P')
                .input('Aceptado', sql.SmallInt, -1)
                .input('Ejercicio', sql.SmallInt, ejercicio)
                .input('Comentario', sql.VarChar(40), comentario || '')
                .input('CodigoClienteProveedor', sql.VarChar(15), codigoClienteProveedor)
                .input('CodigoCuenta', sql.VarChar(15), codigoCuenta)
                .input('Contrapartida', sql.VarChar(15), remesaHabitual || '') // Mismo valor que RemesaHabitual
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
                // NUEVOS CAMPOS
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
      WHERE codigoempresa = 1
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
        AND cc.codigoempresa = 1
      WHERE p.codigoempresa = 1
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
      WHERE codigoempresa = 1
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
      WHERE codigoempresa = 1
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
      WHERE codigoempresa = 1
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
          AND sysGrupo = '1' 
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
          VALUES ('CON', '1', ${ejercicio}, 'ASIENTOS', ${valorInicial})
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
                AND sysGrupo = '1' 
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
// 🧾 ENDPOINT FORMPAGE4 - FACTURA IVA NO DEDUCIBLE (COMPLETO)
// ============================================

app.post('/api/asiento/factura-iva-no-deducible', requireAuth, async (req, res) => {
  let transaction;
  let transactionIniciada = false;

  try {
    // 🔍 PRIMERO: VERIFICACIÓN Y LOG DE LOS DATOS DEL USUARIO
    console.log('🔍 DEBUG - REQ.SESSION.USER:', JSON.stringify(req.session.user, null, 2));

    // ✅ SOLUCIÓN: Obtener datos de forma segura
    const userAnalytics = req.session.user || {};

    // Extraer con compatibilidad para camelCase y PascalCase
    const codigoCanal = userAnalytics.codigoCanal || userAnalytics.CodigoCanal || '';
    const codigoProyecto = userAnalytics.codigoProyecto || userAnalytics.CodigoProyecto || '';
    const codigoSeccion = userAnalytics.codigoSeccion || userAnalytics.CodigoSeccion || '';
    const codigoDepartamento = userAnalytics.codigoDepartamento || userAnalytics.CodigoDepartamento || '';
    const idDelegacion = userAnalytics.idDelegacion || userAnalytics.IdDelegacion || '';

    console.log('🔍 DEBUG - Datos analíticos extraídos:', {
      codigoCanal,
      codigoProyecto,
      codigoSeccion,
      codigoDepartamento,
      idDelegacion
    });

    // ✅ INICIAR TRANSACCIÓN
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    transactionIniciada = true;

    console.log('✅ Transacción iniciada correctamente');

    // 📅 OBTENER EJERCICIO DINÁMICO DESDE LA FECHA
    const ejercicio = obtenerEjercicioDesdeFecha(req.body.fechaReg);

    // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ASIENTOS CONTABLES DE FORMA ATÓMICA
    const contadorResult = await transaction.request()
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

    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }

    const siguienteAsiento = contadorResult.recordset[0].ValorAnterior;

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

    // ✅ CUENTA PROVEEDOR/ACREEDOR CORRECTA
    let cuentaProveedorReal = '40000000';

    if (proveedor.codigoProveedor === '4100') {
      cuentaProveedorReal = '41000000';
    } else if (proveedor.codigoProveedor === '4000') {
      cuentaProveedorReal = '40000000';
    } else {
      try {
        const cuentaContableResult = await transaction.request()
          .input('codigoProveedor', sql.VarChar, proveedor.codigoProveedor)
          .query(`
            SELECT CodigoCuenta 
            FROM ClientesConta 
            WHERE CodigoClienteProveedor = @codigoProveedor
              AND codigoempresa = 1
          `);

        if (cuentaContableResult.recordset.length > 0) {
          cuentaProveedorReal = cuentaContableResult.recordset[0].CodigoCuenta;
        }
      } catch (error) {
        console.log('Usando cuenta por defecto:', cuentaProveedorReal);
      }
    }

    // ✅ CALCULAR TOTALES CON DESGLOSE POR LÍNEA
    let totalBase = 0;
    let totalIVA = 0;
    let totalRetencion = 0;
    let lineasIVA = [];
    let cuentaRetencionForm4 = '475100000';

    detalles.forEach((linea, index) => {
      try {
        // Validación robusta de valores numéricos
        const base = parseFloat(linea.base) || 0;
        const tipoIVA = parseFloat(linea.tipoIVA) || 0;
        const retencion = parseFloat(linea.retencion) || 0;

        // Verificar que los valores sean números válidos
        if (isNaN(base) || base <= 0) {
          console.warn(`Línea ${index + 1}: Base inválida o cero, omitiendo`);
          return;
        }

        if (isNaN(tipoIVA)) {
          console.warn(`Línea ${index + 1}: Tipo IVA inválido, usando 0%`);
          tipoIVA = 0;
        }

        if (isNaN(retencion)) {
          console.warn(`Línea ${index + 1}: Retención inválida, usando 0%`);
          retencion = 0;
        }

        const iva = parseFloat(linea.cuotaIVA) || (base * tipoIVA) / 100;
        const cuotaRetencion = parseFloat(linea.cuotaRetencion) || (base * retencion) / 100;

        if (base > 0) {
          totalBase += base;
          totalIVA += iva;
          totalRetencion += cuotaRetencion;

          // Almacenar detalle de IVA por línea para insertar en MovimientosIva
          lineasIVA.push({
            orden: index + 1,
            base: base,
            tipoIVA: tipoIVA,
            iva: iva,
            retencion: retencion,
            cuentaAbonoRetencion: linea.cuentaAbonoRetencion
          });

          // Obtener la cuenta de abono de retención de la línea si existe
          if (linea.cuentaAbonoRetencion) {
            cuentaRetencionForm4 = linea.cuentaAbonoRetencion;
          }
        }
      } catch (error) {
        console.error(`Error procesando línea ${index + 1}:`, error.message);
      }
    });

    const totalFactura = totalBase + totalIVA - totalRetencion;
    const comentarioCorto = `${concepto}`.trim().substring(0, 40);
    const movPosicionProveedor = uuidv4();

    // ✅ ARRAY PARA GUARDAR MOVIMIENTOS ANALIZABLES (SOLO CUENTAS 6 Y 7)
    const movimientosAnalitica = [];

    // ✅ FUNCIÓN PARA INSERTAR EN MOVIMIENTOS CON ORDEN CORRECTO
    const insertarMovimiento = async (params) => {
      const {
        movPosicion,
        cargoAbono,
        codigoCuenta,
        importe,
        esVencimiento = false,
        esRetencion = false
      } = params;

      console.log(`🔍 Insertando movimiento ${cargoAbono} con CodigoProyecto: "${codigoProyecto}"`);

      await transaction.request()
        .input('MovPosicion', sql.UniqueIdentifier, movPosicion)
        .input('Ejercicio', sql.SmallInt, ejercicio)
        .input('CodigoEmpresa', sql.SmallInt, 1)
        .input('TipoMov', sql.TinyInt, 0)
        .input('Asiento', sql.Int, siguienteAsiento)
        .input('CargoAbono', sql.VarChar(1), cargoAbono)
        .input('CodigoCuenta', sql.VarChar(15), codigoCuenta)
        .input('Contrapartida', sql.VarChar(15), '')
        .input('FechaAsiento', sql.VarChar, fechaAsientoStr)
        .input('TipoDocumento', sql.VarChar(6), serie || '')
        .input('DocumentoConta', sql.VarChar(9), numDocumento || '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), importe)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal)
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), esVencimiento ? 'P' : '')
        .input('FechaVencimiento', sql.VarChar, esVencimiento ? fechaVencimientoStr : null)
        .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
        .input('TipoEntrada', sql.VarChar(2), '')
        .input('StatusImpagado', sql.TinyInt, 0)
        .input('Diseño', sql.TinyInt, 0)
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento)
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion)
        .input('CodigoDivisa', sql.VarChar(3), '')
        .input('ImporteCambio', sql.Decimal(18, 2), 0)
        .input('ImporteDivisa', sql.Decimal(18, 2), 0)
        .input('FactorCambio', sql.Decimal(18, 6), 0)
        .input('CodigoConcepto', sql.Int, 0)
        .input('CodigoConciliacion', sql.Int, 0)
        .input('FechaConciliacion', sql.VarChar, null)
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto)
        .input('StatusAnalitica', sql.SmallInt, -1)
        .input('LibreN1', sql.VarChar(10), '')
        .input('LibreN2', sql.VarChar(10), '')
        .input('LibreA1', sql.VarChar(10), '')
        .input('LibreA2', sql.VarChar(10), '')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion)
        .query(`
          INSERT INTO Movimientos (
            MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
            Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
            StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoActividad, Previsiones, FechaVencimiento, 
            NumeroPeriodo, StatusConciliacion, StatusSaldo, StatusTraspaso, CodigoUsuario, FechaGrabacion,
            TipoEntrada, StatusImpagado, Diseño, CodigoDepartamento, CodigoSeccion, CodigoDivisa,
            ImporteCambio, ImporteDivisa, FactorCambio, CodigoConcepto, CodigoConciliacion, FechaConciliacion,
            CodigoProyecto, StatusAnalitica, LibreN1, LibreN2, LibreA1, LibreA2, IdDelegacion
          ) VALUES (
            @MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
            @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
            @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoActividad, @Previsiones, 
            CASE WHEN @FechaVencimiento IS NOT NULL THEN CONVERT(DATE, @FechaVencimiento) ELSE NULL END,
            @NumeroPeriodo, @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @CodigoUsuario, @FechaGrabacion,
            @TipoEntrada, @StatusImpagado, @Diseño, @CodigoDepartamento, @CodigoSeccion, @CodigoDivisa,
            @ImporteCambio, @ImporteDivisa, @FactorCambio, @CodigoConcepto, @CodigoConciliacion, 
            CASE WHEN @FechaConciliacion IS NOT NULL THEN CONVERT(DATE, @FechaConciliacion) ELSE NULL END,
            @CodigoProyecto, @StatusAnalitica, @LibreN1, @LibreN2, @LibreA1, @LibreA2, @IdDelegacion
          )
        `);

      // 🔍 Si la cuenta es analizable (solo 6 o 7), guardamos para después
      if (codigoCuenta.startsWith('6') || codigoCuenta.startsWith('7')) {
        movimientosAnalitica.push({
          movPosicion,
          cargoAbono,
          codigoCuenta,
          importe,
          comentario: comentarioCorto
        });
      }
    };

    // ✅ LÍNEA 1: PROVEEDOR/ACREEDOR (HABER) - NO analizable (cuenta 4)
    await insertarMovimiento({
      movPosicion: movPosicionProveedor,
      cargoAbono: 'H',
      codigoCuenta: cuentaProveedorReal,
      importe: totalFactura,
      esVencimiento: true
    });

    // ✅ GESTIÓN DE EFECTOS (CORREGIDO: factura y suFacturaNo)
    if (vencimiento) {
      // Obtener datos bancarios y de tipo efecto (solo para proveedores reales)
      let datosBancarios = {
        codigoBanco: '',
        codigoAgencia: '',
        dc: '',
        ccc: '',
        iban: ''
      };
      let remesaHabitual = '';
      let codigoTipoEfecto = null;
      let tipoEfecto = '';

      if (proveedor.codigoProveedor !== '4000' && proveedor.codigoProveedor !== '4100') {
        // Datos bancarios desde Proveedores
        const proveedorResult = await transaction.request()
          .input('codigoProveedor', sql.VarChar, proveedor.codigoProveedor)
          .query(`
            SELECT CodigoBanco, CodigoAgencia, DC, CCC, IBAN
            FROM Proveedores
            WHERE CodigoProveedor = @codigoProveedor
          `);
        if (proveedorResult.recordset.length > 0) {
          const row = proveedorResult.recordset[0];
          datosBancarios = {
            codigoBanco: row.CodigoBanco || '',
            codigoAgencia: row.CodigoAgencia || '',
            dc: row.DC || '',
            ccc: row.CCC || '',
            iban: row.IBAN || ''
          };
        }

        // Remesa habitual y código tipo efecto desde ClientesConta
        const clienteContaResult = await transaction.request()
          .input('codigoProveedor', sql.VarChar, proveedor.codigoProveedor)
          .query(`
            SELECT RemesaHabitual, CodigoTipoEfecto
            FROM ClientesConta
            WHERE CodigoClienteProveedor = @codigoProveedor
              AND codigoempresa = 1
          `);
        if (clienteContaResult.recordset.length > 0) {
          const row = clienteContaResult.recordset[0];
          remesaHabitual = row.RemesaHabitual || '';
          codigoTipoEfecto = row.CodigoTipoEfecto; // puede ser null
        }

        // TipoEfecto desde TipoEfectos_
        if (codigoTipoEfecto) {
          const tipoEfectoResult = await transaction.request()
            .input('codigoTipoEfecto', sql.Int, codigoTipoEfecto)
            .query(`
              SELECT TipoEfecto
              FROM TipoEfectos_
              WHERE CodigoTipoEfecto = @codigoTipoEfecto
            `);
          if (tipoEfectoResult.recordset.length > 0) {
            tipoEfecto = tipoEfectoResult.recordset[0].TipoEfecto || '';
          }
        }
      }

      // Construir objeto de datos para efectos, omitiendo codigoTipoEfecto si es null/undefined
      const datosEfecto = {
        movPosicion: movPosicionProveedor,
        ejercicio: ejercicio,
        codigoEmpresa: 1,
        idDelegacion: idDelegacion,
        fechaAsiento: fechaAsientoStr,
        fechaVencimiento: fechaVencimientoStr,
        importe: totalFactura,
        comentario: comentarioCorto,
        codigoClienteProveedor: proveedor.codigoProveedor,
        factura: numDocumento,
        suFacturaNo: numFRA,
        codigoCuenta: cuentaProveedorReal,
        serieFactura: serie,
        esPago: false,
        codigoCanal: codigoCanal,
        tipoDocumento: serie,
        remesaHabitual: remesaHabitual,
        codigoBanco: datosBancarios.codigoBanco,
        codigoAgencia: datosBancarios.codigoAgencia,
        dc: datosBancarios.dc,
        ccc: datosBancarios.ccc,
        iban: datosBancarios.iban,
        tipoEfecto: tipoEfecto
      };

      // Solo añadir codigoTipoEfecto si tiene un valor válido (no null ni undefined)
      if (codigoTipoEfecto !== null && codigoTipoEfecto !== undefined) {
        datosEfecto.codigoTipoEfecto = codigoTipoEfecto;
      }

      await gestionarEfecto(transaction, datosEfecto);
    }

    // ✅ LÍNEA 2: GASTO IVA (DEBE) - si hay IVA - ANALIZABLE (cuenta 6)
    let movPosicionIVA = null;
    if (totalIVA > 0) {
      movPosicionIVA = uuidv4();

      await insertarMovimiento({
        movPosicion: movPosicionIVA,
        cargoAbono: 'D',
        codigoCuenta: cuentaGasto,
        importe: totalIVA,
        esVencimiento: false
      });
    }

    // ✅ LÍNEA 3: GASTO (DEBE) - ANALIZABLE (cuenta 6)
    const movPosicionGasto = uuidv4();

    await insertarMovimiento({
      movPosicion: movPosicionGasto,
      cargoAbono: 'D',
      codigoCuenta: cuentaGasto,
      importe: totalBase,
      esVencimiento: false
    });

    // ✅ LÍNEA 4: RETENCIÓN (HABER) - si hay retención - NO analizable (cuenta 475)
    let movPosicionRetencion = null;

    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();

      // 🔍 BUSCAR CUENTA DE RETENCIÓN CORRECTA
      const detalleConRetencion = detalles.find(d => d.cuentaAbonoRetencion);
      if (detalleConRetencion?.cuentaAbonoRetencion) {
        cuentaRetencionForm4 = detalleConRetencion.cuentaAbonoRetencion;
      } else {
        // Buscar en la primera línea con retención
        const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
        try {
          const retencionResult = await transaction.request()
            .input('PorcentajeRetencion', sql.Decimal(5, 2), parseFloat(retencionPrincipal))
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

      await insertarMovimiento({
        movPosicion: movPosicionRetencion,
        cargoAbono: 'H',
        codigoCuenta: cuentaRetencionForm4,
        importe: totalRetencion,
        esVencimiento: false,
        esRetencion: true
      });
    }

    // ✅ MOVIMIENTOSFACTURAS
    let codigoFacturaParaMovimientos = proveedor.codigoProveedor;
    let cuentaFacturaParaMovimientos = cuentaProveedorReal;

    if (proveedor.codigoProveedor === '4000') {
      codigoFacturaParaMovimientos = '40000000';
      cuentaFacturaParaMovimientos = '40000000';
    } else if (proveedor.codigoProveedor === '4100') {
      codigoFacturaParaMovimientos = '41000000';
      cuentaFacturaParaMovimientos = '41000000';
    }

    const retencionPrincipal = detalles[0]?.retencion || (totalRetencion > 0 ? '15' : '0');
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

    // ✅ MOVIMIENTOSIVA (si hay IVA) - MÚLTIPLES LÍNEAS
    if (totalIVA > 0 && movPosicionIVA) {
      console.log(`Insertando ${lineasIVA.length} líneas en MovimientosIva para factura IVA no deducible...`);

      // Insertar una línea en MovimientosIva por cada línea de detalle con IVA
      for (let i = 0; i < lineasIVA.length; i++) {
        const linea = lineasIVA[i];
        if (linea.base > 0 && linea.tipoIVA > 0) {
          // ✅ VALIDAR Y CONVERTIR EL TIPO DE IVA A ENTERO
          let codigoIva = Math.round(linea.tipoIVA);

          // Verificar que sea un número válido
          if (isNaN(codigoIva) || codigoIva < 0 || codigoIva > 100) {
            console.warn(`Tipo de IVA inválido en línea ${i + 1}: ${linea.tipoIVA}, usando 0`);
            codigoIva = 0;
          }

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
            .input('BaseIva', sql.Decimal(18, 2), linea.base)
            .input('PorcentajeBaseCorrectora', sql.Decimal(18, 2), 0)
            .input('PorcentajeIva', sql.Decimal(18, 2), linea.tipoIVA)
            .input('CuotaIva', sql.Decimal(18, 2), linea.iva)
            .input('PorcentajeRecargoEquivalencia', sql.Decimal(18, 2), 0)
            .input('RecargoEquivalencia', sql.Decimal(18, 2), 0)
            .input('CodigoTransaccion', sql.TinyInt, 1)
            .input('Deducible', sql.SmallInt, 0) // ← ¡IMPORTANTE! 0 = IVA NO DEDUCIBLE (para formpage4)
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

          console.log(`  Línea ${linea.orden}: Base ${linea.base}, IVA ${linea.tipoIVA}%, Cuota ${linea.iva}, No deducible`);
        }
      }
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

    // ============================================================
    // 🆕 INSERCIÓN EN ANAMOVIMIENTOS (ANALÍTICA) PARA CADA MOVIMIENTO ANALIZABLE
    // ============================================================

    if (movimientosAnalitica.length > 0) {
      // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ANALÍTICA DE FORMA ATÓMICA
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

      // Insertar un registro en AnaMovimientos por cada movimiento analizable
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
          .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento)
          .input('CodigoSeccion', sql.VarChar(10), codigoSeccion)
          .input('CodigoProyecto', sql.VarChar(10), codigoProyecto)
          .input('CodigoCanal', sql.VarChar(10), codigoCanal)
          .input('IdDelegacion', sql.VarChar(10), idDelegacion)
          .input('CodigoCuenta', sql.VarChar(15), mov.codigoCuenta) // Campo adicional
          .input('Serie', sql.VarChar(10), serie || '')
          .query(`
            INSERT INTO AnaMovimientos (
                CabPosicion, Asiento, CodigoEmpresa, Ejercicio, CargoAbono, AnaCodigoCuenta,
                Comentario, TipoDocumento, DocumentoConta, FechaAsiento, FechaGrabacion, ImporteAsiento,
                EnEuros_, StatusAcumulado, StatusGenerado, DesgloseAna, CodigoDepartamento, CodigoSeccion,
                CodigoProyecto, CodigoCanal, IdDelegacion, CodigoCuenta, Serie
            ) VALUES (
                @CabPosicion, @Asiento, @CodigoEmpresa, @Ejercicio, @CargoAbono, @AnaCodigoCuenta,
                @Comentario, @TipoDocumento, @DocumentoConta, CONVERT(DATE, @FechaAsiento), @FechaGrabacion, @ImporteAsiento,
                @EnEuros_, @StatusAcumulado, @StatusGenerado, @DesgloseAna, @CodigoDepartamento, @CodigoSeccion,
                @CodigoProyecto, @CodigoCanal, @IdDelegacion, @CodigoCuenta, @Serie
            )
          `);
      }
    }

    // ✅ COMMIT EXITOSO
    await transaction.commit();
    transactionIniciada = false;

    res.json({
      success: true,
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) creado correctamente. Analítica generada para ${movimientosAnalitica.length} movimientos.`,
      detalles: {
        lineas: totalRetencion > 0 ? 4 : 3,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura,
        cuentaRetencion: cuentaRetencionForm4,
        lineasIVADetalladas: lineasIVA.length,
        tipoIVA: "No deducible",
        datosAnaliticos: {
          codigoCanal: codigoCanal,
          codigoProyecto: codigoProyecto,
          codigoSeccion: codigoSeccion,
          codigoDepartamento: codigoDepartamento,
          idDelegacion: idDelegacion
        },
        movimientosAnalitica: movimientosAnalitica.length
      }
    });

  } catch (err) {
    console.error('❌ Error en endpoint factura-iva-no-deducible:', err.message);
    console.error('Stack trace:', err.stack);

    if (err.message.includes('Conversion failed when converting the varchar')) {
      console.error('🔍 DATOS DE ENTRADA PARA DEPURACIÓN:');
      console.error('Detalles recibidos:', JSON.stringify(req.body.detalles, null, 2));
      console.error('Proveedor:', req.body.proveedor);
      console.error('Concepto:', req.body.concepto);
    }

    if (transaction && transactionIniciada) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Error en rollback:', rollbackErr.message);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Error creando asiento: ' + err.message,
      detalles: err.details || null
    });
  }
});

// ============================================
// 🧾 ENDPOINT FORMPAGE5 - PAGO PROVEEDOR (CORREGIDO)
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

    // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ASIENTOS CONTABLES DE FORMA ATÓMICA
    const contadorResult = await transaction.request()
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

    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }

    const siguienteAsiento = contadorResult.recordset[0].ValorAnterior;

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

    // VALIDACIONES
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

    // ✅ BUSCAR CUENTA CONTABLE DEL PROVEEDOR
    let cuentaProveedorReal = proveedor.cuentaProveedor || '40000000';
    try {
      const cuentaContableResult = await transaction.request()
        .input('codigoProveedor', sql.VarChar, proveedor.codigoProveedor)
        .query(`
          SELECT CodigoCuenta 
          FROM ClientesConta 
          WHERE CodigoClienteProveedor = @codigoProveedor
            AND codigoempresa = 1
        `);

      if (cuentaContableResult.recordset.length > 0) {
        cuentaProveedorReal = cuentaContableResult.recordset[0].CodigoCuenta;
      }
    } catch (error) {
      console.warn('Usando cuenta por defecto para proveedor:', error.message);
    }

    // ✅ CALCULAR TOTALES CON DESGLOSE POR LÍNEA Y VALIDACIÓN ROBUSTA
    let totalBase = 0;
    let totalIVA = 0;
    let totalRetencion = 0;
    let lineasIVA = [];
    let cuentaRetencion = '475100000';

    detalles.forEach((linea, index) => {
      try {
        const base = parseFloat(linea.base);
        const tipoIVA = parseFloat(linea.tipoIVA);
        const retencion = parseFloat(linea.retencion);

        if (isNaN(base) || base <= 0) {
          console.warn(`Línea ${index + 1}: Base inválida o cero, omitiendo`);
          return;
        }

        if (isNaN(tipoIVA)) {
          console.warn(`Línea ${index + 1}: Tipo IVA inválido, usando 0%`);
          tipoIVA = 0;
        }

        if (isNaN(retencion)) {
          console.warn(`Línea ${index + 1}: Retención inválida, usando 0%`);
          retencion = 0;
        }

        const iva = (base * tipoIVA) / 100;
        const cuotaRetencion = (base * retencion) / 100;

        totalBase += base;
        totalIVA += iva;
        totalRetencion += cuotaRetencion;

        lineasIVA.push({
          orden: index + 1,
          base,
          tipoIVA,
          iva,
          retencion,
          cuentaAbonoRetencion: linea.cuentaAbonoRetencion
        });

        if (linea.cuentaAbonoRetencion && linea.cuentaAbonoRetencion.trim() !== '') {
          cuentaRetencion = linea.cuentaAbonoRetencion.trim();
        }
      } catch (error) {
        console.error(`Error procesando línea ${index + 1}:`, error.message);
      }
    });

    if (lineasIVA.length === 0) {
      throw new Error('No hay líneas válidas con base mayor a cero');
    }

    totalBase = parseFloat(totalBase.toFixed(2));
    totalIVA = parseFloat(totalIVA.toFixed(2));
    totalRetencion = parseFloat(totalRetencion.toFixed(2));
    const totalFactura = parseFloat((totalBase + totalIVA - totalRetencion).toFixed(2));

    // ✅ COMENTARIOS SEPARADOS
    const comentarioFactura = (concepto || '').trim().substring(0, 40);
    const comentarioPago = `PAGO ${concepto || ''}`.trim().substring(0, 40);

    // ✅ ARRAY PARA GUARDAR MOVIMIENTOS ANALIZABLES (SOLO CUENTAS 6 Y 7)
    const movimientosAnalitica = [];

    // ✅ FUNCIÓN AUXILIAR PARA INSERTAR MOVIMIENTOS (con recolección de analítica)
    const insertarMovimiento = async (params) => {
      const {
        movPosicion,
        cargoAbono,
        codigoCuenta,
        importe,
        comentario,
        esVencimiento = false,
        contrapartida = ''
      } = params;

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
        .input('ImporteAsiento', sql.Decimal(18, 2), importe)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), codigoCanal || '')
        .input('CodigoDepartamento', sql.VarChar(10), codigoDepartamento || '')
        .input('CodigoSeccion', sql.VarChar(10), codigoSeccion || '')
        .input('CodigoProyecto', sql.VarChar(10), codigoProyecto || '')
        .input('IdDelegacion', sql.VarChar(10), idDelegacion || '')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), esVencimiento ? 'P' : '')
        .input('FechaVencimiento', sql.VarChar, null)
        .input('NumeroPeriodo', sql.TinyInt, new Date(fechaAsientoStr).getMonth() + 1)
        .input('StatusConciliacion', sql.TinyInt, 0)
        .input('StatusSaldo', sql.TinyInt, 0)
        .input('StatusTraspaso', sql.TinyInt, 0)
        .input('StatusAnalitica', sql.SmallInt, -1)
        .input('CodigoUsuario', sql.TinyInt, 1)
        .input('FechaGrabacion', sql.DateTime, fechaGrabacion)
        .query(`
          INSERT INTO Movimientos 
          (MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, 
           Contrapartida, FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, 
           StatusAcumulacion, CodigoDiario, CodigoCanal, CodigoDepartamento, CodigoSeccion, CodigoProyecto, IdDelegacion, CodigoActividad, Previsiones, FechaVencimiento, NumeroPeriodo,
           StatusConciliacion, StatusSaldo, StatusTraspaso, StatusAnalitica, CodigoUsuario, FechaGrabacion)
          VALUES 
          (@MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta,
           @Contrapartida, CONVERT(DATE, @FechaAsiento), @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, 
           @StatusAcumulacion, @CodigoDiario, @CodigoCanal, @CodigoDepartamento, @CodigoSeccion, @CodigoProyecto, @IdDelegacion, @CodigoActividad, @Previsiones, CONVERT(DATE, @FechaVencimiento), @NumeroPeriodo,
           @StatusConciliacion, @StatusSaldo, @StatusTraspaso, @StatusAnalitica, @CodigoUsuario, @FechaGrabacion)
        `);

      // 🔍 Si la cuenta es analizable (solo 6 o 7), guardamos para después
      if (codigoCuenta.startsWith('6') || codigoCuenta.startsWith('7')) {
        movimientosAnalitica.push({
          movPosicion,
          cargoAbono,
          codigoCuenta,
          importe,
          comentario
        });
      }
    };

    // ============================================
    // PRIMERA PARTE: ASIENTO DE FACTURA
    // (3 líneas con comentario normal - sin "PAGO")
    // ============================================

    // ✅ LÍNEA 1 - PROVEEDOR (HABER) - FACTURA (NO analizable, cuenta 4)
    const movPosicionProveedorHaber = uuidv4();

    await insertarMovimiento({
      movPosicion: movPosicionProveedorHaber,
      cargoAbono: 'H',
      codigoCuenta: cuentaProveedorReal,
      importe: totalFactura,
      comentario: comentarioFactura,
      contrapartida: cuentaCaja
    });

    // ✅ LÍNEA 2 - GASTO (BASE) - DEBE (analizable, cuenta 6)
    const movPosicionGastoBase = uuidv4();

    await insertarMovimiento({
      movPosicion: movPosicionGastoBase,
      cargoAbono: 'D',
      codigoCuenta: cuentaGasto,
      importe: totalBase,
      comentario: comentarioFactura
    });

    // ✅ LÍNEA 3 - GASTO (IVA) - DEBE (analizable, cuenta 6)
    let movPosicionGastoIVA = null;
    if (totalIVA > 0) {
      movPosicionGastoIVA = uuidv4();

      await insertarMovimiento({
        movPosicion: movPosicionGastoIVA,
        cargoAbono: 'D',
        codigoCuenta: cuentaGasto,
        importe: totalIVA,
        comentario: comentarioFactura
      });
    }

    // ============================================
    // SEGUNDA PARTE: ASIENTO DE PAGO
    // (2-3 líneas con comentario "PAGO" prefijo)
    // ============================================

    // ✅ LÍNEA 4 - CAJA (HABER) - PAGO (analizable si es cuenta 6/7, pero normalmente es 570, así que no se incluirá)
    const movPosicionCaja = uuidv4();

    await insertarMovimiento({
      movPosicion: movPosicionCaja,
      cargoAbono: 'H',
      codigoCuenta: cuentaCaja,
      importe: totalFactura,
      comentario: comentarioPago,
      contrapartida: cuentaProveedorReal
    });

    // ✅ LÍNEA 5 - PROVEEDOR (DEBE) - PAGO (NO analizable, cuenta 4)
    const movPosicionProveedorDebe = uuidv4();

    await insertarMovimiento({
      movPosicion: movPosicionProveedorDebe,
      cargoAbono: 'D',
      codigoCuenta: cuentaProveedorReal,
      importe: totalFactura,
      comentario: comentarioPago,
      contrapartida: cuentaCaja
    });

    // ✅ LÍNEA 6 - RETENCIÓN (HABER) - SOLO SI HAY RETENCIÓN (NO analizable, cuenta 475)
    let movPosicionRetencion = null;
    if (totalRetencion > 0) {
      movPosicionRetencion = uuidv4();

      // 🔍 BUSCAR CUENTA DE ABONO CORRECTA DESDE TIPOSRETENCION
      if (!cuentaRetencion || cuentaRetencion === '475100000') {
        let retencionValida = 0;
        for (const linea of detalles) {
          const ret = parseFloat(linea.retencion);
          if (!isNaN(ret) && ret > 0) {
            retencionValida = ret;
            break;
          }
        }

        if (retencionValida > 0) {
          try {
            const retencionResult = await transaction.request()
              .input('PorcentajeRetencion', sql.Decimal(5, 2), retencionValida)
              .query(`
                SELECT TOP 1 CuentaAbono 
                FROM TiposRetencion 
                WHERE [%Retencion] = @PorcentajeRetencion
                ORDER BY CodigoRetencion
              `);

            if (retencionResult.recordset.length > 0) {
              cuentaRetencion = retencionResult.recordset[0].CuentaAbono.trim();
            } else {
              if (retencionValida === 15) cuentaRetencion = '475100000';
              else if (retencionValida === 19) cuentaRetencion = '475200000';
              else if (retencionValida === 7) cuentaRetencion = '475300000';
            }
          } catch (error) {
            console.error('Error buscando cuenta de retención:', error);
            cuentaRetencion = '475100000';
          }
        }
      }

      await insertarMovimiento({
        movPosicion: movPosicionRetencion,
        cargoAbono: 'H',
        codigoCuenta: cuentaRetencion,
        importe: totalRetencion,
        comentario: comentarioPago
      });
    }

    // ============================================
    // ✅ MOVIMIENTOSFACTURAS
    // ============================================

    let retencionPrincipal = 0;
    let porcentajeRetencion = 0;
    for (const linea of detalles) {
      const ret = parseFloat(linea.retencion);
      if (!isNaN(ret) && ret > 0) {
        retencionPrincipal = ret;
        porcentajeRetencion = ret;
        break;
      }
    }

    if (totalRetencion > 0 && retencionPrincipal === 0) {
      retencionPrincipal = 15;
      porcentajeRetencion = 15;
    }

    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedorHaber)
      .input('TipoMov', sql.TinyInt, 0)
      .input('CodigoEmpresa', sql.SmallInt, 1)
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
      .input('CodigoCuentaFactura', sql.VarChar(15), cuentaProveedorReal)
      .input('CifDni', sql.VarChar(13), (proveedor.cif || '').substring(0, 13))
      .input('Nombre', sql.VarChar(35), (proveedor.nombre || '').substring(0, 35))
      .input('CodigoRetencion', sql.SmallInt, totalRetencion > 0 ? retencionPrincipal : 0)
      .input('BaseRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? totalBase : 0)
      .input('PorcentajeRetencion', sql.Decimal(18, 2), totalRetencion > 0 ? porcentajeRetencion : 0)
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

    // ============================================
    // ✅ MOVIMIENTOSIVA - MÚLTIPLES LÍNEAS
    // ============================================

    if (totalIVA > 0 && movPosicionGastoIVA) {
      console.log(`Insertando ${lineasIVA.length} líneas en MovimientosIva...`);

      for (let i = 0; i < lineasIVA.length; i++) {
        const linea = lineasIVA[i];
        if (linea.base > 0 && linea.tipoIVA > 0) {
          let codigoIva = Math.round(linea.tipoIVA);

          if (isNaN(codigoIva) || codigoIva < 0 || codigoIva > 100) {
            console.warn(`Tipo de IVA inválido en línea ${i + 1}: ${linea.tipoIVA}, usando 0`);
            codigoIva = 0;
          }

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
            .input('BaseIva', sql.Decimal(18, 2), linea.base)
            .input('PorcentajeBaseCorrectora', sql.Decimal(18, 2), 0)
            .input('PorcentajeIva', sql.Decimal(18, 2), linea.tipoIVA)
            .input('CuotaIva', sql.Decimal(18, 2), linea.iva)
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

    // ✅ DOCUMENTO ASOCIADO
    if (archivo && archivo.trim() !== '') {
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

    // ============================================================
    // 🆕 INSERCIÓN EN ANAMOVIMIENTOS PARA CADA MOVIMIENTO ANALIZABLE
    // ============================================================

    if (movimientosAnalitica.length > 0) {
      // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ANALÍTICA DE FORMA ATÓMICA
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

      // Insertar un registro en AnaMovimientos por cada movimiento analizable
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
          .query(`
            INSERT INTO AnaMovimientos (
                CabPosicion, Asiento, CodigoEmpresa, Ejercicio, CargoAbono, AnaCodigoCuenta,
                Comentario, TipoDocumento, DocumentoConta, FechaAsiento, FechaGrabacion, ImporteAsiento,
                EnEuros_, StatusAcumulado, StatusGenerado, DesgloseAna, CodigoDepartamento, CodigoSeccion,
                CodigoProyecto, CodigoCanal, IdDelegacion, CodigoCuenta, Serie
            ) VALUES (
                @CabPosicion, @Asiento, @CodigoEmpresa, @Ejercicio, @CargoAbono, @AnaCodigoCuenta,
                @Comentario, @TipoDocumento, @DocumentoConta, CONVERT(DATE, @FechaAsiento), @FechaGrabacion, @ImporteAsiento,
                @EnEuros_, @StatusAcumulado, @StatusGenerado, @DesgloseAna, @CodigoDepartamento, @CodigoSeccion,
                @CodigoProyecto, @CodigoCanal, @IdDelegacion, @CodigoCuenta, @Serie
            )
          `);
      }
    }

    // ✅ COMMIT EXITOSO
    await transaction.commit();

    res.json({
      success: true,
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Pago Proveedor creado correctamente. Analítica generada para ${movimientosAnalitica.length} movimientos.`,
      detalles: {
        lineas: totalRetencion > 0 ? 6 : 5,
        base: totalBase,
        iva: totalIVA,
        retencion: totalRetencion,
        total: totalFactura,
        cuentaRetencion: cuentaRetencion,
        lineasIVADetalladas: lineasIVA.length,
        movimientosAnalitica: movimientosAnalitica.length
      }
    });

  } catch (err) {
    console.error('❌ Error en endpoint pago-proveedor:', err.message);
    console.error('Stack trace:', err.stack);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Error en rollback:', rollbackErr.message);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Error creando asiento de pago: ' + err.message,
      detalles: err.details || null
    });
  }
});
// ============================================
// 💰 ENDPOINT FORMPAGE6 - INGRESO EN CAJA (CORREGIDO)
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
    
    // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ASIENTOS CONTABLES DE FORMA ATÓMICA
    const contadorResult = await transaction.request()
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
    
    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }
    
    const siguienteAsiento = contadorResult.recordset[0].ValorAnterior;
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

    // Cuenta fija para ingresos (grupo 5, no analizable)
    const cuentaIngresoFija = '51900000';
    const importeDecimal = parseFloat(importe);
    const comentarioCorto = comentario || `${concepto}`.trim().substring(0, 40);

    // ✅ ARRAY PARA GUARDAR MOVIMIENTOS ANALIZABLES (SOLO CUENTAS 6 Y 7)
    const movimientosAnalitica = [];

    // ============================================
    // ✅ LÍNEA 1: CAJA (DEBE) - Puede ser 570, pero NO se incluye en analítica
    // ============================================
    const movPosicionCaja = uuidv4();
    const cuentaCajaUsar = cuentaCajaBody || cuentaCaja; // Puede venir del body o de la sesión
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 1)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCajaUsar)
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

    // 🚫 La cuenta de caja (570) NO se añade a analítica porque no es 6 ni 7.
    // (Eliminado el bloque que antes la incluía)

    // ============================================
    // ✅ LÍNEA 2: INGRESO (HABER) - Cuenta fija 51900000 (NO analizable)
    // ============================================
    const movPosicionIngreso = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionIngreso)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 1)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaIngresoFija)
      .input('Contrapartida', sql.VarChar(15), cuentaCajaUsar)
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

    // El ingreso es cuenta 5, no se añade a analítica

    // ============================================
    // ✅ DOCUMENTO ASOCIADO (si existe)
    // ============================================
    if (archivo) {
      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
          .input('PathUbicacion', sql.VarChar(500), archivo)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }

    // ============================================================
    // 🆕 INSERCIÓN EN ANAMOVIMIENTOS (ANALÍTICA) 
    // ============================================================
    // Como hemos eliminado la cuenta 570, movimientosAnalitica estará vacío,
    // por lo que no se insertará nada en AnaMovimientos. Esto es correcto.
    if (movimientosAnalitica.length > 0) {
      // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ANALÍTICA DE FORMA ATÓMICA
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

      // Insertar un registro en AnaMovimientos por cada movimiento analizable
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
          .input('CodigoCuenta', sql.VarChar(15), mov.codigoCuenta) // Campo adicional si existe
          .input('Serie', sql.VarChar(10), serie || '')
          .query(`
            INSERT INTO AnaMovimientos (
                CabPosicion, Asiento, CodigoEmpresa, Ejercicio, CargoAbono, AnaCodigoCuenta,
                Comentario, TipoDocumento, DocumentoConta, FechaAsiento, FechaGrabacion, ImporteAsiento,
                EnEuros_, StatusAcumulado, StatusGenerado, DesgloseAna, CodigoDepartamento, CodigoSeccion,
                CodigoProyecto, CodigoCanal, IdDelegacion, CodigoCuenta, Serie
            ) VALUES (
                @CabPosicion, @Asiento, @CodigoEmpresa, @Ejercicio, @CargoAbono, @AnaCodigoCuenta,
                @Comentario, @TipoDocumento, @DocumentoConta, CONVERT(DATE, @FechaAsiento), @FechaGrabacion, @ImporteAsiento,
                @EnEuros_, @StatusAcumulado, @StatusGenerado, @DesgloseAna, @CodigoDepartamento, @CodigoSeccion,
                @CodigoProyecto, @CodigoCanal, @IdDelegacion, @CodigoCuenta, @Serie
            )
          `);
      }
    }

    // ✅ COMMIT EXITOSO
    await transaction.commit();
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Ingreso en Caja creado correctamente. Analítica generada para ${movimientosAnalitica.length} movimientos.`,
      detalles: {
        lineas: 2,
        debe: importeDecimal,
        haber: importeDecimal,
        documentoAsociado: archivo ? 'Sí' : 'No',
        datosAnaliticos: {
          codigoCanal: codigoCanal || '',
          codigoDepartamento: codigoDepartamento || '',
          codigoSeccion: codigoSeccion || '',
          codigoProyecto: codigoProyecto || '',
          idDelegacion: idDelegacion || ''
        },
        movimientosAnalitica: movimientosAnalitica.length
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
// 💰 ENDPOINT FORMPAGE7 - GASTO DIRECTO EN CAJA (CORREGIDO)
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
    
    // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ASIENTOS DE FORMA ATÓMICA
    const contadorResult = await transaction.request()
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
    
    if (contadorResult.recordset.length === 0) {
      throw new Error('Contador de asientos no encontrado');
    }
    
    const siguienteAsiento = contadorResult.recordset[0].ValorAnterior;
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

    // ✅ ARRAY PARA GUARDAR MOVIMIENTOS ANALIZABLES (SOLO CUENTAS 6 Y 7)
    const movimientosAnalitica = [];

    // ============================================
    // ✅ LÍNEA 1: GASTO (DEBE) - ANALIZABLE (cuenta 6)
    // ============================================
    const movPosicionGasto = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 1)
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

    // 🔍 Si la cuenta de gasto es analizable (6 o 7), la guardamos. En este caso es 6, así que se guarda.
    if (cuentaGasto.startsWith('6') || cuentaGasto.startsWith('7')) {
      movimientosAnalitica.push({
        movPosicion: movPosicionGasto,
        cargoAbono: 'D',
        codigoCuenta: cuentaGasto,
        importe: importeDecimal,
        comentario: comentarioCorto
      });
    }

    // ============================================
    // ✅ LÍNEA 2: CAJA (HABER) - Puede ser 570, pero NO se incluye en analítica
    // ============================================
    const cuentaCajaUsar = cuentaCajaBody || cuentaCaja;
    const movPosicionCaja = uuidv4();
    
    await transaction.request()
      .input('MovPosicion', sql.UniqueIdentifier, movPosicionCaja)
      .input('Ejercicio', sql.SmallInt, ejercicio)
      .input('CodigoEmpresa', sql.SmallInt, 1)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(15), cuentaCajaUsar)
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

    // 🚫 La cuenta de caja (570) NO se añade a analítica porque no es 6 ni 7.

    // ============================================
    // ✅ DOCUMENTO ASOCIADO
    // ============================================
    if (archivo) {
      try {
        await transaction.request()
          .input('MovPosicion', sql.UniqueIdentifier, movPosicionGasto)
          .input('PathUbicacion', sql.VarChar(500), archivo)
          .input('CodigoTipoDocumento', sql.VarChar(50), 'PDF')
          .query(`
            INSERT INTO DocumentoAsociado (MovPosicion, PathUbicacion, CodigoTipoDocumento)
            VALUES (@MovPosicion, @PathUbicacion, @CodigoTipoDocumento)
          `);
      } catch (error) {
        throw new Error(`Error al guardar documento asociado: ${error.message}`);
      }
    }

    // ============================================================
    // 🆕 INSERCIÓN EN ANAMOVIMIENTOS (ANALÍTICA) PARA CADA MOVIMIENTO ANALIZABLE
    // ============================================================
    if (movimientosAnalitica.length > 0) {
      // 🔁 OBTENER Y ACTUALIZAR CONTADOR DE ANALÍTICA DE FORMA ATÓMICA
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

      // Insertar un registro en AnaMovimientos por cada movimiento analizable
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
          .input('CodigoCuenta', sql.VarChar(15), mov.codigoCuenta) // Campo adicional si existe
          .input('Serie', sql.VarChar(10), serie || '')
          .query(`
            INSERT INTO AnaMovimientos (
                CabPosicion, Asiento, CodigoEmpresa, Ejercicio, CargoAbono, AnaCodigoCuenta,
                Comentario, TipoDocumento, DocumentoConta, FechaAsiento, FechaGrabacion, ImporteAsiento,
                EnEuros_, StatusAcumulado, StatusGenerado, DesgloseAna, CodigoDepartamento, CodigoSeccion,
                CodigoProyecto, CodigoCanal, IdDelegacion, CodigoCuenta, Serie
            ) VALUES (
                @CabPosicion, @Asiento, @CodigoEmpresa, @Ejercicio, @CargoAbono, @AnaCodigoCuenta,
                @Comentario, @TipoDocumento, @DocumentoConta, CONVERT(DATE, @FechaAsiento), @FechaGrabacion, @ImporteAsiento,
                @EnEuros_, @StatusAcumulado, @StatusGenerado, @DesgloseAna, @CodigoDepartamento, @CodigoSeccion,
                @CodigoProyecto, @CodigoCanal, @IdDelegacion, @CodigoCuenta, @Serie
            )
          `);
      }
    }

    // ✅ COMMIT EXITOSO
    await transaction.commit();
    
    res.json({ 
      success: true, 
      asiento: siguienteAsiento,
      ejercicio: ejercicio,
      message: `Asiento #${siguienteAsiento} (Ejercicio ${ejercicio}) - Gasto Directo en Caja creado correctamente. Analítica generada para ${movimientosAnalitica.length} movimientos.`,
      detalles: {
        lineas: 2,
        debe: importeDecimal,
        haber: importeDecimal,
        documentoAsociado: archivo ? 'Sí' : 'No',
        datosAnaliticos: {
          codigoCanal: codigoCanal || '',
          codigoDepartamento: codigoDepartamento || '',
          codigoSeccion: codigoSeccion || '',
          codigoProyecto: codigoProyecto || '',
          idDelegacion: idDelegacion || ''
        },
        movimientosAnalitica: movimientosAnalitica.length
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
      WHERE ce.codigoempresa = 1
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
      WHERE m.codigoempresa = 1
        AND m.CodigoCanal = @CodigoCanal
        AND m.TipoMov = 0
    `;
    
    let queryStats = `
      SELECT 
        COUNT(*) as TotalAsientos,
        SUM(CASE WHEN CargoAbono = 'D' THEN ImporteAsiento ELSE 0 END) as TotalDebe,
        SUM(CASE WHEN CargoAbono = 'H' THEN ImporteAsiento ELSE 0 END) as TotalHaber
      FROM Movimientos 
      WHERE codigoempresa = 1
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
        WHERE codigoempresa = 1
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
      WHERE m.codigoempresa = 1
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

