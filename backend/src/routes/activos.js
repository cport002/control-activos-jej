const express = require('express');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// GET /api/activos?busqueda=&estado=&tipo=
router.get('/', autenticar, async (req, res) => {
  try {
    const { busqueda, estado, tipo } = req.query;
    let query = `
      SELECT a.*, p.nombre AS profesional_nombre
      FROM activos a
      LEFT JOIN profesionales p ON p.id = a.profesional_actual_id
      WHERE 1=1
    `;
    const params = [];
    if (busqueda) {
      query += ' AND (a.nombre ILIKE ? OR a.marca ILIKE ? OR a.modelo ILIKE ? OR a.numero_serie ILIKE ?)';
      const like = `%${busqueda}%`;
      params.push(like, like, like, like);
    }
    if (estado) { query += ' AND a.estado = ?'; params.push(estado); }
    if (tipo) { query += ' AND a.tipo = ?'; params.push(tipo); }
    query += ' ORDER BY a.nombre';
    const r = await sql(query, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/activos/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const r = await sql(`
      SELECT a.*, p.nombre AS profesional_nombre
      FROM activos a LEFT JOIN profesionales p ON p.id = a.profesional_actual_id
      WHERE a.id = ?
    `, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Activo no encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/activos/:id/actas — historial de entregas/devoluciones de este activo
router.get('/:id/actas', autenticar, async (req, res) => {
  try {
    const r = await sql(`
      SELECT ac.*, p.nombre AS profesional_nombre,
        COALESCE(json_agg(af.foto_url) FILTER (WHERE af.foto_url IS NOT NULL), '[]') AS fotos
      FROM actas ac
      JOIN profesionales p ON p.id = ac.profesional_id
      LEFT JOIN acta_fotos af ON af.acta_id = ac.id
      WHERE ac.activo_id = ?
      GROUP BY ac.id, p.nombre
      ORDER BY ac.created_at DESC
    `, [req.params.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/activos
router.post('/', autenticar, autorizar('admin', 'operador'), async (req, res) => {
  try {
    const { nombre, tipo, marca, modelo, numero_serie, accesorios, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    if (numero_serie) {
      const existe = await sql('SELECT id FROM activos WHERE numero_serie = ?', [numero_serie]);
      if (existe.rows.length) return res.status(409).json({ error: 'Ya existe un activo con ese número de serie' });
    }

    const r = await sql(
      `INSERT INTO activos (nombre, tipo, marca, modelo, numero_serie, accesorios, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [nombre.trim(), tipo || 'Otro', marca || null, modelo || null, numero_serie || null, accesorios || null, notas || null]
    );
    const id = r.rows[0].id;
    registrarAuditoria('activos', id, 'INSERT', null, req.body, req.usuario.id, req.ip, 'Activo registrado');
    res.status(201).json({ id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/activos/:id
router.put('/:id', autenticar, autorizar('admin', 'operador'), async (req, res) => {
  try {
    const anterior = (await sql('SELECT * FROM activos WHERE id = ?', [req.params.id])).rows[0];
    if (!anterior) return res.status(404).json({ error: 'Activo no encontrado' });

    const { nombre, tipo, marca, modelo, numero_serie, accesorios, estado, notas } = req.body;
    await sql(
      `UPDATE activos SET nombre = ?, tipo = ?, marca = ?, modelo = ?, numero_serie = ?, accesorios = ?, estado = ?, notas = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        nombre ?? anterior.nombre, tipo ?? anterior.tipo, marca ?? anterior.marca, modelo ?? anterior.modelo,
        numero_serie ?? anterior.numero_serie, accesorios ?? anterior.accesorios,
        estado ?? anterior.estado, notas ?? anterior.notas, req.params.id
      ]
    );
    registrarAuditoria('activos', req.params.id, 'UPDATE', anterior, req.body, req.usuario.id, req.ip, 'Activo actualizado');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/activos/:id (dar de baja)
router.delete('/:id', autenticar, autorizar('admin', 'operador'), async (req, res) => {
  try {
    const activo = (await sql('SELECT estado FROM activos WHERE id = ?', [req.params.id])).rows[0];
    if (!activo) return res.status(404).json({ error: 'Activo no encontrado' });
    if (activo.estado === 'asignado') return res.status(400).json({ error: 'No se puede dar de baja un activo asignado. Registra la devolución primero.' });

    await sql("UPDATE activos SET estado = 'de_baja', updated_at = NOW() WHERE id = ?", [req.params.id]);
    registrarAuditoria('activos', req.params.id, 'UPDATE', null, { estado: 'de_baja' }, req.usuario.id, req.ip, 'Activo dado de baja');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
