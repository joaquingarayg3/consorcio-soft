export const CLAIMS_STORAGE_KEY = "consorcio-soft-claims-v1";

export function getUserRole(email = "") {
  const normalized = email.toLowerCase();

  if (normalized.includes("admin") || normalized.includes("administrador")) {
    return "admin";
  }

  return "user";
}

export function resolveUserProfile(session = null) {
  const email = session?.user?.email || "";
  const metadata = session?.user?.user_metadata || {};
  const baseName = metadata.name || email.split("@")[0] || "Usuario";
  const normalizedName = baseName
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const name =
    normalizedName[0]?.charAt(0).toUpperCase() +
    (normalizedName[0]?.slice(1) || "Usuario");
  const surname =
    normalizedName.slice(1).join(" ") || metadata.surname || "Residente";

  return {
    email,
    name,
    surname,
    role: metadata.role || getUserRole(email),
  };
}

export function buildSeedClaims() {
  const now = new Date();

  return [
    {
      id: "seed-1",
      title: "Pérdida de agua en el pasillo del 3° piso",
      category: "Plomería",
      priority: "Media",
      unit: "3° B",
      location: "Espacio común - Pasillo",
      description:
        "Hay una fuga en la pared del pasillo y se está acumulando agua cerca del ascensor.",
      status: "abierto",
      reporterName: "Laura",
      reporterSurname: "García",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
      closedAt: null,
      closedBy: null,
      adminNote: "",
      reporterEmail: "vecino@consorcio.com",
    },
    {
      id: "seed-2",
      title: "Ascensor B se detiene entre el 5° y el 6° piso",
      category: "Ascensor",
      priority: "Alta",
      unit: "4° A",
      location: "Ascensor B",
      description:
        "El ascensor se detuvo en pleno recorrido y requiere revisión urgente por posible falla mecánica.",
      status: "en_curso",
      reporterName: "Matthew",
      reporterSurname: "Ruiz",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      closedAt: null,
      closedBy: null,
      adminNote: "",
      reporterEmail: "vecino2@consorcio.com",
    },
  ];
}

export function getStoredClaims() {
  try {
    if (typeof window === "undefined") {
      return buildSeedClaims();
    }

    const raw = localStorage.getItem(CLAIMS_STORAGE_KEY);
    if (!raw) {
      return buildSeedClaims();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return buildSeedClaims();
    }

    return parsed;
  } catch (error) {
    console.error("Error reading claims from localStorage", error);
    return buildSeedClaims();
  }
}

export function saveStoredClaims(claims) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims));
    }
  } catch (error) {
    console.error("Error saving claims to localStorage", error);
  }
}
