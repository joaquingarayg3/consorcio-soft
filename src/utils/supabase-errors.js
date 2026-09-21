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
