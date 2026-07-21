const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../database/db');
const { autenticar, registrarAuditoria, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const r = await sql('SELECT * FROM usuarios WHERE email = ? AND activo = true', [email.toLowerCase().trim()]);
    const usuario = r.rows[0];
    if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, JWT_SECRET, { expiresIn: '8h' });
    await sql('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [usuario.id]);
    registrarAuditoria('usuarios', usuario.id, 'LOGIN', null, null, usuario.id, req.ip, 'Inicio de sesión');

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => {
  res.json(req.usuario);
});

// PUT /api/auth/password
router.put('/password', autenticar, async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo) return res.status(400).json({ error: 'Datos incompletos' });
    if (password_nuevo.length < 8) return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });

    const r = await sql('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
    const usuario = r.rows[0];
    if (!bcrypt.compareSync(password_actual, usuario.password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    const nuevo_hash = bcrypt.hashSync(password_nuevo, 12);
    await sql('UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?', [nuevo_hash, req.usuario.id]);
    registrarAuditoria('usuarios', req.usuario.id, 'UPDATE', null, null, req.usuario.id, req.ip, 'Cambio de contraseña');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
