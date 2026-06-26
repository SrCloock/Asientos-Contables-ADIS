'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { connectDB, getPool, sql } = require('./db');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// ============================================
// CORS
// ============================================

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV !== 'production') return callback(null, true);
    const allowed = [
      'http://localhost:3000', 'http://127.0.0.1:3000',
      'http://localhost:5000', 'http://127.0.0.1:5000',
      'http://84.120.61.159:3000', 'http://84.120.61.159:5000',
      'http://84.120.61.159', `http://${HOST}:${PORT}`, `http://${HOST}`
    ];
    allowed.includes(origin) ? callback(null, true) : callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie', 'Set-Cookie']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================
// BODY PARSING + SESIÓN
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'sage200-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

// ============================================
// RATE LIMITING en /login
// ============================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Demasiados intentos de login. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// AUTH ENDPOINTS
// ============================================

app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await getPool().request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, password)
      .query(`
        SELECT CodigoCliente, CifDni, UsuarioLogicNet, RazonSocial, Domicilio,
               CodigoPostal, Municipio, Provincia, CodigoProvincia, CodigoNacion,
               Nacion, SiglaNacion, StatusAdministrador, CodigoCanal, CodigoProyecto,
               CodigoSeccion, CodigoDepartamento, CuentaCaja, IdDelegacion, CodigoEmpresa
        FROM CLIENTES
        WHERE UsuarioLogicNet = @username
          AND ContraseñaLogicNet = @password
          AND CodigoCategoriaCliente_ = 'EMP'
          AND codigoempresa = 1
      `);

    if (result.recordset.length > 0) {
      const u = result.recordset[0];
      req.session.user = {
        codigoCliente: u.CodigoCliente?.trim() || '',
        cifDni: u.CifDni?.trim() || '',
        usuario: u.UsuarioLogicNet,
        nombre: u.RazonSocial,
        domicilio: u.Domicilio || '',
        codigoPostal: u.CodigoPostal || '',
        municipio: u.Municipio || '',
        provincia: u.Provincia || '',
        codigoProvincia: u.CodigoProvincia || '',
        codigoNacion: u.CodigoNacion || 'ES',
        nacion: u.Nacion || '',
        siglaNacion: u.SiglaNacion || 'ES',
        isAdmin: u.StatusAdministrador === -1,
        codigoCanal: u.CodigoCanal || '',
        codigoProyecto: u.CodigoProyecto || '',
        codigoSeccion: u.CodigoSeccion || '',
        codigoDepartamento: u.CodigoDepartamento || '',
        cuentaCaja: u.CuentaCaja || '',
        idDelegacion: u.IdDelegacion || '',
        codigoEmpresa: u.CodigoEmpresa || 1
      };
      return res.json({ success: true, user: req.session.user });
    }

    return res.status(401).json({ success: false, message: 'Credenciales incorrectas o sin permisos en empresa 1' });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// ============================================
// ROUTE MODULES
// ============================================

app.use(require('./routes/planesCuenta'));
app.use(require('./routes/tiposImpuestos'));
app.use(require('./routes/asientos/index'));
app.use(require('./routes/asientos/form4'));
app.use(require('./routes/asientos/form5'));
app.use(require('./routes/asientos/form6'));
app.use(require('./routes/asientos/form7'));

// ============================================
// STATIC FILES (React build)
// ============================================

const getFrontendPath = () => {
  const candidates = [
    path.join(__dirname, 'build'),
    path.join(__dirname, '../frontend/build'),
    path.join(__dirname, '../client/build'),
    path.join(__dirname, '../build')
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'index.html'))) return p;
  }
  return null;
};

const frontendPath = getFrontendPath();

if (frontendPath) {
  app.use(express.static(frontendPath, { index: false, etag: true, lastModified: true, maxAge: '1d' }));

  app.get(['/', '/dashboard', '/form4', '/form5', '/form6', '/form7', '/historial', '/login'], (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/login' || req.path === '/logout') return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Servidor Backend Sage200', status: 'online', mode: 'api-only' });
  });
}

// ============================================
// START
// ============================================

const startServer = async () => {
  await connectDB();
  app.listen(PORT, HOST, () => {
    console.log(`Servidor iniciado en http://${HOST}:${PORT}`);
  });
};

process.on('uncaughtException', (err) => { console.error('uncaughtException:', err); });
process.on('unhandledRejection', (reason) => { console.error('unhandledRejection:', reason); });

startServer();
