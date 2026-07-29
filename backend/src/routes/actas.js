const express = require('express');
const { sql, withTransaction } = require('../database/db');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth');
const { uploadActa } = require('../services/upload');
const { generarActaPDF } = require('../services/actaPdf');
const { condicionBusqueda } = require('../utils/busqueda');
const { nombreActualizado } = require('../utils/renombrarActivo');
const { SELLO_HISTORICO_URL } = require('../constants');

const router = express.Router();

const QUERY_DETALLE = `
  SELECT ac.*,
    a.nombre AS activo_nombre, a.tipo AS activo_tipo, a.marca AS activo_marca,
    a.modelo AS activo_modelo, a.numero_serie AS activo_numero_serie, a.accesorios AS activo_accesorios,
    p.nombre AS profesional_nombre, p.rut AS profesional_rut, p.cargo AS profesional_cargo, p.cco AS profesional_cco,
    u.nombre AS usuario_nombre,
    COALESCE(
      (SELECT json_agg(af.foto_url) FROM acta_fotos af WHERE af.acta_id = ac.id), '[]'
    ) AS fotos
  FROM actas ac
  JOIN activos a ON a.id = ac.activo_id
  JOIN profesionales p ON p.id = ac.profesional_id
  LEFT JOIN usuarios u ON u.id = ac.usuario_id
  WHERE ac.id = ?
`;

