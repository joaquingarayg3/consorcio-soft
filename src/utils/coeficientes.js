// Los coeficientes se guardan como fracción de 1 (0,0646 = 6,46%). Se muestran
// en porcentaje, con hasta 4 decimales y sin ceros de más.
export function formatearPorcentaje(fraccion) {
  const porcentaje = Number(fraccion) * 100;
  return `${porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 4 })}%`;
}

export function sumarCoeficientes(valores) {
  return Object.values(valores ?? {}).reduce((total, v) => total + v, 0);
}
