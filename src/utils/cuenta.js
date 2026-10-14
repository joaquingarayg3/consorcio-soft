// Reglas de los datos que se piden al crear una cuenta o cambiar la contraseña.
// Supabase Auth vuelve a validar todo del lado del servidor (largo de la
// contraseña, formato del correo): esto solo evita viajes inútiles y da
// mensajes claros.

export const PASSWORD_MIN = 8;
// bcrypt, que usa Supabase, ignora lo que pase de 72 bytes.
export const PASSWORD_MAX = 72;
export const NOMBRE_MAX = 80;
export const UNIDAD_MIN = 3;
export const UNIDAD_MAX = 120;

export const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarCorreo(texto) {
  return String(texto ?? "")
    .trim()
    .toLowerCase();
}

export function validarContrasena(contrasena, repeticion) {
  if (contrasena.length < PASSWORD_MIN) {
    return `La contraseña tiene que tener al menos ${PASSWORD_MIN} caracteres.`;
  }
  // El límite es en bytes: un carácter con tilde o un emoji ocupan más de uno.
  if (new TextEncoder().encode(contrasena).length > PASSWORD_MAX) {
    return `La contraseña es demasiado larga (máximo ${PASSWORD_MAX} caracteres).`;
  }
  if (repeticion !== undefined && contrasena !== repeticion) {
    return "Las contraseñas no coinciden.";
  }
  return null;
}

// Devuelve el primer problema de los datos del registro, o null si están bien.
export function validarRegistro({
  nombre,
  apellido,
  email,
  unidad,
  contrasena,
  repeticion,
}) {
  if (!nombre.trim()) return "Escribí tu nombre.";
  if (!apellido.trim()) return "Escribí tu apellido.";
  if (
    nombre.trim().length > NOMBRE_MAX ||
    apellido.trim().length > NOMBRE_MAX
  ) {
    return `El nombre y el apellido pueden tener hasta ${NOMBRE_MAX} caracteres.`;
  }
  if (!FORMATO_CORREO.test(normalizarCorreo(email))) {
    return "Ingresá un correo electrónico válido.";
  }
  if (unidad.trim().length < UNIDAD_MIN) {
    return "Contanos en qué edificio y unidad vivís, para que la administración pueda identificarte.";
  }
  if (unidad.trim().length > UNIDAD_MAX) {
    return `El edificio y la unidad pueden tener hasta ${UNIDAD_MAX} caracteres.`;
  }
  return validarContrasena(contrasena, repeticion);
}
