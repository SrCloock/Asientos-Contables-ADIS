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

// POST /api/asiento/factura - Crear asiento de factura/gasto - CORREGIDO COMPLETO
app.post('/api/asiento/factura', requireAuth, async (req, res) => {
  let transaction;
  
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
      pagoEfectivo,
      vencimiento  // Añadimos vencimiento del body
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
    
    // 3. Buscar la cuenta contable REAL del proveedor en ClientesConta
    let cuentaContableReal = '400000000'; // Por defecto
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
      // Continuamos con la cuenta por defecto
    }
    
    // 4. Calcular totales
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
    
    // CORRECCIÓN: Total factura = Base + IVA (sin restar retención) como en Sage200
    const totalFactura = totalBase + totalIVA;
    const numFactura = numDocumento;
    
    console.log(`💰 Totales: Base=${totalBase}, IVA=${totalIVA}, Retención=${totalRetencion}, Total=${totalFactura}`);
    
    // 5. Determinar cuentas según los datos del formulario - USANDO CUENTA REAL
    const cuentaProveedor = cuentaContableReal; // Usar la cuenta REAL de ClientesConta
    const cuentaGasto = '621000000'; // SIEMPRE 621 como en Sage200
    const cuentaCaja = '570000000';
    const cuentaContrapartida = pagoEfectivo ? cuentaCaja : cuentaProveedor;
    
    // 6. Preparar fecha de vencimiento en formato correcto
    let fechaVencimientoFormateada = null;
    if (vencimiento) {
      try {
        // Convertir la fecha de vencimiento al formato de Sage200
        const fechaVenc = new Date(vencimiento);
        fechaVencimientoFormateada = new Date(fechaVenc.getFullYear(), fechaVenc.getMonth(), fechaVenc.getDate(), 0, 0, 0, 0);
        console.log(`📅 Fecha vencimiento formateada: ${fechaVencimientoFormateada}`);
      } catch (error) {
        console.error('❌ Error formateando fecha vencimiento:', error);
        fechaVencimientoFormateada = null;
      }
    }
    
    // 7. Comentario CORTO como en Sage200
    const comentarioCorto = `Factura n. ${numFactura}`.substring(0, 40);
    console.log(`📝 Comentario: ${comentarioCorto}`);
    
    // 8. Insertar líneas del asiento en Movimientos - ESTRUCTURA SAGE200 CORREGIDA
    
    // Línea 1: Proveedor (HABER) - Total factura (base + IVA)
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
      .input('Contrapartida', sql.VarChar(15), '') // VACÍO como en Sage200
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar(6), '') // VACÍO
      .input('DocumentoConta', sql.VarChar(9), '') // VACÍO
      .input('Comentario', sql.VarChar(40), comentarioCorto)
      .input('ImporteAsiento', sql.Decimal(18, 2), totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('CodigoDiario', sql.TinyInt, 0)
      .input('CodigoCanal', sql.VarChar(10), '') // VACÍO
      .input('CodigoActividad', sql.VarChar(1), '') // VACÍO
      .input('Previsiones', sql.VarChar(1), 'P') // SIEMPRE 'P' para la línea de proveedor
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
    
    // Línea 2: IVA (DEBE) - Solo si hay IVA
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
        .input('Contrapartida', sql.VarChar(15), cuentaContrapartida) // Contrapartida a proveedor como en Sage200
        .input('FechaAsiento', sql.DateTime, fechaAsiento)
        .input('TipoDocumento', sql.VarChar(6), '')
        .input('DocumentoConta', sql.VarChar(9), '')
        .input('Comentario', sql.VarChar(40), comentarioCorto)
        .input('ImporteAsiento', sql.Decimal(18, 2), totalIVA)
        .input('StatusAcumulacion', sql.Int, -1)
        .input('CodigoDiario', sql.TinyInt, 0)
        .input('CodigoCanal', sql.VarChar(10), '')
        .input('CodigoActividad', sql.VarChar(1), '')
        .input('Previsiones', sql.VarChar(1), '') // CADENA VACÍA en lugar de NULL
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
    
    // Línea 3: Gasto/Compra (DEBE) - SIEMPRE 621 como en Sage200
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
      .input('Previsiones', sql.VarChar(1), '') // CADENA VACÍA en lugar de NULL
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
    
    // 9. Insertar en tablas relacionadas - ESTRUCTURA SAGE200 CORREGIDA
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
        .input('ImporteFactura', sql.Decimal(18, 2), totalFactura) // Base + IVA
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
    
    // Insertar en MovimientosIva - ESTRUCTURA SAGE200 CORREGIDA
    if (totalIVA > 0 && movPosicionIVA) {
      const tipoIVAPrincipal = detalles[0]?.tipoIVA || '21';
      console.log('Insertando en MovimientosIva...');
      
      await transaction.request()
        .input('CodigoEmpresa', sql.SmallInt, 9999)
        .input('Ejercicio', sql.SmallInt, 2025)
        .input('MovPosicion', sql.UniqueIdentifier, movPosicionProveedor) // MovPosicion del proveedor
        .input('TipoMov', sql.TinyInt, 0)
        .input('Orden', sql.TinyInt, 1)
        .input('Año', sql.SmallInt, 2025)
        .input('CodigoIva', sql.SmallInt, parseInt(tipoIVAPrincipal))
        .input('IvaPosicion', sql.UniqueIdentifier, movPosicionIVA) // MovPosicion del IVA
        .input('RecPosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
        .input('BasePosicion', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
        .input('BaseIva', sql.Decimal(18, 2), totalBase)
        .input('PorcentajeBaseCorrectora', sql.Decimal(18, 2), 0)
        .input('PorcentajeIva', sql.Decimal(18, 2), parseFloat(tipoIVAPrincipal))
        .input('CuotaIva', sql.Decimal(18, 2), totalIVA)
        .input('PorcentajeRecargoEquivalencia', sql.Decimal(18, 2), 0)
        .input('RecargoEquivalencia', sql.Decimal(18, 2), 0)
        .input('CodigoTransaccion', sql.TinyInt, 1) // 1 como en Sage200
        .input('Deducible', sql.SmallInt, -1)
        .input('BaseUtilizada', sql.Decimal(18, 2), totalFactura) // Base + IVA
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
    
    // 10. Actualizar contador
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
        lineas: 3, // 3 líneas como en Sage200
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