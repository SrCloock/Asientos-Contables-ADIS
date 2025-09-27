const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const session = require('express-session');
const app = express();
const PORT = 5000;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Configuración de sesiones
app.use(session({
  secret: 'sage200-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Configuración de conexión a SQL Server
const dbConfig = {
  user: 'logic',
  password: 'Sage2024+',
  server: 'SVRALANDALUS',
  database: 'DEMOS',
  options: {
    trustServerCertificate: true,
    useUTC: false,
    dateStrings: true,
    enableArithAbort: true,
    requestTimeout: 60000
  }
};

// Pool de conexión global
let pool;

// Conectar a la base de datos
async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('Conectado a SQL Server');
  } catch (err) {
    console.error('Error de conexión a la base de datos:', err);
  }
}

connectDB();

// Middleware para verificar conexión a BD
app.use(async (req, res, next) => {
  if (!pool) {
    return res.status(500).json({ error: 'Base de datos no conectada' });
  }
  next();
});

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
};

// Endpoint de login
app.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body;

  try {
    const result = await pool.request()
      .input('usuario', sql.VarChar, usuario)
      .input('contrasena', sql.VarChar, contrasena)
      .query(`
        SELECT *, 
               SerieFacturacion as serie, 
               CodigoAnalitico as analitico
        FROM Clientes
        WHERE CodigoCategoriaCliente_ = 'emp'
          AND UsuarioLogicNet = @usuario 
          AND ContraseñaLogicNet = @contrasena
      `);

    if (result.recordset.length > 0) {
      const userData = result.recordset[0];
      req.session.user = userData;
      
      res.json({ 
        success: true, 
        message: 'Login correcto', 
        user: userData
      });
    } else {
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Endpoint de logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  });
});

// Endpoint para verificar sesión
app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// Endpoint para obtener proveedores (protegido)
app.get('/api/proveedores', requireAuth, async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        CodigoProveedor as codigo,
        CifDni as cif,
        RazonSocial as nombre,
        CodigoPostal as cp
      FROM Proveedores
      WHERE CodigoEmpresa = 9999
      ORDER BY RazonSocial
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error obteniendo proveedores:', err);
    res.status(500).json({ error: 'Error obteniendo proveedores' });
  }
});

// Obtener siguiente número de asiento (protegido)
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

    res.json({ contador: result.recordset[0].sysContadorValor });
  } catch (err) {
    console.error('Error obteniendo contador:', err);
    res.status(500).json({ error: 'Error obteniendo contador' });
  }
});

