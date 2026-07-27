// Varios activos (monitores, radios) se nombraron en su carga inicial como "<Tipo> <Marca> <Persona>"
// (ej. "Monitor SAMSUNG Cristian Rafael Portilla Mellado"). Ese nombre es un campo de texto fijo:
// no se actualiza solo al reasignar el activo a otra persona. Esta función detecta si el nombre
// actual contiene, tal cual, el nombre completo de EXACTAMENTE UN profesional conocido (normalmente
// quien lo tenía antes) y lo reemplaza por el del nuevo profesional. Si no encuentra ninguno, o
// encuentra más de uno (ambiguo), deja el nombre sin tocar — más vale no tocarlo que adivinar mal.
function nombreActualizado(nombreActual, nuevoProfesionalNombre, profesionales) {
  if (!nombreActual || !nuevoProfesionalNombre) return nombreActual;
  const coincidencias = profesionales.filter(
    (p) => p.nombre && p.nombre !== nuevoProfesionalNombre && nombreActual.includes(p.nombre)
  );
  if (coincidencias.length !== 1) return nombreActual;
  return nombreActual.split(coincidencias[0].nombre).join(nuevoProfesionalNombre);
}

module.exports = { nombreActualizado };
