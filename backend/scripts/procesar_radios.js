// Agrega las radios de "Inventario Radios" al sistema.
// DRY_RUN=1 node procesar_radios.js  -> solo imprime el plan
require('dotenv').config();
const XLSX = require('xlsx');
const { sql } = require('../src/database/db');

const DRY_RUN = process.env.DRY_RUN === '1';
const RUTA = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Documentos/Prontuario Equipos JEJ CC 669 (EMP).xlsx';

function normalizar(s) { return (s || '').toString().trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function palabras(s) { return new Set(normalizar(s).split(' ').filter(Boolean)); }
function esSubconjunto(a, b) { return [...a].every(x => b.has(x)); }
function limpiar(s) { return (s === undefined || s === null || s === '') ? null : s.toString().trim(); }

// Correcciones manuales de typos confirmados en el Excel (nombre exacto en archivo -> nombre real)
const CORRECCIONES_NOMBRE = { 'JONAS OCHOA CASTILLLO': 'Jonas Alberto Ochoa Castillo' };

async function main() {
  const wb = XLSX.readFile(RUTA);
  const ws = wb.Sheets['Inventario Radios'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(5); // datos desde fila 6 (indice 5)

  const profesionales = (await sql('SELECT id, nombre FROM profesionales')).rows;
  function buscarProfesional(nombre) {
    const w = palabras(nombre);
    return profesionales.find(p => esSubconjunto(w, palabras(p.nombre)) || esSubconjunto(palabras(p.nombre), w));
  }

  const existentesRadio = (await sql("SELECT numero_serie, rotulo_codelco FROM activos WHERE tipo = 'Radio'")).rows;
  const serieSet = new Set(existentesRadio.map(a => normalizar(a.numero_serie)));

  let creados = 0, sinProfesional = 0;
  let filaMarca = null, filaModelo2 = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c === '')) continue;
    const [zex, usuarioCodelco, respCodelco, ubicacion, ocImputacion, motivo, clase, tramo, marca, modelo, serie, ninterno, modeloBateria, responsableReal] = r;
    if (!ninterno) continue; // fila de continuacion (segunda linea de modelo/serie), se ignora aqui

    const nombreResponsableRaw = limpiar(responsableReal);
    const nombreResponsable = CORRECCIONES_NOMBRE[normalizar(nombreResponsableRaw)] || nombreResponsableRaw;
    const esVehiculo = nombreResponsable && /camioneta|veh[ií]culo/i.test(nombreResponsable);
    const prof = (nombreResponsable && !esVehiculo) ? buscarProfesional(nombreResponsable) : null;
    if (nombreResponsable && !esVehiculo && !prof) {
      console.log('AVISO: profesional no encontrado para radio', ninterno, '->', nombreResponsable);
    }

    const serieN = normalizar(serie);
    const yaExiste = serieSet.has(serieN);

    const notas = [
      ubicacion ? `Ubicación: ${ubicacion}` : null,
      ocImputacion ? `Objeto Imputación: ${ocImputacion}` : null,
      motivo ? `Motivo: ${motivo}` : null,
      esVehiculo ? `Asignación física: ${nombreResponsable}` : null,
      modeloBateria ? `Batería: ${modeloBateria}` : null,
    ].filter(Boolean).join(' · ') || null;

    console.log(
      (yaExiste ? 'YA EXISTE (omitido)' : 'CREAR') + ' radio |', ninterno,
      '| marca/modelo:', marca, modelo, '| serie:', serie, '| zex:', zex,
      '| responsable:', nombreResponsable, prof ? `(prof id=${prof.id})` : (esVehiculo ? '(vehículo, sin profesional)' : '(SIN PROFESIONAL)')
    );

    if (yaExiste) continue;

    if (!DRY_RUN) {
      const estado = prof ? 'asignado' : 'disponible';
      await sql(
        `INSERT INTO activos (nombre, tipo, marca, modelo, numero_serie, rotulo_codelco, estado, profesional_actual_id, notas)
         VALUES (?, 'Radio', ?, ?, ?, ?, ?, ?, ?)`,
        [ninterno, limpiar(marca), limpiar(modelo), limpiar(serie), limpiar(zex), estado, prof ? prof.id : null, notas]
      );
    }
    creados++;
    if (!prof && !esVehiculo) sinProfesional++;
  }

  console.log('\n--- RESUMEN RADIOS', DRY_RUN ? '(DRY RUN)' : '(EJECUTADO)', '---');
  console.log('Radios creadas:', creados, '| sin profesional:', sinProfesional);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
