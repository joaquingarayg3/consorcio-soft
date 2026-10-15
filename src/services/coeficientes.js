import supabase from "../supabase-client";
import { hoy } from "../utils/fechas";

// Esquema "GENERAL" que rige hoy en un edificio y el coeficiente de cada unidad
// en él: { esquema, valores: { [unidadId]: valor entre 0 y 1 } }. Sin esquema
// vigente devuelve { esquema: null, valores: {} }. Solo la administración puede
// leer estas tablas (la base no devuelve nada a nadie más).
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
