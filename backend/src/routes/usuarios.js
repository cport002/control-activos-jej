const express = require('express');
const bcrypt = require('bcryptjs');
const { sql } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// GET /api/usuarios
router.get('/', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const r = await sql('SELECT id, nombre, email, rol, activo, ultimo_acceso, created_at FROM usuarios ORDER BY nombre');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/usuarios
router.post('/', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Datos incompletos' });
    if (!['admin', 'operador', 'visor'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });

    const existe = await sql('SELECT id FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]);
    if (existe.rows.length) return res.status(409).json({ error: 'El email ya está registrado' });

    const hash = bcrypt.hashSync(password, 12);
    const r = await sql(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?) RETURNING id',
      [nombre.trim(), email.toLowerCase().trim(), hash, rol]
    );
    const id = r.rows[0].id;
    registrarAuditoria('usuarios', id, 'INSERT', null, { nombre, email, rol }, req.usuario.id, req.ip, `Usuario creado por ${req.usuario.nombre}`);
    res.status(201).json({ id, nombre, email, rol });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/usuarios/:id
router.put('/:id', autenticar, autorizar('admin'), async (req, res) => {
  try {
    const { nombre, email, rol, activo, password } = req.body;
    const anterior = (await sql('SELECT id, nombre, email, rol, activo FROM usuarios WHERE id = ?', [req.params.id])).rows[0];
    if (!anterior) return res.status(404).json({ error: 'Usuario no encontrado' });

    const params = [
      nombre || anterior.nombre,
      email || anterior.email,
      rol || anterior.rol,
      activo !== undefined ? !!activo : anterior.activo
    ];

    let query = 'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ?, updated_at = NOW()';
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
      query += ', password_hash = ?';
      params.push(bcrypt.hashSync(password, 12));
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);

    await sql(query, params);
    registrarAuditoria('usuarios', req.params.id, 'UPDATE', anterior, req.body, req.usuario.id, req.ip, 'Actualización de usuario');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/usuarios/:id (desactivar)
router.delete('/:id', autenticar, autorizar('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.usuario.id) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
    await sql('UPDATE usuarios SET activo = false, updated_at = NOW() WHERE id = ?', [req.params.id]);
    registrarAuditoria('usuarios', req.params.id, 'UPDATE', null, { activo: false }, req.usuario.id, req.ip, 'Usuario desactivado');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
