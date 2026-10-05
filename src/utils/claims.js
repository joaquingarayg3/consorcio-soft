export const CLAIMS_STORAGE_KEY = "consorcio-soft-claims-v1";

export function buildSeedClaims() {
  const now = new Date();

  return [
    {
      id: "seed-1",
      titulo: "Pérdida de agua en el pasillo del 3° piso",
      categoria: "Plomería",
      prioridad: "Media",
      unidad_funcional_id: "demo-unit-1",
      ubicacion: "Espacio común - Pasillo",
      descripcion:
        "Hay una fuga en la pared del pasillo y se está acumulando agua cerca del ascensor.",
      estado: "abierto",
      reportante_id: "demo-user",
      fecha_creacion: new Date(
        now.getTime() - 1000 * 60 * 60 * 5,
      ).toISOString(),
      fecha_cierre: null,
      cerrado_por_id: null,
      nota_admin: null,
      unidad_funcional: { id: "demo-unit-1", identificador: "3° B", piso: 3 },
      reportante: {
        nombre: "Laura",
        apellido: "García",
        email: "vecino@consorcio.com",
      },
    },
    {
      id: "seed-2",
      titulo: "Ascensor B se detiene entre el 5° y el 6° piso",
      categoria: "Ascensor",
      prioridad: "Alta",
      unidad_funcional_id: "demo-unit-2",
      ubicacion: "Ascensor B",
      descripcion:
        "El ascensor se detuvo en pleno recorrido y requiere revisión urgente por posible falla mecánica.",
      estado: "en_curso",
      reportante_id: "demo-user-2",
      fecha_creacion: new Date(
        now.getTime() - 1000 * 60 * 60 * 12,
      ).toISOString(),
      fecha_cierre: null,
      cerrado_por_id: null,
      nota_admin: null,
      unidad_funcional: { id: "demo-unit-2", identificador: "4° A", piso: 4 },
      reportante: {
        nombre: "Matthew",
        apellido: "Ruiz",
        email: "vecino2@consorcio.com",
      },
    },
  ];
}

export function getStoredClaims() {
  try {
    const raw = localStorage.getItem(CLAIMS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : buildSeedClaims();
  } catch (error) {
    console.error("Error leyendo reclamos demo", error);
    return buildSeedClaims();
  }
}

export function saveStoredClaims(claims) {
  localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims));
}
