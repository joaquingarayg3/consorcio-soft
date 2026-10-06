import supabase from "../supabase-client";
import { asignacionVigente, hoy } from "../utils/fechas";

const CAMPOS_RESUMEN = "id, titulo, creado_en, edificio_id";
const CAMPOS_COMPLETOS = `${CAMPOS_RESUMEN}, contenido`;
const EDIFICIO = "edificio:edificio_id ( nombre )";

// Edificios donde la persona tiene hoy una unidad vigente. Es lo que decide
// qué anuncios son "suyos": un admin ve todos por permisos, pero sus avisos
// (campanita, portal) son solo los de los edificios donde vive o tiene unidad.
async function fetchMisEdificioIds(userId) {
  const fecha = hoy();
  const { data, error } = await supabase
    .from("unidad_usuarios")
    .select(
      "fecha_desde, fecha_hasta, unidad_funcional:unidad_id ( edificio_id )",
    )
    .eq("usuario_id", userId)
    .lte("fecha_desde", fecha);
  if (error) throw error;
  const ids = (data ?? [])
    .filter((fila) => asignacionVigente(fila, fecha))
    .map((fila) => fila.unidad_funcional?.edificio_id)
    .filter(Boolean);
  return [...new Set(ids)];
}

// Anuncios de los edificios de la persona, del más nuevo al más viejo, y el
// conjunto de ids que todavía no leyó. `conContenido: false` sirve para la
// campanita, que solo muestra títulos.
export async function fetchAnunciosParaUsuario(
  userId,
  { conContenido = false, limite = null } = {},
) {
  const edificioIds = await fetchMisEdificioIds(userId);
  if (!edificioIds.length) return { anuncios: [], noLeidos: new Set() };

  let consulta = supabase
    .from("anuncios")
    .select(`${conContenido ? CAMPOS_COMPLETOS : CAMPOS_RESUMEN}, ${EDIFICIO}`)
    .in("edificio_id", edificioIds)
    .order("creado_en", { ascending: false });
  if (limite) consulta = consulta.limit(limite);

  const [{ data: anuncios, error }, { data: lecturas, error: errorLecturas }] =
    await Promise.all([
      consulta,
      supabase
        .from("anuncio_lecturas")
        .select("anuncio_id")
        .eq("usuario_id", userId),
    ]);
  if (error) throw error;
  if (errorLecturas) throw errorLecturas;

  const leidos = new Set((lecturas ?? []).map((fila) => fila.anuncio_id));
  const lista = anuncios ?? [];
  return {
    anuncios: lista,
    noLeidos: new Set(lista.filter((a) => !leidos.has(a.id)).map((a) => a.id)),
  };
}

export async function marcarAnunciosLeidos(userId, anuncioIds) {
  if (!anuncioIds.length) return;
  const { error } = await supabase.from("anuncio_lecturas").upsert(
    anuncioIds.map((anuncio_id) => ({ anuncio_id, usuario_id: userId })),
    { onConflict: "anuncio_id,usuario_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

// --- Gestión (admin), siempre dentro de un edificio ---

export async function fetchAnunciosDeEdificio(edificioId) {
  const { data, error } = await supabase
    .from("anuncios")
    .select(CAMPOS_COMPLETOS)
    .eq("edificio_id", edificioId)
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearAnuncio({ edificioId, titulo, contenido, userId }) {
  const { data, error } = await supabase
    .from("anuncios")
    .insert({
      edificio_id: edificioId,
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      creado_por: userId,
    })
    .select(CAMPOS_COMPLETOS)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarAnuncio(id, { titulo, contenido }) {
  const { data, error } = await supabase
    .from("anuncios")
    .update({ titulo: titulo.trim(), contenido: contenido.trim() })
    .eq("id", id)
    .select(CAMPOS_COMPLETOS)
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarAnuncio(id) {
  const { error } = await supabase.from("anuncios").delete().eq("id", id);
  if (error) throw error;
}
