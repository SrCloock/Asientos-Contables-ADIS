'use strict';

const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/api/proveedores', requireAuth, async (req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT CodigoProveedor as codigo, CifDni as cif, RazonSocial as nombre,
             CodigoPostal as cp, Telefono as telefono, Email1 as email
      FROM Proveedores
      WHERE codigoempresa = 1 AND BajaEmpresaLc = 0
      ORDER BY RazonSocial
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo proveedores', details: err.message });
  }
});

router.get('/api/proveedores/cuentas', requireAuth, async (req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT p.CodigoProveedor as codigo, p.RazonSocial as nombre,
             cc.CodigoCuenta as cuenta
      FROM Proveedores p
      LEFT JOIN ClientesConta cc ON p.CodigoProveedor = cc.CodigoClienteProveedor
        AND cc.codigoempresa = 1
      WHERE p.codigoempresa = 1 AND p.BajaEmpresaLc = 0
      ORDER BY p.RazonSocial
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo cuentas de proveedores', details: err.message });
  }
});

router.get('/api/cuentas/gastos', requireAuth, async (req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT CodigoCuenta as id, Cuenta as nombre
      FROM PlanCuentas
      WHERE codigoempresa = 1 AND CodigoCuenta LIKE '6%' AND Bloqueo = 0
      ORDER BY CodigoCuenta
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo cuentas de gasto', details: err.message });
  }
});

router.get('/api/cuentas/ingresos', requireAuth, async (req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT CodigoCuenta as id, Cuenta as nombre
      FROM PlanCuentas
      WHERE codigoempresa = 1 AND CodigoCuenta LIKE '7%' AND Bloqueo = 0
      ORDER BY CodigoCuenta
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo cuentas de ingreso', details: err.message });
  }
});

router.get('/api/cuentas', requireAuth, async (req, res) => {
  try {
    const { tipo } = req.query;
    let filtro = '';
    if (tipo === 'gastos') filtro = "AND CodigoCuenta LIKE '6%'";
    else if (tipo === 'ingresos' || tipo === 'ventas') filtro = "AND CodigoCuenta LIKE '7%'";

    const result = await getPool().request().query(`
      SELECT CodigoCuenta as id, Cuenta as nombre
      FROM PlanCuentas
      WHERE codigoempresa = 1 AND Bloqueo = 0 ${filtro}
      ORDER BY CodigoCuenta
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo cuentas', details: err.message });
  }
});

module.exports = router;
