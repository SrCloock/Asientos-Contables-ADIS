'use strict';

const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/api/tipos-iva', requireAuth, async (req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT CodigoIva, Iva, [%Iva] as PorcentajeIva
      FROM TiposIva
      WHERE CodigoTerritorio = '0'
      ORDER BY CodigoIva
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo tipos de IVA', details: err.message });
  }
});

router.get('/api/tipos-retencion', requireAuth, async (req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT CodigoRetencion, Retencion, [%Retencion] as PorcentajeRetencion, CuentaAbono
      FROM TiposRetencion
      ORDER BY CodigoRetencion
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo tipos de retención', details: err.message });
  }
});

module.exports = router;
