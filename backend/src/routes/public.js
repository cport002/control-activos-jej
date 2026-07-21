const express = require('express');
const { sql } = require('../database/db');
const { registrarAuditoria } = require('../middleware/auth');
const { uploadActa } = require('../services/upload');
const { generarActaPDF } = require('../services/actaPdf');

const router = express.Router();

// GET /api/public/profesional/:token — datos del profesional + equipos asignados y si ya los firmó
router.get('/profesional/:token', async (req, res) => {
  try {
    const profesional = (await sql(
      'SELECT id, nombre, cargo, cco FROM profesionales WHERE token = ?',
      [req.params.token]
    )).rows[0];
    if (!profesional) return res.status(404).json({ error: 'Link no válido' });

    const activos = (await sql(`
      SELECT a.id, a.nombre, a.tipo, a.marca, a.modelo, a.numero_serie, a.accesorios,
        ac.id AS acta_id
      FROM activos a
      LEFT JOIN actas ac ON ac.activo_id = a.id AND ac.profesional_id = a.profesional_actual_id AND ac.tipo = 'entrega'
      WHERE a.profesional_actual_id = ? AND a.estado = 'asignado'
      ORDER BY a.nombre
    `, [profesional.id])).rows;

    res.json({ profesional, activos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/public/profesional/:token/activo/:activoId/firmar — multipart: firma (requerida), fotos (0-5)
router.post('/profesional/:token/activo/:activoId/firmar', uploadActa.fields([
  { name: 'firma', maxCount: 1 },
  { name: 'fotos', maxCount: 5 }
]), async (req, res) => {
  try {
    const profesional = (await sql('SELECT id, nombre FROM profesionales WHERE token = ?', [req.params.token])).rows[0];
    if (!profesional) return res.status(404).json({ error: 'Link no válido' });

    const activo = (await sql('SELECT * FROM activos WHERE id = ?', [req.params.activoId])).rows[0];
    if (!activo) return res.status(404).json({ error: 'Activo no encontrado' });
    if (activo.estado !== 'asignado' || activo.profesional_actual_id !== profesional.id) {
      return res.status(400).json({ error: 'Este equipo no está asignado a ti' });
    }

    const yaFirmada = (await sql(
      "SELECT id FROM actas WHERE activo_id = ? AND profesional_id = ? AND tipo = 'entrega'",
      [activo.id, profesional.id]
    )).rows[0];
    if (yaFirmada) return res.status(400).json({ error: 'Este equipo ya fue firmado' });

    const firmaFile = req.files?.firma?.[0];
    if (!firmaFile) return res.status(400).json({ error: 'La firma es requerida' });

    const r = await sql(
      `INSERT INTO actas (activo_id, profesional_id, tipo, condicion_equipo, observaciones, firma_url)
       VALUES (?, ?, 'entrega', 'bueno', ?, ?) RETURNING id`,
      [activo.id, profesional.id, req.body.observaciones || null, firmaFile.path]
    );
    const actaId = r.rows[0].id;

    const fotos = req.files?.fotos || [];
    for (const foto of fotos) {
      await sql('INSERT INTO acta_fotos (acta_id, foto_url) VALUES (?, ?)', [actaId, foto.path]);
    }

    registrarAuditoria('actas', actaId, 'INSERT', null, { activo_id: activo.id, profesional_id: profesional.id, tipo: 'entrega' }, null, req.ip, `Firma de recepción realizada por el propio profesional (${profesional.nombre})`);
    res.status(201).json({ id: actaId, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/public/profesional/:token/acta/:actaId/pdf
router.get('/profesional/:token/acta/:actaId/pdf', async (req, res) => {
  try {
    const profesional = (await sql('SELECT id FROM profesionales WHERE token = ?', [req.params.token])).rows[0];
    if (!profesional) return res.status(404).json({ error: 'Link no válido' });

    const r = await sql(`
      SELECT ac.*,
        a.nombre AS activo_nombre, a.tipo AS activo_tipo, a.marca AS activo_marca,
        a.modelo AS activo_modelo, a.numero_serie AS activo_numero_serie, a.accesorios AS activo_accesorios,
        p.nombre AS profesional_nombre, p.rut AS profesional_rut, p.cargo AS profesional_cargo, p.cco AS profesional_cco,
        u.nombre AS usuario_nombre,
        COALESCE((SELECT json_agg(af.foto_url) FROM acta_fotos af WHERE af.acta_id = ac.id), '[]') AS fotos
      FROM actas ac
      JOIN activos a ON a.id = ac.activo_id
      JOIN profesionales p ON p.id = ac.profesional_id
      LEFT JOIN usuarios u ON u.id = ac.usuario_id
      WHERE ac.id = ? AND ac.profesional_id = ?
    `, [req.params.actaId, profesional.id]);
    const acta = r.rows[0];
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="acta_${acta.tipo}_${acta.id}.pdf"`);
    await generarActaPDF(acta, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
