const PDFDocument = require('pdfkit');

const PURPLE = '#4f46e5';
const GRAY_900 = '#1f2937';
const GRAY_600 = '#4b5563';
const GRAY_400 = '#9ca3af';

const CONDICION_LABEL = { bueno: 'Bueno', con_observaciones: 'Con observaciones', 'dañado': 'Dañado' };
const TIPO_LABEL = { entrega: 'Acta de Entrega', devolucion: 'Acta de Devolución' };

async function descargarImagen(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// Genera el PDF del acta escribiendo directamente al stream de respuesta HTTP (res).
async function generarActaPDF(acta, res) {
  const M = 56;
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const CONTENT_W = PAGE_W - M * 2;

  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: 70, left: M, right: M } });
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(18).fillColor(GRAY_900).text('JEJ Ingeniería', M, M);
  doc.font('Helvetica').fontSize(13).fillColor(PURPLE).text(TIPO_LABEL[acta.tipo] || acta.tipo, M, doc.y + 2);
  doc.font('Helvetica').fontSize(9).fillColor(GRAY_400).text(`N° ${acta.id} · ${new Date(acta.fecha).toLocaleDateString('es-CL')}`, M, doc.y + 2);
  doc.moveDown(1.2);

  function fila(label, valor) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY_600).text(label, M, y, { width: 150 });
    doc.font('Helvetica').fontSize(10).fillColor(GRAY_900).text(valor || '-', M + 150, y, { width: CONTENT_W - 150 });
    doc.moveDown(0.35);
  }

  doc.font('Helvetica-Bold').fontSize(12).fillColor(GRAY_900).text('Activo');
  doc.moveDown(0.3);
  fila('Nombre', acta.activo_nombre);
  fila('Tipo', acta.activo_tipo);
  fila('Marca / Modelo', [acta.activo_marca, acta.activo_modelo].filter(Boolean).join(' / '));
  fila('N° de serie', acta.activo_numero_serie);
  fila('Accesorios', acta.activo_accesorios);

  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(GRAY_900).text('Profesional');
  doc.moveDown(0.3);
  fila('Nombre', acta.profesional_nombre);
  fila('RUT', acta.profesional_rut);
  fila('Cargo', acta.profesional_cargo);
  fila('CCO', acta.profesional_cco);

  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(GRAY_900).text('Detalle del acta');
  doc.moveDown(0.3);
  fila('Condición del equipo', CONDICION_LABEL[acta.condicion_equipo] || acta.condicion_equipo);
  fila('Observaciones', acta.observaciones);
  fila('Registrado por', acta.usuario_nombre);

  doc.moveDown(0.8);
  const firmaBuffer = await descargarImagen(acta.firma_url);
  if (firmaBuffer) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(GRAY_900).text('Firma');
    doc.moveDown(0.2);
    try { doc.image(firmaBuffer, M, doc.y, { width: 200, height: 90, fit: [200, 90] }); doc.y += 95; } catch { /* firma no valida, se omite */ }
  }

  const fotos = acta.fotos || [];
  if (fotos.length) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(GRAY_900).text('Evidencia fotográfica');
    doc.moveDown(0.3);
    let x = M;
    const anchoFoto = 110;
    for (const url of fotos) {
      const buf = await descargarImagen(url);
      if (!buf) continue;
      if (x + anchoFoto > PAGE_W - M) { x = M; doc.moveDown(0.5); }
      const y = doc.y;
      try { doc.image(buf, x, y, { width: anchoFoto, height: anchoFoto, fit: [anchoFoto, anchoFoto] }); } catch { /* omitir foto invalida */ }
      x += anchoFoto + 10;
    }
    doc.moveDown(7);
  }

  doc.end();
}

module.exports = { generarActaPDF };
