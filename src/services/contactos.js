import supabase from "../supabase-client";

const CAMPOS_EDIFICIO_INFO =
  "id, nombre, direccion, cuit, banco, titular_cuenta, cbu, alias_cbu";

// Contactos de un edificio, en el orden en que se cargaron.
export async function fetchContactos(edificioId) {
  const { data, error } = await supabase
    .from("edificio_contactos")
    .select("id, nombre, telefono")
    .eq("edificio_id", edificioId)
    .order("creado_en");
  if (error) throw error;
  return data ?? [];
}

export async function crearContacto(edificioId, { nombre, telefono }) {
  const { data, error } = await supabase
    .from("edificio_contactos")
    .insert({ edificio_id: edificioId, nombre, telefono })
    .select("id, nombre, telefono")
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarContacto(id, { nombre, telefono }) {
  const { data, error } = await supabase
    .from("edificio_contactos")
    .update({ nombre, telefono })
    .eq("id", id)
    .select("id, nombre, telefono")
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarContacto(id) {
  const { error } = await supabase
    .from("edificio_contactos")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Lo que ve un vecino en "Contactos e información útil": por cada edificio
// suyo, sus datos y sus contactos. La base devuelve solo lo que le corresponde.
// Devuelve [{ ...edificio, contactos: [{ id, nombre, telefono }] }].
export async function fetchInfoUtil(edificioIds) {
  if (!edificioIds.length) return [];
  const [edificios, contactos] = await Promise.all([
    supabase
      .from("edificio")
      .select(CAMPOS_EDIFICIO_INFO)
      .in("id", edificioIds)
      .order("nombre"),
    supabase
      .from("edificio_contactos")
      .select("id, edificio_id, nombre, telefono")
      .in("edificio_id", edificioIds)
      .order("creado_en"),
  ]);
  if (edificios.error) throw edificios.error;
  if (contactos.error) throw contactos.error;

  const porEdificio = {};
  for (const contacto of contactos.data ?? []) {
    (porEdificio[contacto.edificio_id] ??= []).push(contacto);
  }
  return (edificios.data ?? []).map((edificio) => ({
    ...edificio,
    contactos: porEdificio[edificio.id] ?? [],
  }));
}
