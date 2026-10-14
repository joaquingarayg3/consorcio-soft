// Traduce los errores de Supabase Auth a mensajes para la persona que usa la
// app. Nunca se muestra el texto en inglés tal cual: si no se reconoce el
// error, va un mensaje general y el detalle queda en la consola.

const POR_CODIGO = {
  invalid_credentials: "Correo electrónico o contraseña incorrectos.",
  email_not_confirmed: "Todavía no verificaste tu correo electrónico.",
  user_banned: "Esta cuenta fue dada de baja. Contactá a la administración.",
  weak_password:
    "La contraseña es muy débil. Usá una más larga que combine mayúsculas, minúsculas y números.",
  same_password: "La nueva contraseña tiene que ser distinta de la anterior.",
  over_email_send_rate_limit:
    "Se enviaron muchos correos en poco tiempo. Esperá unos minutos e intentá de nuevo.",
  over_request_rate_limit:
    "Hiciste demasiados intentos. Esperá unos minutos e intentá de nuevo.",
  otp_expired: "El enlace venció o ya se usó. Pedí uno nuevo.",
  email_address_invalid: "Ingresá un correo electrónico válido.",
  signup_disabled: "Por ahora no se pueden crear cuentas nuevas.",
  captcha_failed: "No pudimos verificar que no sos un robot. Intentá de nuevo.",
  session_not_found: "Tu sesión venció. Volvé a iniciar sesión.",
};

// Para versiones de Supabase que todavía no mandan `code`.
const POR_TEXTO = [
  ["invalid login credentials", "invalid_credentials"],
  ["email not confirmed", "email_not_confirmed"],
  ["banned", "user_banned"],
  ["suspended", "user_banned"],
  ["rate limit", "over_email_send_rate_limit"],
  ["security purposes", "over_request_rate_limit"],
  ["expired", "otp_expired"],
  ["invalid or has expired", "otp_expired"],
  ["same as the old", "same_password"],
  ["different from the old", "same_password"],
  ["password should contain", "weak_password"],
  ["pwned", "weak_password"],
  ["weak", "weak_password"],
  ["invalid format", "email_address_invalid"],
  ["unable to validate email", "email_address_invalid"],
  ["signups not allowed", "signup_disabled"],
];

const SIN_CONEXION =
  "No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.";
const GENERAL = "Ocurrió un error inesperado. Intentá de nuevo.";

export function codigoDeErrorAuth(error) {
  if (!error) return null;
  if (typeof error.code === "string" && error.code) return error.code;
  const texto = String(error.message ?? "").toLowerCase();
  return POR_TEXTO.find(([parte]) => texto.includes(parte))?.[1] ?? null;
}

export function traducirErrorAuth(error) {
  if (!error) return GENERAL;
  const texto = String(error.message ?? "").toLowerCase();
  if (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    texto.includes("failed to fetch") ||
    texto.includes("networkerror")
  ) {
    return SIN_CONEXION;
  }
  const codigo = codigoDeErrorAuth(error);
  if (codigo && POR_CODIGO[codigo]) return POR_CODIGO[codigo];
  console.error("Error de autenticación:", error.message ?? error);
  return GENERAL;
}