// GET /api/actas?activo_id=&profesional_id=&tipo=&busqueda=
router.get('/', autenticar, async (req, res) => {
  try {
    const { activo_id, profesional_id, tipo, busqueda } = req.query;
    let query = `
      SELECT ac.*, a.nombre AS activo_nombre, p.nombre AS profesional_nombre
      FROM actas ac
      JOIN activos a ON a.id = ac.activo_id
      JOIN profesionales p ON p.id = ac.profesional_id
      WHERE 1=1
    `;
    const params = [];
    if (activo_id) { query += ' AND ac.activo_id = ?'; params.push(activo_id); }
    if (profesional_id) { query += ' AND ac.profesional_id = ?'; params.push(profesional_id); }
    if (tipo) { query += ' AND ac.tipo = ?'; params.push(tipo); }
    if (busqueda) {
      const { clause, params: p } = condicionBusqueda(busqueda, ['a.nombre', 'p.nombre']);
      query += clause;
      params.push(...p);
    }
    query += ' ORDER BY ac.created_at DESC';
    const r = await sql(query, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actas/:id
router.get('/:id', autenticar, async (req, res) => {
  try {
    const r = await sql(QUERY_DETALLE, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Acta no encontrada' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actas/:id/pdf
router.get('/:id/pdf', autenticar, async (req, res) => {
  try {
    const r = await sql(QUERY_DETALLE, [req.params.id]);
    const acta = r.rows[0];
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="acta_${acta.tipo}_${acta.id}.pdf"`);
    await generarActaPDF(acta, res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/actas — multipart: firma (1 archivo), fotos (0-5 archivos)
router.post('/', autenticar, autorizar('admin', 'operador'), uploadActa.fields([
  { name: 'firma', maxCount: 1 },
  { name: 'fotos', maxCount: 5 }
]), async (req, res) => {
  try {
    const { activo_id, profesional_id, tipo, condicion_equipo, observaciones, historico } = req.body;
    if (!activo_id || !profesional_id || !tipo) return res.status(400).json({ error: 'Datos incompletos' });
    if (!['entrega', 'devolucion'].includes(tipo)) return res.status(400).json({ error: 'Tipo de acta inválido' });
    const esHistorico = historico === 'true' || historico === true;
    const firmaFile = req.files?.firma?.[0];
    if (!firmaFile && !esHistorico) return res.status(400).json({ error: 'La firma es requerida' });
    const firmaUrl = esHistorico ? SELLO_HISTORICO_URL : firmaFile.path;

    const activo = (await sql('SELECT * FROM activos WHERE id = ?', [activo_id])).rows[0];
    if (!activo) return res.status(404).json({ error: 'Activo no encontrado' });

    // Caso especial: documentar (histórico o con firma real) la entrega de un equipo que YA está
    // asignado a esta misma persona pero nunca tuvo acta (ej. cargado directo por importación masiva).
    // No cambia estado ni profesional — solo dejamos constancia de una entrega que ya ocurrió.
    const documentaEntregaYaVigente = tipo === 'entrega' && activo.estado === 'asignado' && String(activo.profesional_actual_id) === String(profesional_id);

    if (tipo === 'entrega' && activo.estado !== 'disponible' && !documentaEntregaYaVigente) {
      return res.status(400).json({ error: 'El activo no está disponible para entrega' });
    }
    if (documentaEntregaYaVigente) {
      const yaExiste = (await sql(
        "SELECT id FROM actas WHERE activo_id = ? AND profesional_id = ? AND tipo = 'entrega'",
        [activo_id, profesional_id]
      )).rows[0];
      if (yaExiste) return res.status(400).json({ error: 'Ya existe una acta de entrega para este activo y este profesional' });
    }
    if (tipo === 'devolucion') {
      if (activo.estado !== 'asignado') return res.status(400).json({ error: 'El activo no está asignado actualmente' });
      if (String(activo.profesional_actual_id) !== String(profesional_id)) {
        return res.status(400).json({ error: 'El activo está asignado a otro profesional' });
      }
    }

    const acta = await withTransaction(async (tsql) => {
      const r = await tsql(
        `INSERT INTO actas (activo_id, profesional_id, tipo, condicion_equipo, observaciones, firma_url, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [activo_id, profesional_id, tipo, condicion_equipo || 'bueno', observaciones || null, firmaUrl, req.usuario.id]
      );
      const actaId = r.rows[0].id;

      const fotos = req.files?.fotos || [];
      for (const foto of fotos) {
        await tsql('INSERT INTO acta_fotos (acta_id, foto_url) VALUES (?, ?)', [actaId, foto.path]);
      }

      if (documentaEntregaYaVigente) {
        // El activo ya está asignado a esta persona: no tocamos estado/profesional/nombre, solo queda la acta.
      } else if (tipo === 'entrega') {
        const prof = await tsql('SELECT nombre FROM profesionales WHERE id = ?', [profesional_id]);
        const todos = (await tsql('SELECT id, nombre FROM profesionales')).rows;
        const nuevoNombre = nombreActualizado(activo.nombre, prof.rows[0]?.nombre, todos);
        await tsql("UPDATE activos SET estado = 'asignado', profesional_actual_id = ?, nombre = ?, updated_at = NOW() WHERE id = ?", [profesional_id, nuevoNombre, activo_id]);
      } else {
        // Si el equipo se extravió o lo robaron, no vuelve a quedar disponible para reasignar: se da de baja directo.
        const estadoFinal = ['extraviado', 'robado'].includes(condicion_equipo) ? 'de_baja' : 'disponible';
        await tsql("UPDATE activos SET estado = ?, profesional_actual_id = NULL, updated_at = NOW() WHERE id = ?", [estadoFinal, activo_id]);
      }

      return actaId;
    });

    registrarAuditoria('actas', acta, 'INSERT', null, { activo_id, profesional_id, tipo }, req.usuario.id, req.ip, `Acta de ${tipo} registrada`);
    res.status(201).json({ id: acta, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/actas/:id/firmar — reemplaza el sello de "registro histórico" por una firma real,
// capturada en pantalla por un admin/operador junto al profesional. Solo funciona sobre actas
// que hoy tienen el sello (nunca sobre una firma real ya existente, para no pisarla por error).
router.put('/:id/firmar', autenticar, autorizar('admin', 'operador'), uploadActa.fields([
  { name: 'firma', maxCount: 1 },
  { name: 'fotos', maxCount: 5 }
]), async (req, res) => {
  try {
    const acta = (await sql('SELECT * FROM actas WHERE id = ?', [req.params.id])).rows[0];
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });
    if (acta.firma_url !== SELLO_HISTORICO_URL) {
      return res.status(400).json({ error: 'Esta acta ya tiene una firma real registrada' });
    }

    const firmaFile = req.files?.firma?.[0];
    if (!firmaFile) return res.status(400).json({ error: 'La firma es requerida' });

    await sql('UPDATE actas SET firma_url = ? WHERE id = ?', [firmaFile.path, req.params.id]);

    const fotos = req.files?.fotos || [];
    for (const foto of fotos) {
      await sql('INSERT INTO acta_fotos (acta_id, foto_url) VALUES (?, ?)', [req.params.id, foto.path]);
    }

    registrarAuditoria('actas', req.params.id, 'UPDATE', { firma_url: acta.firma_url }, { firma_url: firmaFile.path }, req.usuario.id, req.ip, 'Firma real capturada, reemplaza el sello de registro histórico');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/actas/:id — elimina una acta (ej. firma de prueba), permite volver a firmar
router.delete('/:id', autenticar, autorizar('admin', 'operador'), async (req, res) => {
  try {
    const acta = (await sql('SELECT * FROM actas WHERE id = ?', [req.params.id])).rows[0];
    if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

    await sql('DELETE FROM acta_fotos WHERE acta_id = ?', [req.params.id]);
    await sql('DELETE FROM actas WHERE id = ?', [req.params.id]);

    registrarAuditoria('actas', req.params.id, 'DELETE', acta, null, req.usuario.id, req.ip, 'Acta eliminada (permite volver a firmar)');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
