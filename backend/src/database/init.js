require('dotenv').config();
const bcrypt = require('bcryptjs');
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

    console.log('Base de datos PostgreSQL lista');
  } finally {
    client.release();
  }
}

module.exports = { initDatabase };

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
