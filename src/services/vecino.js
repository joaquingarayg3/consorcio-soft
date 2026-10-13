import supabase from "../supabase-client";
import { asignacionVigente, hoy } from "../utils/fechas";

const porNombre = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });

// Las unidades que la persona tiene hoy (puede tener varias, en distintos
// edificios o en el mismo), ordenadas por edificio y unidad.
export async function fetchMisAsignaciones(userId) {
  if (!userId) return [];
  const fecha = hoy();
  const { data, error } = await supabase
    .from("unidad_usuarios")
    .select(
      "id, vinculo, fecha_desde, fecha_hasta, unidad_funcional:unidad_id ( id, identificador, piso, tipo, edificio_id, edificio:edificio_id ( id, nombre, codigo, foto_path, miniatura_path ) )",
    )
    .eq("usuario_id", userId)
    .lte("fecha_desde", fecha);
  if (error) throw error;

  return (data ?? [])
    .filter((fila) => asignacionVigente(fila, fecha) && fila.unidad_funcional)
    .sort(
      (a, b) =>
        porNombre(
          a.unidad_funcional.edificio?.nombre,
          b.unidad_funcional.edificio?.nombre,
        ) ||
        porNombre(
          a.unidad_funcional.identificador,
          b.unidad_funcional.identificador,
        ),
    );
}
