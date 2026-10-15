import supabase from "../supabase-client";
import { hoy } from "../utils/fechas";

// Todas estas funciones lanzan el error de Supabase si algo falla; quien las
// llama lo convierte en un mensaje con mensajeDeError. Solo la administración
// puede leer y escribir estas tablas (la base no devuelve nada a nadie más).

const CAMPOS_ESQUEMA =
  "id, edificio_id, codigo, nombre, metodo, esquema_base_id, vigente_desde, vigente_hasta, tolerancia, estado, publicado_en";

// Esquema "GENERAL" que rige hoy en un edificio y el coeficiente de cada unidad
// en él: { esquema, valores: { [unidadId]: valor entre 0 y 1 } }. Sin esquema
// vigente devuelve { esquema: null, valores: {} }.
export async function fetchCoeficienteGeneral(edificioId) {
  const fecha = hoy();
  const { data: esquemas, error } = await supabase
    .from("esquema_coeficiente")
    .select("id, nombre, estado, tolerancia, vigente_desde, vigente_hasta")
    .eq("edificio_id", edificioId)
    .eq("codigo", "GENERAL")
    .order("vigente_desde", { ascending: false });
  if (error) throw error;

  const vigente = (esquemas ?? []).find(
    (e) =>
      e.vigente_desde <= fecha && (!e.vigente_hasta || e.vigente_hasta > fecha),
  );
  if (!vigente) return { esquema: null, valores: {} };

  const { data, error: errorValores } = await supabase
    .from("coeficiente")
    .select("unidad_id, valor")
    .eq("esquema_id", vigente.id);
  if (errorValores) throw errorValores;

  return {
    esquema: vigente,
    valores: Object.fromEntries(
      (data ?? []).map((fila) => [fila.unidad_id, Number(fila.valor)]),
    ),
  };
}

// Los esquemas de un edificio con cuántas unidades participan y cuánto suman.
export async function fetchEsquemas(edificioId) {
  const [esquemas, filas] = await Promise.all([
    supabase
      .from("esquema_coeficiente")
      .select(CAMPOS_ESQUEMA)
      .eq("edificio_id", edificioId)
      .order("codigo")
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("coeficiente")
      .select("esquema_id, valor")
      .eq("edificio_id", edificioId),
  ]);
  if (esquemas.error) throw esquemas.error;
  if (filas.error) throw filas.error;

  const totales = {};
  for (const fila of filas.data ?? []) {
    const total = (totales[fila.esquema_id] ??= { unidades: 0, suma: 0 });
    total.unidades += 1;
    total.suma += Number(fila.valor);
  }
  return (esquemas.data ?? []).map((esquema) => ({
    ...esquema,
    unidades: totales[esquema.id]?.unidades ?? 0,
    suma: totales[esquema.id]?.suma ?? 0,
  }));
}

export async function fetchEsquema(esquemaId) {
  const { data, error } = await supabase
    .from("esquema_coeficiente")
    .select(CAMPOS_ESQUEMA)
    .eq("id", esquemaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchUnidadesDeEdificio(edificioId) {
  const { data, error } = await supabase
    .from("unidad_funcional")
    .select("id, identificador, tipo, piso, numero_uf, unidad_principal_id")
    .eq("edificio_id", edificioId);
  if (error) throw error;
  return data ?? [];
}

// Participantes de un esquema: [{ unidad_id, valor, peso }].
export async function fetchCoeficientesDeEsquema(esquemaId) {
  const { data, error } = await supabase
    .from("coeficiente")
    .select("unidad_id, valor, peso")
    .eq("esquema_id", esquemaId);
  if (error) throw error;
  return (data ?? []).map((fila) => ({
    unidad_id: fila.unidad_id,
    valor: Number(fila.valor),
    peso: Number(fila.peso),
  }));
}

export async function crearEsquema({
  edificioId,
  codigo,
  nombre,
  metodo,
  baseId,
  desde,
  tolerancia,
}) {
  const { data, error } = await supabase.rpc("crear_esquema", {
    p_edificio: edificioId,
    p_codigo: codigo,
    p_nombre: nombre,
    p_metodo: metodo,
    p_base: baseId || null,
    p_desde: desde || null,
    p_tolerancia: tolerancia ?? null,
  });
  if (error) throw error;
  return data;
}

// Cambios en un borrador: nombre, vigencia y tolerancia.
export async function actualizarEsquema(esquemaId, campos) {
  const { error } = await supabase
    .from("esquema_coeficiente")
    .update(campos)
    .eq("id", esquemaId);
  if (error) throw error;
}

export async function eliminarEsquema(esquemaId) {
  const { data, error } = await supabase
    .from("esquema_coeficiente")
    .delete()
    .eq("id", esquemaId)
    .select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error("No se pudo eliminar: un esquema publicado no se borra.");
  }
}

// Reemplaza los participantes del borrador por `filas` y recalcula. No exige que
// sume 1. Devuelve lo que suma ahora.
export async function guardarCoeficientes(esquemaId, filas) {
  const { data, error } = await supabase.rpc("guardar_coeficientes", {
    p_esquema: esquemaId,
    p_filas: filas,
  });
  if (error) throw error;
  return Number(data);
}

export async function publicarEsquema(esquemaId) {
  const { error } = await supabase.rpc("publicar_esquema", {
    p_esquema: esquemaId,
  });
  if (error) throw error;
}

export async function despublicarEsquema(esquemaId) {
  const { error } = await supabase.rpc("despublicar_esquema", {
    p_esquema: esquemaId,
  });
  if (error) throw error;
}

export async function nuevaVersionEsquema(esquemaId, desde) {
  const { data, error } = await supabase.rpc("nueva_version_esquema", {
    p_esquema: esquemaId,
    p_desde: desde,
  });
  if (error) throw error;
  return data;
}
