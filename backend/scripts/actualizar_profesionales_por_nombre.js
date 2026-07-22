// Complemento al script por RUT: estos 5 profesionales existian con RUT nulo
// o con un RUT placeholder obviamente falso ("12.345.678-9"), asi que no
// calzaron por RUT. Se actualizan por coincidencia de nombre, fijando
// tambien su RUT real desde el archivo.
require('dotenv').config();
const XLSX = require('xlsx');
const { sql } = require('../src/database/db');

const RUTA = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Documentos/DAtos Profesionales Julio 2026.xlsx';

const CASOS = [
  { rutArchivo: ' 6305098-9', nombreDb: 'Moises Segundo Díaz Jara' },
  { rutArchivo: '14503612-7', nombreDb: 'Gabriel Hernán Flores Vera' },
  { rutArchivo: '13869384-8', nombreDb: 'Jorge Antonio Lamas Rojas' },
  { rutArchivo: '11617019-1', nombreDb: 'Oscar Eduardo Madrigal Lobos' },
  { rutArchivo: '14334920-9', nombreDb: 'Sebastián Enrique Miño Monje' },
];

function normalizarRut(r) { return (r || '').toString().trim().toUpperCase().replace(/\s+/g, ''); }

async function main() {
  const wb = XLSX.readFile(RUTA);
  const ws = wb.Sheets['Hoja1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1);
  const porRut = new Map(rows.map(r => [normalizarRut(r[2]), r]));

  for (const caso of CASOS) {
    const row = porRut.get(normalizarRut(caso.rutArchivo));
    if (!row) { console.log('No encontrado en archivo:', caso.rutArchivo); continue; }
    const [, numeroOds, rut, , , cargo, telefono, correo] = row;
    const r = await sql(
      `UPDATE profesionales SET rut = ?, telefono = ?, email = ?, cargo = ?, numero_ods = ?, updated_at = NOW() WHERE nombre = ? RETURNING id`,
      [
        normalizarRut(rut),
        (telefono || '').toString().trim() || null,
        (correo || '').toString().trim() || null,
        (cargo || '').toString().trim() || null,
        numeroOds === '' || numeroOds === undefined ? null : numeroOds.toString().trim(),
        caso.nombreDb
      ]
    );
    console.log(caso.nombreDb, '-> actualizado:', r.rows.length > 0, 'rut:', normalizarRut(rut));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
