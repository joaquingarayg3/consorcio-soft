// Teléfonos: se guardan tal como los escribe la persona (con espacios, guiones
// o paréntesis) pero se exige que sean un número de verdad. La base repite
// estas reglas en sus restricciones CHECK.

const CARACTERES_PERMITIDOS = /^[0-9+()./ -]+$/;
export const TELEFONO_MAX = 30;

// Devuelve { valor } (el texto ya recortado) o { error }. Con `obligatorio`
// falso, un texto vacío es válido y da valor null.
export function validarTelefono(texto, { obligatorio = true } = {}) {
  const valor = String(texto ?? "").trim();
  if (valor === "") {
    return obligatorio
      ? { error: "Escribí un número de teléfono." }
      : { valor: null };
  }
  const digitos = valor.replace(/\D/g, "");
  if (
    valor.length > TELEFONO_MAX ||
    !CARACTERES_PERMITIDOS.test(valor) ||
    digitos.length < 6 ||
    digitos.length > 15
  ) {
    return {
      error:
        "El teléfono no es válido. Usá solo números, espacios, guiones o paréntesis (entre 6 y 15 dígitos).",
    };
  }
  return { valor };
}

// Enlace para llamar con un toque desde el celular. Se arma solo con dígitos y
// un "+" inicial, así lo que se escribió nunca puede cambiar el enlace.
export function enlaceTelefono(telefono) {
  const texto = String(telefono ?? "").trim();
  const digitos = texto.replace(/\D/g, "");
  return `tel:${texto.startsWith("+") ? "+" : ""}${digitos}`;
}