// Endpoint para crear asiento (Factura/Gasto) - Protegido
app.post('/api/asiento/factura', requireAuth, async (req, res) => {
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    
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
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const fechaAsiento = new Date();
    const numeroPeriodo = fechaAsiento.getMonth() + 1;
    
    // 2. Insertar líneas del asiento en Movimientos
    const { detalles, proveedor, tipo, serie, numDocumento, fechaReg, fechaFactura, fechaOper, vencimiento, numFRA } = req.body;
    
    for (const linea of detalles) {
      const base = parseFloat(linea.base) || 0;
      const iva = parseFloat(linea.cuotaIVA) || 0;
      const retencion = parseFloat(linea.cuotaRetencion) || 0;
      
      // Solo procesar si hay base
      if (base > 0) {
        const numFactura = numFRA || `${serie}-${numDocumento}`;
        
        // Línea de IVA (Débito)
        if (iva > 0) {
          await transaction.request()
            .input('Ejercicio', sql.SmallInt, 2025)
            .input('CodigoEmpresa', sql.SmallInt, 9999)
            .input('TipoMov', sql.TinyInt, 0)
            .input('Asiento', sql.Int, siguienteAsiento)
            .input('CargoAbono', sql.VarChar, 'D')
            .input('CodigoCuenta', sql.VarChar, '472000000')
            .input('Contrapartida', sql.VarChar, proveedor.cuentaProveedor || '400000000')
            .input('FechaAsiento', sql.DateTime, fechaAsiento)
            .input('TipoDocumento', sql.VarChar, 'FRA')
            .input('DocumentoConta', sql.VarChar, numFactura)
            .input('Comentario', sql.VarChar, `Factura ${numFactura} - IVA ${linea.tipoIVA}%`)
            .input('ImporteAsiento', sql.Decimal(18, 2), iva)
            .input('FechaVencimiento', sql.DateTime, vencimiento || null)
            .input('NumeroPeriodo', sql.SmallInt, numeroPeriodo)
            .input('CodigoUsuario', sql.SmallInt, 1)
            .input('FechaGrabacion', sql.DateTime, new Date())
            .input('TipoEntrada', sql.VarChar, 'CA')
            .query(`
              INSERT INTO Movimientos 
              (Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, Contrapartida, 
               FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, FechaVencimiento, NumeroPeriodo, CodigoUsuario, FechaGrabacion, TipoEntrada)
              VALUES 
              (@Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta, @Contrapartida,
               @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, @FechaVencimiento, @NumeroPeriodo, @CodigoUsuario, @FechaGrabacion, @TipoEntrada)
            `);
        }
        
        // Línea de retención (Crédito)
        if (retencion > 0) {
          await transaction.request()
            .input('Ejercicio', sql.SmallInt, 2025)
            .input('CodigoEmpresa', sql.SmallInt, 9999)
            .input('TipoMov', sql.TinyInt, 0)
            .input('Asiento', sql.Int, siguienteAsiento)
            .input('CargoAbono', sql.VarChar, 'H')
            .input('CodigoCuenta', sql.VarChar, '473000000')
            .input('Contrapartida', sql.VarChar, proveedor.cuentaProveedor || '400000000')
            .input('FechaAsiento', sql.DateTime, fechaAsiento)
            .input('TipoDocumento', sql.VarChar, 'FRA')
            .input('DocumentoConta', sql.VarChar, numFactura)
            .input('Comentario', sql.VarChar, `Factura ${numFactura} - Retención ${linea.retencion}%`)
            .input('ImporteAsiento', sql.Decimal(18, 2), retencion)
            .input('FechaVencimiento', sql.DateTime, vencimiento || null)
            .input('NumeroPeriodo', sql.SmallInt, numeroPeriodo)
            .input('CodigoUsuario', sql.SmallInt, 1)
            .input('FechaGrabacion', sql.DateTime, new Date())
            .input('TipoEntrada', sql.VarChar, 'CA')
            .query(`
              INSERT INTO Movimientos 
              (Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, Contrapartida, 
               FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, FechaVencimiento, NumeroPeriodo, CodigoUsuario, FechaGrabacion, TipoEntrada)
              VALUES 
              (@Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta, @Contrapartida,
               @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, @FechaVencimiento, @NumeroPeriodo, @CodigoUsuario, @FechaGrabacion, @TipoEntrada)
            `);
        }
        
        // Línea principal (Débito)
        const cuentaPrincipal = tipo === 'factura' ? '600000000' : '622000000';
        await transaction.request()
          .input('Ejercicio', sql.SmallInt, 2025)
          .input('CodigoEmpresa', sql.SmallInt, 9999)
          .input('TipoMov', sql.TinyInt, 0)
          .input('Asiento', sql.Int, siguienteAsiento)
          .input('CargoAbono', sql.VarChar, 'D')
          .input('CodigoCuenta', sql.VarChar, cuentaPrincipal)
          .input('Contrapartida', sql.VarChar, proveedor.cuentaProveedor || '400000000')
          .input('FechaAsiento', sql.DateTime, fechaAsiento)
          .input('TipoDocumento', sql.VarChar, 'FRA')
          .input('DocumentoConta', sql.VarChar, numFactura)
          .input('Comentario', sql.VarChar, `Factura ${numFactura} - Base imponible`)
          .input('ImporteAsiento', sql.Decimal(18, 2), base)
          .input('FechaVencimiento', sql.DateTime, vencimiento || null)
          .input('NumeroPeriodo', sql.SmallInt, numeroPeriodo)
          .input('CodigoUsuario', sql.SmallInt, 1)
          .input('FechaGrabacion', sql.DateTime, new Date())
          .input('TipoEntrada', sql.VarChar, 'CA')
          .query(`
            INSERT INTO Movimientos 
            (Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, Contrapartida, 
             FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, FechaVencimiento, NumeroPeriodo, CodigoUsuario, FechaGrabacion, TipoEntrada)
            VALUES 
            (@Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta, @Contrapartida,
             @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, @FechaVencimiento, @NumeroPeriodo, @CodigoUsuario, @FechaGrabacion, @TipoEntrada)
          `);
      }
    }
    
    // 3. Actualizar contador
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
    res.json({ success: true, asiento: siguienteAsiento });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creando asiento:', err);
    res.status(500).json({ error: 'Error creando asiento: ' + err.message });
  }
});

