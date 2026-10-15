// Quién escribió un comentario o cargó un reclamo. La base copia el nombre en
// cada fila (así lo ven también los demás vecinos, que no pueden leer perfiles),
// y la administración se distingue con una marca.

function nombreCompleto(persona) {
  return `${persona?.nombre ?? ""} ${persona?.apellido ?? ""}`.trim();
}

// Comentario: { nombre, unidad, esAdmin }. `autor` (la persona cargada junto al
// comentario) solo existe en el modo de demostración.
export function autorDeComentario(comentario) {
  const nombre =
    comentario.autor_nombre ||
    nombreCompleto(comentario.autor || comentario.author) ||
    (comentario.usuario_id ? "Usuario" : "Usuario eliminado");
  return {
    nombre,
    unidad: comentario.autor_unidad || null,
    esAdmin: Boolean(comentario.autor_es_admin),
  };
}

// Reclamo: la unidad es la del propio reclamo. La administración no tiene unidad.
export function autorDeReclamo(reclamo) {
  const esAdmin = Boolean(reclamo.reportante_es_admin);
  const nombre =
    reclamo.reportante_nombre ||
    nombreCompleto(reclamo.reportante) ||
    (reclamo.reportante_id ? "Vecino" : "Usuario eliminado");
  return {
    nombre,
    unidad: esAdmin ? null : reclamo.unidad_funcional?.identificador || null,
    esAdmin,
  };
}
