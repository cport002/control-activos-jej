// Agrega el "Rotulo Codelco" (columna "Nombre Equipo" del Inventario, ej. ZEX000263299)
// al notebook actualmente asignado a cada persona, cruzando por nombre.
// Solo se agregan filas cuyo "Nombre Equipo" empieza con ZEX (instruccion explicita
// del usuario) — el resto del inventario no se toca.
require('dotenv').config();
const XLSX = require('xlsx');
const { sql } = require('../src/database/db');

const RUTA = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Escritorio/INVENTARIO 2026/INVENTARIO_2026_CC 669.xlsx';

function normalizar(s) {
  return (s || '').toString().trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}
function palabras(s) { return new Set(normalizar(s).split(' ').filter(Boolean)); }
function esSubconjunto(a, b) { return [...a].every(x => b.has(x)); }

async function main() {
  const wb = XLSX.readFile(RUTA);
  const ws = wb.Sheets['Consolidado'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(3);

  const zex = rows
    .filter(r => (r[7] || '').toString().toUpperCase().startsWith('ZEX'))
    .map(r => ({ nombre: `${r[3] || ''} ${r[2] || ''}`.trim(), rotulo: r[7].toString().trim(), w: palabras(`${r[3] || ''} ${r[2] || ''}`) }));

  console.log('Filas con rotulo ZEX en el inventario:', zex.length);

  const notebooks = (await sql(
    `SELECT a.id, a.rotulo_codelco, p.nombre AS prof_nombre
     FROM activos a JOIN profesionales p ON p.id = a.profesional_actual_id
     WHERE a.tipo = 'Notebook'`
  )).rows;

  let actualizados = 0;
  const sinMatch = [];

  for (const item of zex) {
    const match = notebooks.find(n => {
      const w = palabras(n.prof_nombre);
      return esSubconjunto(w, item.w) || esSubconjunto(item.w, w);
    });
    if (!match) { sinMatch.push(item); continue; }
    await sql('UPDATE activos SET rotulo_codelco = ?, updated_at = NOW() WHERE id = ?', [item.rotulo, match.id]);
    actualizados++;
  }

  console.log('--- Resumen Rotulo Codelco ---');
  console.log('Notebooks actualizados:', actualizados, 'de', zex.length, 'filas ZEX');
  if (sinMatch.length) {
    console.log('Sin match (revisar manualmente):');
    sinMatch.forEach(s => console.log('  -', s.rotulo, '|', s.nombre));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
