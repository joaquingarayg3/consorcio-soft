import supabase from "../supabase-client";

const TABLE_NAME = "reclamos";

const SELECT_FIELDS = `
  *,
  unidad_funcional:unidad_funcional_id ( id, identificador, piso ),
  reportante:reportante_id ( nombre, apellido, email ),
  cerrado_por:cerrado_por_id ( nombre, apellido )
`;

export async function fetchClaimsForUser({ userId, isAdmin }) {
  let query = supabase
    .from(TABLE_NAME)
    .select(SELECT_FIELDS)
    .order("fecha_creacion", { ascending: false });

  if (!isAdmin) {
    query = query.eq("reportante_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchMyUnidadesFuncionales(userId) {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("unidad_usuarios")
    .select("unidad_funcional:unidad_id ( id, identificador, piso )")
    .eq("usuario_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.unidad_funcional).filter(Boolean);
}

export async function createClaim(claimData) {
  const payload = {
    titulo: claimData.title,
    categoria: claimData.category,
    prioridad: claimData.priority,
    unidad_funcional_id: claimData.unidadFuncionalId || null,
    ubicacion: claimData.location || "Sin ubicación",
    descripcion: claimData.description,
    reportante_id: claimData.reportanteId,
    estado: "abierto",
    fecha_creacion: new Date().toISOString(),
    fecha_cierre: null,
    cerrado_por_id: null,
    nota_admin: null,
    fecha_actualizacion: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select(SELECT_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function closeClaim(claimId, closedById) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({
      estado: "cerrado",
      fecha_cierre: new Date().toISOString(),
      cerrado_por_id: closedById,
      fecha_actualizacion: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select(SELECT_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
