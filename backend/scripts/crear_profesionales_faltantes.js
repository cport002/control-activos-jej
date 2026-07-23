// Crea los 3 profesionales de "DAtos Profesionales Julio 2026.xlsx" que no
// existian en el sistema (no se encontraron ni por RUT ni por nombre).
require('dotenv').config();
const crypto = require('crypto');
const XLSX = require('xlsx');
const { sql } = require('../src/database/db');

const RUTA = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Documentos/DAtos Profesionales Julio 2026.xlsx';
const RUTS = ['10915562-4', '10253845-5', '9500529-2']; // Jopia Sierra, Rojas Gonzalez, Toledo Herrera

function normalizarRut(r) { return (r || '').toString().trim().toUpperCase().replace(/\s+/g, ''); }

async function main() {
  const wb = XLSX.readFile(RUTA);
  const ws = wb.Sheets['Hoja1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1);

  for (const rutBuscado of RUTS) {
    const row = rows.find(r => normalizarRut(r[2]) === normalizarRut(rutBuscado));
    if (!row) { console.log('No encontrado en archivo:', rutBuscado); continue; }
    const [, numeroOds, rut, apellidos, nombres, cargo, telefono, correo] = row;
    const nombreCompleto = `${nombres} ${apellidos}`.replace(/\s+/g, ' ').trim();

    const r = await sql(
      `INSERT INTO profesionales (nombre, rut, cargo, email, telefono, numero_ods, activo, token)
       VALUES (?, ?, ?, ?, ?, ?, true, ?) RETURNING id`,
      [
        nombreCompleto,
        normalizarRut(rut),
        (cargo || '').toString().trim() || null,
        (correo || '').toString().trim() || null,
        (telefono || '').toString().trim() || null,
        numeroOds === '' || numeroOds === undefined ? null : numeroOds.toString().trim(),
        crypto.randomBytes(24).toString('hex')
      ]
    );
    console.log('Creado:', nombreCompleto, '(id', r.rows[0].id + ')');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
