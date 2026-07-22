// Actualiza telefono/email/cargo/numero_ods de los profesionales existentes,
// cruzando por RUT contra "DAtos Profesionales Julio 2026.xlsx".
// No crea profesionales nuevos: si un RUT del archivo no calza con ninguno
// existente, se reporta al final para revisión manual (no se asume nada).
require('dotenv').config();
const XLSX = require('xlsx');
const { sql } = require('../src/database/db');

const RUTA = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Documentos/DAtos Profesionales Julio 2026.xlsx';

function normalizarRut(r) {
  return (r || '').toString().trim().toUpperCase().replace(/\s+/g, '');
}

async function main() {
  const wb = XLSX.readFile(RUTA);
  const ws = wb.Sheets['Hoja1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1);

  const existentes = (await sql('SELECT id, nombre, rut FROM profesionales')).rows;
  const porRut = new Map(existentes.map(p => [normalizarRut(p.rut), p]));

  let actualizados = 0;
  const sinMatch = [];

  for (const row of rows) {
    const [, numeroOds, rut, apellidos, nombres, cargo, telefono, correo] = row;
    if (!rut) continue;
    const key = normalizarRut(rut);
    const prof = porRut.get(key);
    if (!prof) {
      sinMatch.push({ rut, nombre: `${nombres} ${apellidos}`.trim() });
      continue;
    }

    await sql(
      `UPDATE profesionales SET telefono = ?, email = ?, cargo = ?, numero_ods = ?, updated_at = NOW() WHERE id = ?`,
      [
        (telefono || '').toString().trim() || null,
        (correo || '').toString().trim() || null,
        (cargo || '').toString().trim() || null,
        numeroOds === '' || numeroOds === undefined ? null : numeroOds.toString().trim(),
        prof.id
      ]
    );
    actualizados++;
  }

  console.log('--- Resumen actualizacion profesionales (julio 2026) ---');
  console.log('Actualizados:', actualizados, 'de', rows.length, 'filas del archivo');
  if (sinMatch.length) {
    console.log('Sin match por RUT (revisar manualmente):');
    sinMatch.forEach(s => console.log('  -', s.rut, s.nombre));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
