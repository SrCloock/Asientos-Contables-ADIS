'use strict';

const sql = require('mssql');

const dbConfig = {
  server: process.env.DB_SERVER || 'SSCC-APP-SAGE',
  database: process.env.DB_NAME || 'Sage',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    appName: 'GestorComprasWeb',
    connectTimeout: 30000,
    requestTimeout: 30000
  }
};

let pool;

const connectDB = async () => {
  pool = await sql.connect(dbConfig);
  return pool;
};

const getPool = () => pool;

module.exports = { connectDB, getPool, sql };
