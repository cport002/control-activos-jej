const express = require('express');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');
const { condicionBusqueda } = require('../utils/busqueda');

const router = express.Router();

// GET /api/profesionales?busqueda=&estado=
router.get('/', autenticar, async (req, res) => {
  try {
    const { busqueda, estado, tipo } = req.query;
    let query = 'SELECT * FROM profesionales WHERE 1=1';
    const params = [];
    if (busqueda) {
      const { clause, params: p } = condicionBusqueda(busqueda, ['nombre', 'rut', 'cargo']);
      query += clause;
      params.push(...p);
    }
    if (estado === 'activo') query += ' AND activo = true';
    if (estado === 'inactivo') query += ' AND activo = false';
    if (tipo === 'jej' || tipo === 'externo') { query += ' AND tipo = ?'; params.push(tipo); }
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

// GET /api/profesionales/:id/activos — equipos actualmente asignados, más los que se dieron de
// baja por extravío/robo mientras estaban con este profesional (esos ya no tienen
// profesional_actual_id, quedaría vacio si no se buscaran aparte por la última acta de devolución).
router.get('/:id/activos', autenticar, async (req, res) => {
  try {
    const asignados = (await sql(
      "SELECT * FROM activos WHERE profesional_actual_id = ? AND estado = 'asignado' ORDER BY nombre",
      [req.params.id]
    )).rows;

    const perdidos = (await sql(`
      SELECT a.*, ult.id AS acta_id, ult.condicion_equipo, ult.fecha AS fecha_baja, ult.observaciones AS observaciones_baja
      FROM activos a
      JOIN actas ult ON ult.id = (
        SELECT id FROM actas WHERE activo_id = a.id AND tipo = 'devolucion' ORDER BY created_at DESC LIMIT 1
      )
      WHERE a.estado = 'de_baja' AND ult.profesional_id = ? AND ult.condicion_equipo IN ('extraviado', 'robado')
      ORDER BY ult.created_at DESC
    `, [req.params.id])).rows;

    res.json({ asignados, perdidos });
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
