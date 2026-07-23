const express = require('express');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// GET /api/profesionales?busqueda=&estado=
router.get('/', autenticar, async (req, res) => {
  try {
    const { busqueda, estado } = req.query;
    let query = 'SELECT * FROM profesionales WHERE 1=1';
    const params = [];
    if (busqueda) {
      query += ' AND (nombre ILIKE ? OR rut ILIKE ? OR cargo ILIKE ?)';
      const like = `%${busqueda}%`;
      params.push(like, like, like);
    }
    if (estado === 'activo') query += ' AND activo = true';
    if (estado === 'inactivo') query += ' AND activo = false';
    query += ' ORDER BY nombre';
    const r = await sql(query, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profesionales/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const r = await sql('SELECT * FROM profesionales WHERE id = ?', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Profesional no encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profesionales/:id/activos — equipos actualmente asignados a este profesional
router.get('/:id/activos', autenticar, async (req, res) => {
  try {
    const r = await sql("SELECT * FROM activos WHERE profesional_actual_id = ? AND estado = 'asignado' ORDER BY nombre", [req.params.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/profesionales
router.post('/', autenticar, autorizar('admin', 'operador'), async (req, res) => {
  try {
    const { nombre, rut, cargo, cco, email, telefono, tipo, empresa } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const r = await sql(
      'INSERT INTO profesionales (nombre, rut, cargo, cco, email, telefono, tipo, empresa) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [nombre.trim(), rut || null, cargo || null, cco || null, email || null, telefono || null, tipo === 'externo' ? 'externo' : 'jej', empresa || null]
    );
    const id = r.rows[0].id;
    registrarAuditoria('profesionales', id, 'INSERT', null, req.body, req.usuario.id, req.ip, 'Profesional registrado');
    res.status(201).json({ id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/profesionales/:id
router.put('/:id', autenticar, autorizar('admin', 'operador'), async (req, res) => {
  try {
    const anterior = (await sql('SELECT * FROM profesionales WHERE id = ?', [req.params.id])).rows[0];
    if (!anterior) return res.status(404).json({ error: 'Profesional no encontrado' });

    const { nombre, rut, cargo, cco, email, telefono, activo, tipo, empresa } = req.body;
    await sql(
      `UPDATE profesionales SET nombre = ?, rut = ?, cargo = ?, cco = ?, email = ?, telefono = ?, activo = ?, tipo = ?, empresa = ?, updated_at = NOW() WHERE id = ?`,
      [
        nombre ?? anterior.nombre, rut ?? anterior.rut, cargo ?? anterior.cargo, cco ?? anterior.cco,
        email ?? anterior.email, telefono ?? anterior.telefono,
        activo !== undefined ? !!activo : anterior.activo,
        tipo === 'externo' || tipo === 'jej' ? tipo : anterior.tipo,
        empresa ?? anterior.empresa,
        req.params.id
      ]
    );
    registrarAuditoria('profesionales', req.params.id, 'UPDATE', anterior, req.body, req.usuario.id, req.ip, 'Profesional actualizado');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/profesionales/:id (desactivar)
router.delete('/:id', autenticar, autorizar('admin', 'operador'), async (req, res) => {
  try {
    await sql('UPDATE profesionales SET activo = false, updated_at = NOW() WHERE id = ?', [req.params.id]);
    registrarAuditoria('profesionales', req.params.id, 'UPDATE', null, { activo: false }, req.usuario.id, req.ip, 'Profesional desactivado');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
