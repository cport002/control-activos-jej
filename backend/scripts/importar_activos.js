// Importa el inventario real de notebooks. Fuente de verdad de los datos técnicos:
// "Lista Activos - Control de Activos (3).xlsx" (48 notebooks, archivo base).
// "INVENTARIO_2026_CC 669.xlsx" (hoja "Consolidado") es solo un anexo para cruzar por
// nombre de persona y rescatar datos que el archivo base no trae (RUT, correo, sistema
// operativo) — nunca reemplaza los datos técnicos del archivo base.
// Idempotente: los activos se upsertean por numero_serie, los profesionales por nombre normalizado.
require('dotenv').config();
const crypto = require('crypto');
const XLSX = require('xlsx');
const { sql } = require('../src/database/db');

const RUTA_BASE = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Documentos/Lista Activos - Control de Activos (3).xlsx';
const RUTA_INVENTARIO = 'C:/Users/usuario/OneDrive - J.E.J. Ingeniería S.A/Escritorio/INVENTARIO 2026/INVENTARIO_2026_CC 669.xlsx';
const CCO_TEXTO = '669 - CDCO DSAL Serv Contrpte Ing y Apoyo PEM';

function normalizar(s) {
  return (s || '').toString().trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}
function palabras(s) { return new Set(normalizar(s).split(' ').filter(Boolean)); }
function esSubconjunto(a, b) { return [...a].every(x => b.has(x)); }

function limpiarNombreAsignado(raw) {
  const desvinculado = /\[DESVINCULADO\]/i.test(raw);
  const nombre = raw.replace(/\[DESVINCULADO\]/i, '').trim();
  return { nombre, desvinculado };
}

async function main() {
  // --- Leer archivo de inventario (cruce) ---
  const wbInv = XLSX.readFile(RUTA_INVENTARIO);
  const invRows = XLSX.utils.sheet_to_json(wbInv.Sheets['Consolidado'], { header: 1, defval: null }).slice(3);
  const inventario = invRows.filter(r => r[0]).map(r => ({
    rut: r[1], apellidos: r[2], nombres: r[3], correo: r[4], usuarioCodelco: r[5],
    procesador: r[10], ram: r[11], disco: r[12], so: r[13], falla: r[15],
    w: palabras(`${r[2] || ''} ${r[3] || ''}`)
  }));

  function buscarEnInventario(nombreCompleto) {
    const w = palabras(nombreCompleto);
    return inventario.find(inv => esSubconjunto(w, inv.w) || esSubconjunto(inv.w, w));
  }

  // --- Leer archivo base ---
  const wbBase = XLSX.readFile(RUTA_BASE);
  const base = XLSX.utils.sheet_to_json(wbBase.Sheets['Sheet1'], { defval: null });

  // --- Profesionales ya existentes en la BD (para no duplicar) ---
  const existentes = (await sql('SELECT id, nombre FROM profesionales')).rows;
  const porNombre = new Map(existentes.map(p => [normalizar(p.nombre), p.id]));

  let activosCreados = 0, activosActualizados = 0;
  let profesionalesCreados = 0, profesionalesEnriquecidos = 0, sinMatchInventario = 0;

  for (const row of base) {
    const asignadoRaw = row['Usuario Asignado'] || '';
    const esNoAsignado = /no asignado/i.test(asignadoRaw);

    let profesionalId = null;

    if (!esNoAsignado) {
      const { nombre, desvinculado } = limpiarNombreAsignado(asignadoRaw);
      const inv = buscarEnInventario(nombre);
      if (!inv) sinMatchInventario++;

      const key = normalizar(nombre);
      if (porNombre.has(key)) {
        profesionalId = porNombre.get(key);
        if (inv) {
          await sql(
            `UPDATE profesionales SET
               rut = COALESCE(rut, ?), email = COALESCE(email, ?), cco = COALESCE(cco, ?),
               activo = ?, updated_at = NOW()
             WHERE id = ?`,
            [inv.rut || null, inv.correo || null, CCO_TEXTO, !desvinculado, profesionalId]
          );
          profesionalesEnriquecidos++;
        } else if (desvinculado) {
          await sql('UPDATE profesionales SET activo = false, updated_at = NOW() WHERE id = ?', [profesionalId]);
        }
      } else {
        const r = await sql(
          `INSERT INTO profesionales (nombre, rut, cargo, cco, email, activo, token)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          [nombre, inv?.rut || null, null, CCO_TEXTO, inv?.correo || null, !desvinculado, crypto.randomBytes(24).toString('hex')]
        );
        profesionalId = r.rows[0].id;
        porNombre.set(key, profesionalId);
        profesionalesCreados++;
      }
    }

    const inv = !esNoAsignado ? buscarEnInventario(limpiarNombreAsignado(asignadoRaw).nombre) : null;
    const notas = [
      `Procesador: ${row['Procesador'] || inv?.procesador || '-'}`,
      `Disco: ${row['Disco Duro'] || inv?.disco || '-'}`,
      `RAM: ${row['Memoria RAM'] || (inv?.ram ? inv.ram + ' GB' : '-')}`,
      inv?.so ? `SO: ${inv.so}` : null,
      row['Tipo Equipo'] ? `Gama: ${row['Tipo Equipo']}` : null,
      `CCO: 669`,
      row['Orden Compra'] ? `Orden de Compra: ${row['Orden Compra']}` : null
    ].filter(Boolean).join(' · ');

    const existeActivo = (await sql('SELECT id FROM activos WHERE numero_serie = ?', [row['N° Serie']])).rows[0];
    const estado = profesionalId ? 'asignado' : 'disponible';

    if (existeActivo) {
      await sql(
        `UPDATE activos SET nombre = ?, tipo = 'Notebook', marca = ?, modelo = ?, estado = ?, profesional_actual_id = ?, notas = ?, updated_at = NOW()
         WHERE id = ?`,
        [row['Nombre'], row['Marca'], row['Modelo'], estado, profesionalId, notas, existeActivo.id]
      );
      activosActualizados++;
    } else {
      await sql(
        `INSERT INTO activos (nombre, tipo, marca, modelo, numero_serie, estado, profesional_actual_id, notas)
         VALUES (?, 'Notebook', ?, ?, ?, ?, ?, ?)`,
        [row['Nombre'], row['Marca'], row['Modelo'], row['N° Serie'], estado, profesionalId, notas]
      );
      activosCreados++;
    }
  }

  console.log('--- Resumen de importación ---');
  console.log('Activos creados:', activosCreados, '| actualizados:', activosActualizados);
  console.log('Profesionales creados:', profesionalesCreados, '| enriquecidos con inventario:', profesionalesEnriquecidos);
  console.log('Asignados sin match en inventario (solo datos del archivo base):', sinMatchInventario);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
