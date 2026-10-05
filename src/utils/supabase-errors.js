// Convierte un error de Supabase/Postgres en un mensaje para la persona que
// usa la app. Los mensajes propios de los triggers (P0001) ya están en
// castellano y se muestran tal cual.
export function mensajeDeError(
  error,
  fallback = "No se pudo completar la operación.",
) {
  if (!error) return fallback;
  const texto = String(error.message || "");
  switch (error.code) {
    case "P0001":
      return texto || fallback;
    case "23503":
      return texto.includes("delete")
        ? "No se puede borrar porque tiene datos asociados (por ejemplo, reclamos o usuarios asignados)."
        : "El dato relacionado no existe o fue borrado.";
    case "23505":
      return "Ya existe un registro con esos datos.";
    case "23502":
      return "Faltan completar campos obligatorios.";
    case "23514":
      return "Algún dato no cumple el formato permitido.";
    case "42501":
      return "No tenés permisos para realizar esta acción.";
    case "PGRST116":
      return "No se encontró el registro.";
    default:
      if (texto.toLowerCase().includes("failed to fetch")) {
        return "No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.";
      }
      // Sin código = error propio de la app (ya escrito para el usuario).
      return !error.code && texto ? texto : fallback;
  }
}

export async function getAdminFunctionErrorMessage(
  error,
  data,
  fallback = "No se pudo completar la operación.",
) {
  let message = data?.error || "";

  if (!message && error?.context) {
    try {
      const response = error.context.clone();
      const body = await response.json();
      message = body?.error || "";
    } catch {
      message = "";
    }
  }

  const normalized = String(message || error?.message || "").toLowerCase();
  if (normalized.includes("already registered")) {
    return "Ese correo electrónico ya está registrado.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "El correo electrónico o la contraseña son incorrectos.";
  }
  if (normalized.includes("password") && normalized.includes("8")) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (normalized.includes("email") && normalized.includes("invalid")) {
    return "Ingresá un correo electrónico válido.";
  }
  if (message && !normalized.includes("non-2xx")) return message;
  return fallback;
}
