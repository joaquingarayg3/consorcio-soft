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

// "5 oct 2026, 14:30" en hora local, para mostrar cuándo se publicó algo.
export function formatearFechaHora(valor) {
  if (!valor) return "";
  return new Date(valor).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// "5 oct 2026" a partir de una fecha "AAAA-MM-DD" (la de fecha_desde/hasta),
// armada con día y mes locales para que la zona horaria no la corra un día.
export function formatearFecha(valor) {
  if (!valor) return "";
  const [anio, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return String(valor);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-AR", {
    dateStyle: "medium",
  });
}
