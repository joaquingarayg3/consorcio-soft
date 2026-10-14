import supabase from "../supabase-client";
import { normalizarCorreo } from "../utils/cuenta";
import { traducirErrorAuth } from "../utils/auth-errors";

// Los enlaces de los correos vuelven a la propia app. Estas dos direcciones
// tienen que estar en la lista "Redirect URLs" de Supabase (ver README).
const direccion = (ruta) => `${window.location.origin}${ruta}`;
export const RUTA_CONFIRMAR = "/confirmar";
export const RUTA_RESTABLECER = "/restablecer";

// Todas devuelven { ok: true } o { ok: false, error: "mensaje en castellano" }.
const exito = () => ({ ok: true });
const fallo = (error) => ({ ok: false, error: traducirErrorAuth(error) });

// Crea la cuenta. Supabase manda el correo de verificación. Ojo: si el correo
// ya tiene cuenta NO devuelve error (para no revelar quién está registrado), así
// que la pantalla tiene que mostrar siempre el mismo mensaje.
//
// Los datos de `options.data` los escribe quien se registra: en la base solo se
// usan el nombre, el apellido y la unidad declarada. El rol y el estado nunca
// salen de ahí (ver migración registro_vecinos).
export async function registrarCuenta({
  nombre,
  apellido,
  email,
  unidad,
  contrasena,
  captchaToken,
}) {
  try {
    const { error } = await supabase.auth.signUp({
      email: normalizarCorreo(email),
      password: contrasena,
      options: {
        captchaToken,
        emailRedirectTo: direccion(RUTA_CONFIRMAR),
        data: {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          unidad_declarada: unidad.trim(),
        },
      },
    });
    return error ? fallo(error) : exito();
  } catch (error) {
    return fallo(error);
  }
}

export async function reenviarVerificacion(email, captchaToken) {
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizarCorreo(email),
      options: { captchaToken, emailRedirectTo: direccion(RUTA_CONFIRMAR) },
    });
    return error ? fallo(error) : exito();
  } catch (error) {
    return fallo(error);
  }
}

// Valida el enlace del correo de verificación. Si es válido, además inicia la
// sesión de la persona. El token se canjea recién cuando ella toca el botón (no
// al abrir la página): así un programa que "visita" los enlaces del correo para
// revisarlos no lo gasta antes de tiempo.
export async function confirmarCorreo(tokenHash) {
  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    return error ? fallo(error) : exito();
  } catch (error) {
    return fallo(error);
  }
}

// Manda el enlace para elegir una contraseña nueva. Igual que el registro,
// responde lo mismo exista o no el correo.
export async function pedirRecuperacion(email, captchaToken) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizarCorreo(email),
      { captchaToken, redirectTo: direccion(RUTA_RESTABLECER) },
    );
    return error ? fallo(error) : exito();
  } catch (error) {
    return fallo(error);
  }
}

export async function verificarRecuperacion(tokenHash) {
  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    return error ? fallo(error) : exito();
  } catch (error) {
    return fallo(error);
  }
}

// Guarda la contraseña nueva (hace falta la sesión que abre el enlace) y cierra
// las demás sesiones abiertas de la cuenta: si alguien más la tenía, queda afuera.
export async function guardarNuevaContrasena(contrasena) {
  try {
    const { error } = await supabase.auth.updateUser({ password: contrasena });
    if (error) return fallo(error);
    const { error: errorOtras } = await supabase.auth.signOut({
      scope: "others",
    });
    if (errorOtras) console.error("No se cerraron las otras sesiones");
    return exito();
  } catch (error) {
    return fallo(error);
  }
}
