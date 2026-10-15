// Los coeficientes se guardan como fracción de 1 (0,0646 = 6,46%). Se muestran
// y se cargan en porcentaje, que es como los dicen los reglamentos.

// Para mostrar un total o un valor en pantallas de lectura (hasta 6 decimales,
// sin ceros de más): 0,0646 → "6,46%".
export function formatearPorcentaje(fraccion) {
  const porcentaje = Number(fraccion) * 100;
  return `${porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 6 })}%`;
}

// Para cargar un valor en un casillero: 0,0646 → "6,46". Sin separador de miles
// y con coma decimal, como se escribe.
export function fraccionAPorcentajeTexto(fraccion) {
  if (fraccion === null || fraccion === undefined || fraccion === "") return "";
  const texto = (Number(fraccion) * 100)
    .toFixed(8)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
  return texto.replace(".", ",");
}

// Lo que escribió la persona ("6,46", "6.46", "6,46 %") → fracción (0,0646), o
// null si no es un porcentaje válido. Admite hasta 8 decimales, que son los que
// caben en el valor guardado (10 decimales de fracción).
export function porcentajeAFraccion(texto) {
  const limpio = String(texto ?? "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,8})?$/.test(limpio)) return null;
  // toFixed(10) quita el ruido de la coma flotante (6,46 / 100 = 0,06460000000000001).
  return Number((Number(limpio) / 100).toFixed(10));
}

export function sumarCoeficientes(valores) {
  return Object.values(valores ?? {}).reduce((total, v) => total + v, 0);
}

// Para comparar nombres de unidad sin importar tildes, mayúsculas ni espacios.
export function normalizarNombre(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Texto pegado desde Excel: una unidad por línea y, opcionalmente, su valor en
// la segunda columna. Las columnas pueden venir separadas por tabulación (lo que
// da Excel al copiar), punto y coma o dos o más espacios.
export function parsearPegado(texto) {
  return String(texto ?? "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const partes = linea
        .split(/\t|;|\s{2,}/)
        .map((parte) => parte.trim())
        .filter(Boolean);
      return { nombre: partes[0] ?? "", valor: partes[1] ?? "" };
    });
}

export const METODOS = {
  manual: "Manual",
  derivado: "Derivado",
  partes_iguales: "Partes iguales",
};

// Dónde está un esquema respecto de hoy: vigente, futuro o anterior.
export function situacionVigencia(esquema, fecha) {
  if (esquema.vigente_desde > fecha) return "futuro";
  if (esquema.vigente_hasta && esquema.vigente_hasta <= fecha)
    return "anterior";
  return "vigente";
}

// ¿La suma cierra en 1 dentro de la tolerancia del esquema?
export function sumaCierra(suma, tolerancia) {
  return Math.abs(suma - 1) <= Number(tolerancia);
}
