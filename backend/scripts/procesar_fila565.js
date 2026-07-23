// Procesa los 6 registros sueltos desde la fila 565 de "Inventario Abril 2025":
// monitores/impresoras sin un profesional JEJ claro (personal Codelco, contrato
// anterior, o ubicación). Se agregan como activos sin profesional_actual_id.
require('dotenv').config();
const XLSX = require('xlsx');
const { sql } = require('../src/database/db');

const RUTA = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Documentos/Prontuario Equipos JEJ CC 669 (EMP).xlsx';

const REGISTROS = [
  { etiqueta: 'CRISTIAN MUÑOZ - CONTRATO ANTERIOR ITOS', tipo: 'Monitor', marca: 'GEAR', modelo: 'G3218M', serie: 'R01337L34152000030' },
  { etiqueta: 'JAIME BERRIOS - CONTRATO ANTERIOR ITOS', tipo: 'Monitor', marca: 'GEAR', modelo: 'G3218M', serie: 'R01302L34152000077' },
  { etiqueta: 'Alejandro Ramos Gonzalez / Codelco', tipo: 'Impresora', marca: 'EPSON', modelo: 'L4260', serie: 'X8RZ040781' },
  { etiqueta: 'Alejandro Ramos Gonzalez', tipo: 'Impresora', marca: 'BROTHER', modelo: 'MFC-L6900DW', serie: 'U64209A1N586620' },
  { etiqueta: 'David Agüero Martinez / Codelco', tipo: 'Monitor', marca: 'SAMSUNG', modelo: 'S32CG552EL', serie: '0TLJHNTXB00067P' },
  { etiqueta: 'Diego Diaz Sandoval / Codelco', tipo: 'Monitor', marca: 'SAMSUNG', modelo: 'S32CG552EL', serie: '0TLJHNTXB00067S' },
  { etiqueta: 'EX CAP-POTRERILLOS', tipo: 'Impresora', marca: 'BROTHER', modelo: 'MFC-T4500DW', serie: 'U65160M4H78024' },
];

async function main() {
  let creados = 0;
  for (const r of REGISTROS) {
    const existe = (await sql('SELECT id FROM activos WHERE numero_serie = ?', [r.serie])).rows[0];
    if (existe) { console.log('YA EXISTE (omitido):', r.serie); continue; }
    const nombre = `${r.tipo} ${r.marca} ${r.modelo}`.trim();
    await sql(
      `INSERT INTO activos (nombre, tipo, marca, modelo, numero_serie, estado, profesional_actual_id, notas)
       VALUES (?, ?, ?, ?, ?, 'disponible', NULL, ?)`,
      [nombre, r.tipo, r.marca, r.modelo, r.serie, `Según Excel abril 2025, en poder de: ${r.etiqueta} (no es personal JEJ con ficha en este sistema)`]
    );
    console.log('CREADO:', nombre, '| serie:', r.serie, '| nota:', r.etiqueta);
    creados++;
  }
  console.log('\nTotal creados:', creados, 'de', REGISTROS.length);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
