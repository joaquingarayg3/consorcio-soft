import supabase from "../supabase-client";
import { asignacionVigente } from "../utils/fechas";

const CAMPOS = "id, nombre, apellido, email";

// Las palabras viajan dentro de un filtro `or(...)` de PostgREST: se les quitan
// los caracteres que arman su sintaxis (coma, paréntesis, comodines, comillas)
// para que lo escrito nunca pueda cambiar el filtro.
function palabrasSeguras(texto) {
  return String(texto ?? "")
    .split(/\s+/)
    .map((palabra) => palabra.replace(/[,()*%\\"]/g, ""))
    .filter(Boolean)
    .slice(0, 5);
}

// Busca entre los usuarios activos. Cada palabra tiene que aparecer en el
// nombre, el apellido o el email (en cualquier orden). Sin texto devuelve los
// primeros por orden alfabético. Trae `limite + 1` para saber si hay más.
export async function buscarUsuariosActivos(texto, limite = 30) {
  // Lo normal: la función de la base, que ignora tildes (migración
  // buscar_usuarios). Si todavía no está aplicada, se busca con ilike, que sí
  // distingue tildes pero funciona igual.
  const { data: porFuncion, error: errorFuncion } = await supabase.rpc(
    "buscar_perfiles_activos",
    { texto: String(texto ?? ""), limite: limite + 1 },
  );
  if (!errorFuncion) {
    const filas = porFuncion ?? [];
    return { usuarios: filas.slice(0, limite), hayMas: filas.length > limite };
  }
  console.warn("buscar_perfiles_activos no disponible", errorFuncion);

  let consulta = supabase
    .from("perfiles")
    .select(CAMPOS)
    .eq("activo", true)
    .order("apellido")
    .order("nombre")
    .limit(limite + 1);

  for (const palabra of palabrasSeguras(texto)) {
    consulta = consulta.or(
      `nombre.ilike.%${palabra}%,apellido.ilike.%${palabra}%,email.ilike.%${palabra}%`,
    );
  }

  const { data, error } = await consulta;
  if (error) throw error;
  const filas = data ?? [];
  return { usuarios: filas.slice(0, limite), hayMas: filas.length > limite };
}

// Nombres de las personas ya asignadas, sin traer a todos los usuarios.
export async function fetchUsuariosPorIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("perfiles")
    .select(CAMPOS)
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

// Unidades que cada persona tiene hoy (puede tener varias, en distintos
// edificios o en el mismo). Devuelve { usuarioId: [{ unidadId, unidad,
// edificio, vinculo }] }.
export async function fetchAsignacionesVigentes(usuarioIds) {
  if (!usuarioIds.length) return {};
  const { data, error } = await supabase
    .from("unidad_usuarios")
    .select(
      "usuario_id, vinculo, fecha_desde, fecha_hasta, unidad_id, unidad_funcional:unidad_id ( identificador, edificio:edificio_id ( nombre ) )",
    )
    .in("usuario_id", usuarioIds);
  if (error) throw error;

  const porUsuario = {};
  for (const fila of data ?? []) {
    if (!asignacionVigente(fila)) continue;
    (porUsuario[fila.usuario_id] ??= []).push({
      unidadId: fila.unidad_id,
      unidad: fila.unidad_funcional?.identificador ?? "unidad",
      edificio: fila.unidad_funcional?.edificio?.nombre ?? "",
      vinculo: fila.vinculo,
    });
  }
  return porUsuario;
}
