// Número de piso para ordenar: "PB" y "planta baja" valen 0, los subsuelos son
// negativos y lo que no tiene piso (o no se entiende) va al final.
export function numeroDePiso(piso) {
  const texto = String(piso ?? "")
    .trim()
    .toLowerCase();
  if (!texto) return Number.POSITIVE_INFINITY;
  if (texto === "pb" || texto.startsWith("planta baja")) return 0;
  if (texto === "ss" || texto.startsWith("subsuelo")) return -1;
  const numero = Number.parseFloat(texto.replace(",", "."));
  return Number.isFinite(numero) ? numero : Number.POSITIVE_INFINITY;
}

// De menor a mayor piso; a igual piso, por nombre ("2A" antes que "10A").
export function compararUnidades(a, b) {
  const porPiso = numeroDePiso(a.piso) - numeroDePiso(b.piso);
  if (porPiso !== 0 && !Number.isNaN(porPiso)) return porPiso;
  return String(a.identificador).localeCompare(String(b.identificador), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

export const TIPOS_UNIDAD = {
  departamento: "Departamento",
  cochera: "Cochera",
  baulera: "Baulera",
  local: "Local",
  oficina: "Oficina",
  otro: "Otro",
};
