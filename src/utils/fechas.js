// Fecha de hoy como "AAAA-MM-DD" en UTC, igual que current_date en Supabase,
// para que la app y las políticas RLS decidan lo mismo.
export function hoy() {
  return new Date().toISOString().slice(0, 10);
}

// Una asignación rige desde fecha_desde (inclusive) hasta fecha_hasta
// (exclusive): finalizarla con fecha_hasta = hoy corta el acceso en el acto.
export function asignacionVigente(asignacion, fecha = hoy()) {
  if (!asignacion) return false;
  return (
    (!asignacion.fecha_desde || asignacion.fecha_desde <= fecha) &&
    (!asignacion.fecha_hasta || asignacion.fecha_hasta > fecha)
  );
}