// Endpoint para crear asiento de ingreso - Protegido
app.post('/api/asiento/ingreso', requireAuth, async (req, res) => {
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    
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
    
    const siguienteAsiento = contadorResult.recordset[0].sysContadorValor;
    const fechaAsiento = new Date();
    const numeroPeriodo = fechaAsiento.getMonth() + 1;
    
    // 2. Insertar líneas del asiento en Movimientos
    const { tipoIngreso, cuentaSeleccionada, importe, concepto, serie, numDocumento } = req.body;
    
    // Determinar cuentas según el tipo de ingreso
    let cuentaContrapartida;
    let tipoEntrada;
    
    if (tipoIngreso === 'caja') {
      cuentaContrapartida = '570000000'; // Cuenta de caja
      tipoEntrada = 'CA';
    } else {
      cuentaContrapartida = '430000000'; // Cuenta de clientes
      tipoEntrada = 'CL';
    }
    
    const numDocumentoCompleto = `${serie}-${numDocumento}`;
    
    // Línea de ingreso (Haber)
    await transaction.request()
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar, 'H')
      .input('CodigoCuenta', sql.VarChar, cuentaSeleccionada)
      .input('Contrapartida', sql.VarChar, cuentaContrapartida)
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar, 'ING')
      .input('DocumentoConta', sql.VarChar, numDocumentoCompleto)
      .input('Comentario', sql.VarChar, `Ingreso ${numDocumentoCompleto} - ${concepto || 'Ingreso'}`)
      .input('ImporteAsiento', sql.Decimal(18, 2), importe)
      .input('NumeroPeriodo', sql.SmallInt, numeroPeriodo)
      .input('CodigoUsuario', sql.SmallInt, 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .input('TipoEntrada', sql.VarChar, tipoEntrada)
      .query(`
        INSERT INTO Movimientos 
        (Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, Contrapartida, 
         FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, NumeroPeriodo, CodigoUsuario, FechaGrabacion, TipoEntrada)
        VALUES 
        (@Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta, @Contrapartida,
         @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, @NumeroPeriodo, @CodigoUsuario, @FechaGrabacion, @TipoEntrada)
      `);
    
    // Línea de contrapartida (Débito)
    await transaction.request()
      .input('Ejercicio', sql.SmallInt, 2025)
      .input('CodigoEmpresa', sql.SmallInt, 9999)
      .input('TipoMov', sql.TinyInt, 0)
      .input('Asiento', sql.Int, siguienteAsiento)
      .input('CargoAbono', sql.VarChar, 'D')
      .input('CodigoCuenta', sql.VarChar, cuentaContrapartida)
      .input('Contrapartida', sql.VarChar, cuentaSeleccionada)
      .input('FechaAsiento', sql.DateTime, fechaAsiento)
      .input('TipoDocumento', sql.VarChar, 'ING')
      .input('DocumentoConta', sql.VarChar, numDocumentoCompleto)
      .input('Comentario', sql.VarChar, `Contrapartida ingreso ${numDocumentoCompleto}`)
      .input('ImporteAsiento', sql.Decimal(18, 2), importe)
      .input('NumeroPeriodo', sql.SmallInt, numeroPeriodo)
      .input('CodigoUsuario', sql.SmallInt, 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .input('TipoEntrada', sql.VarChar, tipoEntrada)
      .query(`
        INSERT INTO Movimientos 
        (Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, CodigoCuenta, Contrapartida, 
         FechaAsiento, TipoDocumento, DocumentoConta, Comentario, ImporteAsiento, NumeroPeriodo, CodigoUsuario, FechaGrabacion, TipoEntrada)
        VALUES 
        (@Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono, @CodigoCuenta, @Contrapartida,
         @FechaAsiento, @TipoDocumento, @DocumentoConta, @Comentario, @ImporteAsiento, @NumeroPeriodo, @CodigoUsuario, @FechaGrabacion, @TipoEntrada)
      `);
    
    // 3. Actualizar contador
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
    res.json({ success: true, asiento: siguienteAsiento });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creando asiento de ingreso:', err);
    res.status(500).json({ error: 'Error creando asiento de ingreso: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});