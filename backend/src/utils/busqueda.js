// Divide el texto de búsqueda en palabras y exige que TODAS aparezcan (en cualquier orden,
// en cualquiera de los campos indicados). Así "Cristian Portilla" encuentra a alguien cuyo
// nombre completo es "Cristian Rafael Portilla Mellado" (antes solo se buscaba el texto
// completo como un único substring y fallaba si había palabras de por medio).
function condicionBusqueda(busqueda, campos) {
  const palabras = (busqueda || '').trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return { clause: '', params: [] };

  const params = [];
  const clausulas = palabras.map((palabra) => {
    const grupo = campos.map((campo) => `${campo} ILIKE ?`).join(' OR ');
    campos.forEach(() => params.push(`%${palabra}%`));
    return `(${grupo})`;
  });

  return { clause: ' AND ' + clausulas.join(' AND '), params };
}

module.exports = { condicionBusqueda };
