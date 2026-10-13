// Código del edificio y número de ticket de los reclamos.
//
// Cada edificio tiene un código corto y único (ej. HP) y numera sus reclamos
// por su cuenta. El ticket es CODIGO-0000: HP-0012 es el reclamo 12 de Hotel
// Plaza. La base asigna el número al crear el reclamo.

export const CODIGO_EDIFICIO = /^[A-Z0-9]{2,5}$/;

// Mayúsculas, sin tildes ni símbolos, hasta 5 caracteres.
export function normalizarCodigo(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

const PALABRAS_VACIAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y"]);

// Misma regla que la base: iniciales de hasta 3 palabras ("Hotel Plaza" -> HP)
// o las 3 primeras letras si es una sola. La base además evita repetidos.
export function sugerirCodigoEdificio(nombre) {
  const palabras = String(nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((palabra) => palabra && !PALABRAS_VACIAS.has(palabra));

  let base = "ED";
  if (palabras.length >= 2) {
    base = palabras
      .slice(0, 3)
      .map((palabra) => palabra[0])
      .join("");
  } else if (palabras.length === 1) {
    base = palabras[0].slice(0, 3);
  }
  return base.length < 2 ? base.padEnd(2, "X") : base;
}

export function formatearTicket(codigo, numero) {
  if (!codigo || numero === null || numero === undefined) return null;
  return `${codigo}-${String(numero).padStart(4, "0")}`;
}

// "HP-0012". Si el reclamo no tiene número (no tenía unidad), un código corto
// de su id para poder nombrarlo igual.
export function etiquetaReclamo(reclamo) {
  const edificio = reclamo?.unidad_funcional?.edificio;
  return (
    formatearTicket(edificio?.codigo, reclamo?.numero) ??
    `R-${String(reclamo?.id ?? "").slice(0, 8)}`
  );
}
