// Minúsculas y sin tildes, para buscar "peru" y encontrar "Perú".
export function normalizarTexto(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Todas las palabras de la búsqueda tienen que aparecer en alguno de los
// campos, en cualquier orden: "plaza 123" encuentra "Hotel Plaza, Av. Siempre 123".
export function coincideBusqueda(campos, busqueda) {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const texto = normalizarTexto(campos.filter(Boolean).join(" "));
  return palabras.every((palabra) => texto.includes(palabra));
}
