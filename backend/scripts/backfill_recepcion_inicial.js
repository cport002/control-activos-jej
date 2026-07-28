// Carga histórica única: registra la "Recepción inicial" (acta de entrega, sin firma real)
// de los notebooks que ya estaban asignados desde el inicio del contrato, según la
// "Lista Activos" oficial que compartió el usuario. Idempotente: si ya existe una acta
// de entrega para ese activo+profesional, no la duplica.
require('dotenv').config();
const { sql, pool } = require('../src/database/db');

const SELLO_URL = 'https://res.cloudinary.com/nfk0ch3u/image/upload/v1785255637/jej-activos-firmas/sello-registro-historico.png';
const OBSERVACION = 'Equipo entregado al inicio de contrato';

// [codigo_activo, usuario_asignado_tal_cual_en_la_lista]
const ASIGNACIONES = [
  ['ETI-NTB-2583', 'Roberto Luis Inzulza Ayala'],
  ['ETI-NTB-2692', 'Cristian Rafael Portilla Mellado'],
  ['ETI-NTB-1810', 'Gustavo Hurtado Gonzalez'],
  ['ETI-NTB-2660', 'Rodrigo Alfredo Barrios Arredondo'],
  ['ETI-NTB-2016', 'María Jose Araya Vergara'],
  ['ETI-NTB-2020', 'Daniza Hernandez Cisternas'],
  ['ETI-NTB-2008', 'Francisco Acuña Garcia'],
  ['ETI-NTB-2442', 'Jonas Alberto Ochoa Castillo'],
  ['ETI-NTB-1345', 'Manuel Rodriguez Bugueño'],
  ['ETI-NTB-2007', 'Wildo Olivares Barrios'],
  ['ETI-NTB-2349', 'John Cordero Leiva'],
  ['ETI-NTB-2426', 'Alejandro Ramos Gonzalez'],
  ['ETI-NTB-1229', 'Victor Arancibia Salinas'],
  ['ETI-NTB-1182', 'Claudio Pizarro Contreras'],
  ['ETI-NTB-2620', 'Oscar Eduardo Madrigal Lobos'],
  ['ETI-NTB-0900', 'Elizabeth Del Carmen Araya Rivera'],
  ['ETI-NTB-1773', 'John Romero Azola'],
  ['ETI-NTB-2192', 'Claudio Andrés Meza Venegas'],
  ['ETI-NTB-2597', 'Moises Segundo Díaz Jara'],
  ['ETI-NTB-2052', 'Rodrigo Zamora Maltes'],
  ['ETI-NTB-2545', 'Sebastián Enrique Miño Monje'],
  ['ETI-NTB-2092', 'Héctor Conrado Flores Carrizo'],
  ['ETI-NTB-2191', 'René Rodrigo Antonio Egaña Espinoza'],
  ['ETI-NTB-1435', 'Patricio Ochoa Castillo'],
  ['ETI-NTB-2478', 'Catalina Carvallo Guajardo'],
  ['ETI-NTB-1218', 'Elizabeth Del Carmen Araya Rivera'],
  ['ETI-NTB-1248', 'Elvis Molina Tapia'],
  ['ETI-NTB-2239', 'Mario Azola Araya'],
  ['ETI-NTB-2332', 'Sebastian Alejandro Garcia Ochoa'],
  ['ETI-NTB-2647', 'Daniel Eduardo Toro Angel'],
  ['ETI-NTB-2434', 'Anita Revello Osorio'],
  ['ETI-NTB-2525', 'Nathaly Diaz Rivera'],
  ['ETI-NTB-2744', 'Gabriel Hernán Flores Vera'],
  ['ETI-NTB-2759', 'Roberto Luis Inzulza Ayala'],
  ['ETI-NTB-2577', 'Jorge Antonio Lamas Rojas'],
  ['ETI-NTB-2826', 'Luis Fernando Calderón Córdova'],
  ['ETI-NTB-1920', 'Exequiel Damaso Aguilera Rivera'],
  ['ETI-NTB-3091', 'Mario Azola Araya'],
  ['ETI-NTB-2118', 'Leonardo Hidalgo Zañartu'],
  ['ETI-NTB-3101', 'Matías Alejandro Vega Escobar'],
  ['ETI-NTB-3622', 'Camila Valeska Mattos Aguilera'],
  ['ETI-NTB-3771', 'Sebastián Abelardo Poblete Abello'],
  ['ETI-NTB-4338', 'Paulo Castillo Jofre'],
];

async function main() {
  const admin = (await sql("SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY id LIMIT 1")).rows[0];
  const profesionales = (await sql('SELECT id, nombre FROM profesionales')).rows;
  const porNombre = new Map(profesionales.map(p => [p.nombre.toLowerCase().trim(), p]));

  // 1) Corrige la única asignación que estaba pendiente
  const activoPendiente = (await sql("SELECT id, estado, profesional_actual_id, nombre FROM activos WHERE nombre = 'ETI-NTB-2545'")).rows[0];
  if (activoPendiente && activoPendiente.estado === 'disponible') {
    const sebastian = porNombre.get('sebastián enrique miño monje');
    if (!sebastian) throw new Error('No se encontró a Sebastián Enrique Miño Monje en profesionales');
    await sql("UPDATE activos SET estado = 'asignado', profesional_actual_id = ?, updated_at = NOW() WHERE id = ?", [sebastian.id, activoPendiente.id]);
    console.log('Corregido: ETI-NTB-2545 -> Sebastián Enrique Miño Monje');
  } else {
    console.log('ETI-NTB-2545 ya estaba asignado (sin cambios):', activoPendiente?.estado);
  }

  let creadas = 0, yaExistian = 0, sinCoincidencia = 0;

  for (const [codigo, usuarioTexto] of ASIGNACIONES) {
    const activo = (await sql('SELECT id, nombre FROM activos WHERE nombre = ?', [codigo])).rows[0];
    if (!activo) { console.log('  [omitido] activo no encontrado:', codigo); sinCoincidencia++; continue; }

    const usuarioLimpio = usuarioTexto.replace(/\s*\[DESVINCULADO\]\s*/i, '').trim();
    const prof = porNombre.get(usuarioLimpio.toLowerCase());
    if (!prof) { console.log('  [omitido] profesional no encontrado:', usuarioTexto, 'para', codigo); sinCoincidencia++; continue; }

    const yaExiste = (await sql(
      "SELECT id FROM actas WHERE activo_id = ? AND profesional_id = ? AND tipo = 'entrega'",
      [activo.id, prof.id]
    )).rows[0];
    if (yaExiste) { yaExistian++; continue; }

    const r = await sql(
      `INSERT INTO actas (activo_id, profesional_id, tipo, condicion_equipo, observaciones, firma_url, usuario_id)
       VALUES (?, ?, 'entrega', 'bueno', ?, ?, ?) RETURNING id`,
      [activo.id, prof.id, OBSERVACION, SELLO_URL, admin.id]
    );
    await sql(
      `INSERT INTO auditoria (tabla, registro_id, accion, datos_nuevos, descripcion, usuario_id)
       VALUES ('actas', ?, 'INSERT', ?, ?, ?)`,
      [r.rows[0].id, JSON.stringify({ activo_id: activo.id, profesional_id: prof.id, tipo: 'entrega' }),
       'Carga histórica: recepción inicial de contrato (sin firma real, sello administrativo)', admin.id]
    );
    creadas++;
  }

  console.log(`\nActas creadas: ${creadas} | Ya existían: ${yaExistian} | Sin coincidencia: ${sinCoincidencia}`);
  await pool.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
