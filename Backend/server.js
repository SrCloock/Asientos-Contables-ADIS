const express = require('express');
const cors = require('cors');
const sql = require('mssql'); // Para conexión con SQL Server (Sage200)
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

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

// Credenciales hardcodeadas
const validCredentials = {
  username: "admin",
  password: "admin"
};

// Middleware de conexión a la BD
let pool;
async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('Conectado a la base de datos Sage200');
  } catch (err) {
    console.error('Error conectando a la BD:', err);
  }
}
connectDB();

// Endpoint de login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === validCredentials.username && password === validCredentials.password) {
    res.json({ success: true, message: "Login exitoso", user: { name: username } });
  } else {
    res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }
});

// Obtener el próximo número de asiento
async function getNextAsiento(ejercicio) {
  try {
    const result = await pool.request()
      .query(`SELECT MAX(CAST(Asiento AS INT)) as maxAsiento FROM Movimientos WHERE Ejercicio = '${ejercicio}'`);
    
    return (result.recordset[0].maxAsiento || 0) + 1;
  } catch (error) {
    console.error('Error obteniendo próximo asiento:', error);
    return 1;
  }
}

// Endpoint para crear asientos de factura
app.post('/api/factura', async (req, res) => {
  let transaction;
  try {
    const asientoData = req.body;
    
    // Validaciones básicas
    if (!asientoData.proveedor || !asientoData.detalles || asientoData.detalles.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Datos incompletos" 
      });
    }

    // Iniciar transacción
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Obtener próximo número de asiento
    const nextAsiento = await getNextAsiento(asientoData.ejercicio);
    
    // Generar UUIDs para cada línea del asiento
    const movPosicionPrincipal = generateUUID();
    const movPosicionRetencion = generateUUID();
    const movPosicionIVA = generateUUID();
    const movPosicionGasto = generateUUID();

    // 1. INSERTAR EN TABLA MOVIMIENTOS (4 líneas)
    
    // Línea 1: Proveedor (Haber)
    await transaction.request()
      .input('MovPosicion', sql.VarChar(50), movPosicionPrincipal)
      .input('Ejercicio', sql.VarChar(4), asientoData.ejercicio)
      .input('CodigoEmpresa', sql.VarChar(4), asientoData.codigoEmpresa)
      .input('TipoMov', sql.Int, 0)
      .input('Asiento', sql.VarChar(10), nextAsiento.toString())
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(20), asientoData.proveedor.cuenta)
      .input('Contrapartida', sql.VarChar(20), '')
      .input('FechaAsiento', sql.Date, new Date(asientoData.fechaRegistro))
      .input('Comentario', sql.VarChar(100), `S/Factura n. - ${asientoData.numeroDocumento}`)
      .input('ImporteAsiento', sql.Decimal(18, 4), asientoData.totalFactura)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('NumeroPeriodo', sql.Int, new Date().getMonth() + 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .input('CodigoConcepto', sql.Int, 6)
      .query(`INSERT INTO Movimientos (
        MovPosicion, Ejercicio, CodigoEmpresa, TipoMov, Asiento, CargoAbono, 
        CodigoCuenta, Contrapartida, FechaAsiento, Comentario, ImporteAsiento, 
        StatusAcumulacion, NumeroPeriodo, FechaGrabacion, CodigoConcepto
      ) VALUES (
        @MovPosicion, @Ejercicio, @CodigoEmpresa, @TipoMov, @Asiento, @CargoAbono,
        @CodigoCuenta, @Contrapartida, @FechaAsiento, @Comentario, @ImporteAsiento,
        @StatusAcumulacion, @NumeroPeriodo, @FechaGrabacion, @CodigoConcepto
      )`);

    // Línea 2: Retención (Haber)
    await transaction.request()
      .input('MovPosicion', sql.VarChar(50), movPosicionRetencion)
      .input('Ejercicio', sql.VarChar(4), asientoData.ejercicio)
      .input('CodigoEmpresa', sql.VarChar(4), asientoData.codigoEmpresa)
      .input('TipoMov', sql.Int, 0)
      .input('Asiento', sql.VarChar(10), nextAsiento.toString())
      .input('CargoAbono', sql.VarChar(1), 'H')
      .input('CodigoCuenta', sql.VarChar(20), '475100000')
      .input('Contrapartida', sql.VarChar(20), asientoData.proveedor.cuenta)
      .input('FechaAsiento', sql.Date, new Date(asientoData.fechaRegistro))
      .input('Comentario', sql.VarChar(100), `S/Factura n. - ${asientoData.numeroDocumento}`)
      .input('ImporteAsiento', sql.Decimal(18, 4), asientoData.retencionTotal)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('NumeroPeriodo', sql.Int, new Date().getMonth() + 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .input('CodigoConcepto', sql.Int, 0)
      .query(`INSERT INTO Movimientos VALUES (...)`);

    // Línea 3: IVA (Debe)
    await transaction.request()
      .input('MovPosicion', sql.VarChar(50), movPosicionIVA)
      .input('Ejercicio', sql.VarChar(4), asientoData.ejercicio)
      .input('CodigoEmpresa', sql.VarChar(4), asientoData.codigoEmpresa)
      .input('TipoMov', sql.Int, 0)
      .input('Asiento', sql.VarChar(10), nextAsiento.toString())
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(20), '472000000')
      .input('Contrapartida', sql.VarChar(20), asientoData.proveedor.cuenta)
      .input('FechaAsiento', sql.Date, new Date(asientoData.fechaRegistro))
      .input('Comentario', sql.VarChar(100), `S/Factura n. - ${asientoData.numeroDocumento}`)
      .input('ImporteAsiento', sql.Decimal(18, 4), asientoData.ivaTotal)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('NumeroPeriodo', sql.Int, new Date().getMonth() + 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .input('CodigoConcepto', sql.Int, 0)
      .query(`INSERT INTO Movimientos VALUES (...)`);

    // Línea 4: Gasto (Debe)
    await transaction.request()
      .input('MovPosicion', sql.VarChar(50), movPosicionGasto)
      .input('Ejercicio', sql.VarChar(4), asientoData.ejercicio)
      .input('CodigoEmpresa', sql.VarChar(4), asientoData.codigoEmpresa)
      .input('TipoMov', sql.Int, 0)
      .input('Asiento', sql.VarChar(10), nextAsiento.toString())
      .input('CargoAbono', sql.VarChar(1), 'D')
      .input('CodigoCuenta', sql.VarChar(20), asientoData.cuentaGasto)
      .input('Contrapartida', sql.VarChar(20), '')
      .input('FechaAsiento', sql.Date, new Date(asientoData.fechaRegistro))
      .input('Comentario', sql.VarChar(100), `S/Factura n. - ${asientoData.numeroDocumento}`)
      .input('ImporteAsiento', sql.Decimal(18, 4), asientoData.baseTotal)
      .input('StatusAcumulacion', sql.Int, -1)
      .input('NumeroPeriodo', sql.Int, new Date().getMonth() + 1)
      .input('FechaGrabacion', sql.DateTime, new Date())
      .input('CodigoConcepto', sql.Int, 0)
      .query(`INSERT INTO Movimientos VALUES (...)`);

    // 2. INSERTAR EN MOVIMIENTOSIVA
    await transaction.request()
      .input('CodigoEmpresa', sql.VarChar(4), asientoData.codigoEmpresa)
      .input('Ejercicio', sql.VarChar(4), asientoData.ejercicio)
      .input('MovPosicion', sql.VarChar(50), movPosicionPrincipal)
      .input('TipoMov', sql.Int, 0)
      .input('Orden', sql.Int, 1)
      .input('Año', sql.VarChar(4), asientoData.ejercicio)
      .input('CodigoIva', sql.VarChar(10), '21')
      .input('IvaPosicion', sql.VarChar(50), movPosicionIVA)
      .input('BaseIva', sql.Decimal(18, 4), asientoData.baseTotal)
      .input('%Iva', sql.Decimal(18, 4), 21.00)
      .input('CuotaIva', sql.Decimal(18, 4), asientoData.ivaTotal)
      .input('CodigoTransaccion', sql.Int, 1)
      .input('Deducible', sql.Int, -1)
      .input('BaseUtilizada', sql.Decimal(18, 4), asientoData.baseTotal + asientoData.ivaTotal)
      .query(`INSERT INTO MovimientosIva VALUES (...)`);

    // 3. INSERTAR EN MOVIMIENTOSFACTURAS
    await transaction.request()
      .input('MovPosicion', sql.VarChar(50), movPosicionPrincipal)
      .input('TipoMov', sql.Int, 0)
      .input('CodigoEmpresa', sql.VarChar(4), asientoData.codigoEmpresa)
      .input('Ejercicio', sql.VarChar(4), asientoData.ejercicio)
      .input('Año', sql.VarChar(4), asientoData.ejercicio)
      .input('Serie', sql.VarChar(10), asientoData.serie)
      .input('Factura', sql.VarChar(20), asientoData.numeroDocumento)
      .input('SuFacturaNo', sql.VarChar(20), `SF${asientoData.numeroDocumento}`)
      .input('FechaFactura', sql.Date, new Date(asientoData.fechaFactura))
      .input('Fecha347', sql.Date, new Date(asientoData.fechaFactura))
      .input('ImporteFactura', sql.Decimal(18, 4), asientoData.totalFactura)
      .input('TipoFactura', sql.VarChar(1), 'R')
      .input('CodigoCuentaFactura', sql.VarChar(20), asientoData.proveedor.cuenta)
      .input('CodigoRetencion', sql.VarChar(10), '19')
      .input('BaseRetencion', sql.Decimal(18, 4), asientoData.baseTotal)
      .input('%Retencion', sql.Decimal(18, 4), 19.00)
      .input('ImporteRetencion', sql.Decimal(18, 4), asientoData.retencionTotal)
      .input('EjercicioFactura', sql.VarChar(4), asientoData.ejercicio)
      .input('FechaOperacion', sql.Date, new Date(asientoData.fechaOperacion))
      .input('FechaLiquidacion', sql.Date, new Date(asientoData.fechaRegistro))
      .input('FechaMaxVencimiento', sql.Date, new Date(asientoData.fechaVencimiento))
      .query(`INSERT INTO MovimientosFacturas VALUES (...)`);

    // Confirmar transacción
    await transaction.commit();

    res.json({ 
      success: true, 
      message: "Asiento contable generado correctamente",
      data: {
        asiento: nextAsiento,
        movPosiciones: {
          principal: movPosicionPrincipal,
          retencion: movPosicionRetencion,
          iva: movPosicionIVA,
          gasto: movPosicionGasto
        }
      }
    });

  } catch (error) {
    // Revertir transacción en caso de error
    if (transaction) await transaction.rollback();
    
    console.error('Error al generar asiento:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error al generar asiento: " + error.message 
    });
  }
});

// Función para generar UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});