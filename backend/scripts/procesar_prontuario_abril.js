// Procesa la hoja "Inventario Abril 2025" del Prontuario: notebooks + monitores asociados,
// incluyendo fotos reales embebidas en el Excel (rich-value images).
// DRY_RUN=1 node procesar_prontuario_abril.js   -> solo imprime el plan, no escribe nada
// node procesar_prontuario_abril.js             -> ejecuta de verdad
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const cloudinary = require('cloudinary').v2;
const cryptoNode = require('crypto');
const { sql } = require('../src/database/db');

const DRY_RUN = process.env.DRY_RUN === '1';
const RUTA = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Documentos/Prontuario Equipos JEJ CC 669 (EMP).xlsx';
const EXTRACT_DIR = 'C:/Users/usuario/AppData/Local/Temp/prontuario_extract';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Bloques que son error de copiado confirmado (ya tienen su propio equipo correcto en el sistema,
// o no hay ningun dato confiable que rescatar) — se excluyen por completo.
const BLOQUES_EXCLUIDOS = [
  'MARIO ALEXCI AZOLA ARAYA', 'MATIAS ALEJANDRO VEGA ESCOBAR', 'Veeryo Rojas Gonzalez',
  'Sebastián Araya Garcia', // el activo (ZEX000338077) ya está asignado a "Sebastian Alejandro Garcia Ochoa" — posible confusión de nombres, pendiente de confirmar con el usuario
];

function normalizar(s) {
  return (s || '').toString().trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}
function palabras(s) { return new Set(normalizar(s).split(' ').filter(Boolean)); }
function esSubconjunto(a, b) { return [...a].every(x => b.has(x)); }
function limpiar(s) { return (s === undefined || s === null || s === '' || s === '-') ? null : s.toString().trim(); }

// ---------- 1. Mapeo celda -> imagen (rich values), con filtro de placeholder y duplicados ----------
function construirMapaImagenes() {
  const read = p => fs.readFileSync(`${EXTRACT_DIR}/${p}`, 'utf8');
  const sheet1 = read('xl/worksheets/sheet1.xml');
  const cellVm = [];
  const cellRe = /<c r="([A-Z]+)(\d+)"[^>]*\bvm="(\d+)"[^>]*>/g;
  let m;
  while ((m = cellRe.exec(sheet1))) cellVm.push({ col: m[1], row: parseInt(m[2], 10), vm: parseInt(m[3], 10) });

  const metadata = read('xl/metadata.xml');
  const bkList = [];
  const bkRe = /<xlrd:rvb i="(\d+)"\/>/g;
  while ((m = bkRe.exec(metadata))) bkList.push(parseInt(m[1], 10));

  const rdrichvalue = read('xl/richData/rdrichvalue.xml');
  const rvList = [];
  const rvRe = /<rv s="\d+"><v>(\d+)<\/v><v>(\d+)<\/v><\/rv>/g;
  while ((m = rvRe.exec(rdrichvalue))) rvList.push(parseInt(m[1], 10));

  const richValueRel = read('xl/richData/richValueRel.xml');
  const relList = [];
  const relRe = /<rel r:id="(rId\d+)"\/>/g;
  while ((m = relRe.exec(richValueRel))) relList.push(m[1]);

  const relsXml = read('xl/richData/_rels/richValueRel.xml.rels');
  const ridToFile = {};
  const relsRe = /<Relationship Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g;
  while ((m = relsRe.exec(relsXml))) ridToFile[m[1]] = m[2];

  function vmToFile(vm) {
    const rvIndex = bkList[vm - 1];
    if (rvIndex === undefined) return null;
    const imgIdx = rvList[rvIndex];
    const rId = relList[imgIdx];
    return rId ? (ridToFile[rId] || null) : null;
  }

  const cellToImage = {};
  for (const c of cellVm) cellToImage[`${c.col}${c.row}`] = vmToFile(c.vm);

  // Filtrar: placeholder "Sin Imagen" (hash de image4.png) + archivos usados por mas de 1 celda (ambiguos)
  const mediaDir = `${EXTRACT_DIR}/xl/media/`;
  const placeholderHash = crypto.createHash('md5').update(fs.readFileSync(mediaDir + 'image4.png')).digest('hex');
  const usage = {};
  for (const file of Object.values(cellToImage)) if (file) usage[file] = (usage[file] || 0) + 1;

  const limpio = {};
  for (const [cell, file] of Object.entries(cellToImage)) {
    if (!file) continue;
    const hash = crypto.createHash('md5').update(fs.readFileSync(mediaDir + file)).digest('hex');
    if (hash === placeholderHash) continue; // "Sin Imagen"
    if (usage[file] > 1) continue; // ambiguo, usado en mas de una celda
    limpio[cell] = file;
  }
  return limpio;
}

// ---------- 2. Parseo de bloques notebook + monitor ----------
function parsearBloques(rows) {
  const bloques = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][5] === 'Trabajador/Responsable') {
      const b = { trabajador: rows[i][7], filaExcel1indexed: i + 1 };
      for (let j = i + 1; j < i + 13 && j < rows.length; j++) {
        const label = rows[j][5];
        if (label === 'ODS N°') b.ods = limpiar(rows[j][7]);
        if (label === 'ZEX Codelco') b.zex = limpiar(rows[j][7]);
        if (label === 'NTB JEJ/') b.ntb = limpiar(rows[j][7]);
        if (label === 'Marca / Modelo') b.marcaModelo = limpiar(rows[j][7]);
        if (label === 'Modelo' && !b.marcaModelo) b.marcaModelo = limpiar(rows[j][7]);
        if (label === 'N° Serie') b.serie = limpiar(rows[j][7]);
        if (label === 'Ram') b.ram = limpiar(rows[j][7]);
        if (label === 'HDD') b.hdd = limpiar(rows[j][7]);
        if (typeof label === 'string' && label.includes('Observaciones')) b.obs = limpiar(rows[j][7]);
        if (typeof rows[j][5] === 'string' && rows[j][5].startsWith('AHORA ENTREGADO')) b.reasignadoA = rows[j][5].replace('AHORA ENTREGADO A Don ', '').trim();
        if (rows[j][5] === 'Trabajador/Responsable') break;
      }
      // Monitor asociado: buscar 'Marca' en columna N (indice 13) dentro del rango de filas de este bloque
      for (let j = i; j < i + 13 && j < rows.length; j++) {
        if (rows[j][13] === 'Marca') {
          const mon = { marca: limpiar(rows[j][14]) };
          if (rows[j + 1] && rows[j + 1][13] === 'Modelo') mon.modelo = limpiar(rows[j + 1][14]);
          if (rows[j + 2] && rows[j + 2][13] === 'Serie N°') mon.serie = limpiar(rows[j + 2][14]);
          mon.filaExcel1indexed = j + 1; // fila de 'Marca' (1-indexed)
          b.monitor = mon;
          break;
        }
      }
      bloques.push(b);
    }
  }
  return bloques;
}

