require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function initDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 3);

  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.warn('Schema warning:', e.message.slice(0, 120));
        }
      }
    }

    const adminExiste = await client.query("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1");
    if (adminExiste.rows.length === 0) {
      const hash = bcrypt.hashSync('Activos2026!', 12);
      await client.query(
        "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, 'admin')",
        ['Administrador', 'admin@jejactivos.local', hash]
      );
      console.log('Usuario admin creado: admin@jejactivos.local / Activos2026!');
    }

    // Migracion: token publico para cada profesional (link de firma)
    await client.query(`ALTER TABLE profesionales ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;`);
    const sinToken = await client.query('SELECT id FROM profesionales WHERE token IS NULL');
    for (const p of sinToken.rows) {
      await client.query('UPDATE profesionales SET token = $1 WHERE id = $2', [crypto.randomBytes(24).toString('hex'), p.id]);
    }
    if (sinToken.rows.length) console.log(`Tokens generados para ${sinToken.rows.length} profesional(es) existente(s).`);

    // Migracion: ubicacion del activo (Salvador/Santiago) + historial de movimientos
    await client.query(`ALTER TABLE activos ADD COLUMN IF NOT EXISTS ubicacion TEXT NOT NULL DEFAULT 'salvador' CHECK(ubicacion IN ('salvador','santiago'));`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS activo_movimientos (
        id SERIAL PRIMARY KEY,
        activo_id INTEGER NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
        tipo TEXT NOT NULL CHECK(tipo IN ('envio_santiago','recepcion_salvador')),
        fecha DATE NOT NULL DEFAULT CURRENT_DATE,
        foto_url TEXT,
        observaciones TEXT,
        usuario_id INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activo_movimientos_activo ON activo_movimientos(activo_id);`);

    // Migracion: Numero ODS del profesional + Rotulo Codelco del activo
    await client.query(`ALTER TABLE profesionales ADD COLUMN IF NOT EXISTS numero_ods TEXT;`);
    await client.query(`ALTER TABLE activos ADD COLUMN IF NOT EXISTS rotulo_codelco TEXT;`);
    await client.query(`ALTER TABLE activos ADD COLUMN IF NOT EXISTS foto_url TEXT;`);

    console.log('Base de datos PostgreSQL lista');
  } finally {
    client.release();
  }
}

module.exports = { initDatabase };

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
