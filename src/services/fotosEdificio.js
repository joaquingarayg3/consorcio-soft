import supabase from "../supabase-client";

const BUCKET = "edificios";
// Las fotos son privadas: se ven con un enlace temporal que firma Supabase solo
// si la persona tiene permiso (administradores y vecinos del edificio).
const VIGENCIA_SEGUNDOS = 3600;
const MARGEN_SEGUNDOS = 600;

const enlaces = new Map(); // ruta -> { url, vence }

// { ruta: enlace temporal } para las rutas que se puedan ver. Reutiliza los
// enlaces ya pedidos mientras no estén por vencer.
export async function fetchUrlsFotos(rutas) {
  const unicas = [...new Set(rutas.filter(Boolean))];
  const ahora = Date.now();
  const faltan = unicas.filter((ruta) => !(enlaces.get(ruta)?.vence > ahora));

  if (faltan.length > 0) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(faltan, VIGENCIA_SEGUNDOS);
    if (error) throw error;
    for (const fila of data ?? []) {
      if (fila.signedUrl && !fila.error) {
        enlaces.set(fila.path, {
          url: fila.signedUrl,
          vence: ahora + (VIGENCIA_SEGUNDOS - MARGEN_SEGUNDOS) * 1000,
        });
      }
    }
  }

  return Object.fromEntries(
    unicas
      .filter((ruta) => enlaces.has(ruta))
      .map((ruta) => [ruta, enlaces.get(ruta).url]),
  );
}

const OPCIONES_SUBIDA = {
  contentType: "image/jpeg",
  upsert: false,
  // Cada foto tiene un nombre nuevo, así que nunca cambia: puede guardarse un año.
  cacheControl: "31536000",
};

// Sube la portada y la miniatura, deja el edificio apuntando a ellas y borra
// las anteriores. Devuelve el edificio actualizado.
export async function subirFotoEdificio(edificio, { portada, miniatura }) {
  const almacen = supabase.storage.from(BUCKET);
  const marca = Date.now();
  const rutaPortada = `${edificio.id}/${marca}.jpg`;
  const rutaMiniatura = `${edificio.id}/${marca}-mini.jpg`;

  const subidaPortada = await almacen.upload(
    rutaPortada,
    portada,
    OPCIONES_SUBIDA,
  );
  if (subidaPortada.error) throw subidaPortada.error;

  const subidaMiniatura = await almacen.upload(
    rutaMiniatura,
    miniatura,
    OPCIONES_SUBIDA,
  );
  if (subidaMiniatura.error) {
    await almacen.remove([rutaPortada]);
    throw subidaMiniatura.error;
  }

  const { data, error } = await supabase
    .from("edificio")
    .update({
      foto_path: rutaPortada,
      miniatura_path: rutaMiniatura,
      foto_actualizada_en: new Date().toISOString(),
    })
    .eq("id", edificio.id)
    .select()
    .single();
  if (error) {
    await almacen.remove([rutaPortada, rutaMiniatura]);
    throw error;
  }

  const anteriores = [edificio.foto_path, edificio.miniatura_path].filter(
    Boolean,
  );
  if (anteriores.length > 0) almacen.remove(anteriores).catch(() => {});
  return data;
}

export async function quitarFotoEdificio(edificio) {
  const { data, error } = await supabase
    .from("edificio")
    .update({
      foto_path: null,
      miniatura_path: null,
      foto_actualizada_en: null,
    })
    .eq("id", edificio.id)
    .select()
    .single();
  if (error) throw error;

  const anteriores = [edificio.foto_path, edificio.miniatura_path].filter(
    Boolean,
  );
  if (anteriores.length > 0) {
    supabase.storage
      .from(BUCKET)
      .remove(anteriores)
      .catch(() => {});
  }
  return data;
}