async function main() {
  const wb = XLSX.readFile(RUTA);
  const ws = wb.Sheets['Inventario Abril 2025'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const bloques = parsearBloques(rows).filter(b => !BLOQUES_EXCLUIDOS.some(x => normalizar(x) === normalizar(b.trabajador)));

  const mapaImagenes = construirMapaImagenes();

  const profesionales = (await sql('SELECT id, nombre FROM profesionales')).rows;
  const activosExistentes = (await sql("SELECT id, nombre, numero_serie, rotulo_codelco, profesional_actual_id FROM activos WHERE tipo = 'Notebook'")).rows;

  function buscarProfesional(nombre) {
    const w = palabras(nombre);
    return profesionales.find(p => {
      const pw = palabras(p.nombre);
      return esSubconjunto(w, pw) || esSubconjunto(pw, w);
    });
  }
  function buscarActivo(zex, serie) {
    const zexN = normalizar(zex), serieN = normalizar(serie);
    return activosExistentes.find(a =>
      (zexN && normalizar(a.rotulo_codelco) === zexN) ||
      (serieN && normalizar(a.numero_serie) === serieN)
    );
  }

  let creados = 0, actualizados = 0, sinProfesional = 0, monitoresCreados = 0, fotosSubidas = 0;
  const notasParaUsuario = [];

  for (const b of bloques) {
    const esExSinReasignar = /^EX-?\s*/i.test(b.trabajador) && !b.reasignadoA;
    const nombreReal = b.reasignadoA || b.trabajador.replace(/^EX-?\s*/i, '').trim();
    let prof = null;
    let profCreadoAhora = false;
    if (nombreReal && nombreReal !== 'SIN USUARIO' && !esExSinReasignar) {
      prof = buscarProfesional(nombreReal);
      if (!prof) {
        profCreadoAhora = true;
        if (!DRY_RUN) {
          const token = cryptoNode.randomBytes(24).toString('hex');
          const r = await sql(
            `INSERT INTO profesionales (nombre, activo, token) VALUES (?, true, ?) RETURNING id, nombre`,
            [nombreReal.replace(/\s+/g, ' ').trim(), token]
          );
          prof = r.rows[0];
          profesionales.push(prof);
        } else {
          prof = { id: '(nuevo)', nombre: nombreReal };
        }
        notasParaUsuario.push(`Profesional ${DRY_RUN ? 'se crearía' : 'creado'} (no existía): "${nombreReal}" (bloque original: "${b.trabajador}")`);
      }
    }
    if (esExSinReasignar) {
      notasParaUsuario.push(`"${b.trabajador}" no tiene nota de reasignación posterior — equipo se deja sin profesional asignado (revisar quién lo tiene ahora).`);
    }

    const activo = buscarActivo(b.zex, b.serie);
    const fotoCell = `B${b.filaExcel1indexed}`;
    // La foto suele estar unas filas mas abajo (fila 'Foto Equipo'); buscamos en el mapa cualquier celda B en el rango del bloque
    let fotoArchivo = null;
    for (let r = b.filaExcel1indexed; r <= b.filaExcel1indexed + 12; r++) {
      if (mapaImagenes[`B${r}`]) { fotoArchivo = mapaImagenes[`B${r}`]; break; }
    }

    const notasPartes = [];
    if (b.marcaModelo) notasPartes.push(`Marca/Modelo: ${b.marcaModelo}`);
    if (b.ram) notasPartes.push(`RAM: ${b.ram}`);
    if (b.hdd) notasPartes.push(`HDD: ${b.hdd}`);
    if (b.obs) notasPartes.push(`Observaciones (abril 2025): ${b.obs}`);
    if (esExSinReasignar) notasPartes.push(`Según Excel abril 2025 antes lo tenía "${b.trabajador.replace(/^EX-?\s*/i, '').trim()}", sin nota de reasignación posterior — revisar quién lo tiene ahora`);
    const notas = notasPartes.join(' · ') || null;

    console.log(
      (activo ? 'ACTUALIZAR' : 'CREAR') + ' notebook |',
      'trabajador excel:', JSON.stringify(b.trabajador),
      '| profesional real:', nombreReal, prof ? `(id=${prof.id})` : '(NO ENCONTRADO)',
      '| zex:', b.zex, '| serie:', b.serie, '| ntb:', b.ntb,
      '| activo existente:', activo ? activo.id : null,
      '| foto:', fotoArchivo,
      '| monitor:', b.monitor ? JSON.stringify(b.monitor) : 'ninguno'
    );

    if (!DRY_RUN) {
      let fotoUrl = null;
      if (fotoArchivo) {
        const up = await cloudinary.uploader.upload(`${EXTRACT_DIR}/xl/media/${fotoArchivo}`, { folder: 'jej-activos-fotos-equipo' });
        fotoUrl = up.secure_url;
        fotosSubidas++;
      }

      if (activo) {
        await sql(
          `UPDATE activos SET rotulo_codelco = COALESCE(rotulo_codelco, ?), notas = COALESCE(?, notas), foto_url = COALESCE(?, foto_url), updated_at = NOW() WHERE id = ?`,
          [limpiar(b.zex), notas, fotoUrl, activo.id]
        );
        if (prof && b.ods) await sql('UPDATE profesionales SET numero_ods = COALESCE(numero_ods, ?) WHERE id = ?', [b.ods, prof.id]);
        actualizados++;
      } else if (b.zex || b.serie || b.ntb) {
        const nombreActivo = (b.ntb && b.ntb !== 'Sin NTB') ? `ETI-${b.ntb}` : (b.zex || `NTB-SIN-CODIGO-${Date.now()}`);
        const estado = prof ? 'asignado' : 'disponible';
        const r = await sql(
          `INSERT INTO activos (nombre, tipo, marca, modelo, numero_serie, rotulo_codelco, estado, profesional_actual_id, notas, foto_url)
           VALUES (?, 'Notebook', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          [nombreActivo, null, b.marcaModelo, limpiar(b.serie), limpiar(b.zex), estado, prof ? prof.id : null, notas, fotoUrl]
        );
        creados++;
        if (!prof) sinProfesional++;
        activosExistentes.push({ id: r.rows[0].id, nombre: nombreActivo, numero_serie: b.serie, rotulo_codelco: b.zex, profesional_actual_id: prof?.id });
      }

      // Monitor asociado
      if (b.monitor && prof) {
        let monFotoUrl = null;
        for (let r = b.monitor.filaExcel1indexed; r <= b.monitor.filaExcel1indexed + 3; r++) {
          const f = mapaImagenes[`N${r}`] || mapaImagenes[`P${r}`];
          if (f) {
            const up = await cloudinary.uploader.upload(`${EXTRACT_DIR}/xl/media/${f}`, { folder: 'jej-activos-fotos-equipo' });
            monFotoUrl = up.secure_url;
            fotosSubidas++;
            break;
          }
        }
        const nombreMonitor = `Monitor ${b.monitor.marca || ''} ${prof.nombre}`.trim();
        const yaExisteMonitor = (await sql("SELECT id FROM activos WHERE tipo = 'Monitor' AND numero_serie = ?", [limpiar(b.monitor.serie)])).rows[0];
        if (!yaExisteMonitor) {
          await sql(
            `INSERT INTO activos (nombre, tipo, marca, modelo, numero_serie, estado, profesional_actual_id, foto_url)
             VALUES (?, 'Monitor', ?, ?, ?, 'asignado', ?, ?)`,
            [nombreMonitor, b.monitor.marca, b.monitor.modelo, limpiar(b.monitor.serie), prof.id, monFotoUrl]
          );
          monitoresCreados++;
        }
      }
    } else {
      if (!activo && (b.zex || b.serie || b.ntb)) creados++; else if (activo) actualizados++;
      if (!prof) sinProfesional++;
      if (b.monitor) monitoresCreados++;
    }
  }

  console.log('\n--- RESUMEN', DRY_RUN ? '(DRY RUN, nada escrito)' : '(EJECUTADO)', '---');
  console.log('Bloques procesados:', bloques.length, 'de', bloques.length + BLOQUES_EXCLUIDOS.length, '(se excluyeron', BLOQUES_EXCLUIDOS.length, 'por error de copiado confirmado)');
  console.log('Notebooks actualizados:', actualizados);
  console.log('Notebooks creados:', creados);
  console.log('Monitores creados:', monitoresCreados);
  console.log('Fotos subidas a Cloudinary:', fotosSubidas);
  console.log('Sin profesional encontrado:', sinProfesional);
  if (notasParaUsuario.length) {
    console.log('\nAvisos:');
    notasParaUsuario.forEach(n => console.log(' -', n));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
