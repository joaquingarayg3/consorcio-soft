// Un anuncio es urgente hasta `urgente_hasta`; sin fecha, o vencida, es un
// anuncio común. `ahora` viene de useAhora para que el cambio se vea solo, sin
// recargar la página.
export function esUrgente(anuncio, ahora) {
  if (!anuncio?.urgente_hasta) return false;
  return new Date(anuncio.urgente_hasta).getTime() > ahora;
}

// --- Formulario de urgencia (administración) ---

export const DURACIONES_URGENTE = [
  { value: "24h", label: "24 horas", horas: 24 },
  { value: "48h", label: "48 horas", horas: 48 },
  { value: "7d", label: "7 días", horas: 24 * 7 },
  { value: "fecha", label: "Otra fecha", horas: null },
];

export const URGENCIA_VACIA = { activa: false, duracion: "24h", fecha: "" };

const dos = (n) => String(n).padStart(2, "0");

// Fecha para <input type="datetime-local">: "2026-10-13T14:30", en hora local.
export function aValorLocal(fecha) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// Estado inicial del formulario al editar: solo cuenta como urgente si todavía
// no venció; uno vencido se edita como un anuncio común.
export function urgenciaDesdeAnuncio(anuncio, ahora) {
  if (!esUrgente(anuncio, ahora)) return URGENCIA_VACIA;
  return {
    activa: true,
    duracion: "fecha",
    fecha: aValorLocal(anuncio.urgente_hasta),
  };
}

// Convierte lo que eligió la persona en la fecha de vencimiento (ISO) o null si
// no es urgente. La fecha solo existe si el anuncio es urgente.
export function urgenteHastaDesdeCampo(urgencia, ahora) {
  if (!urgencia.activa) return { valor: null, error: null };

  const duracion = DURACIONES_URGENTE.find(
    (d) => d.value === urgencia.duracion,
  );
  if (duracion?.horas) {
    return {
      valor: new Date(ahora + duracion.horas * 3_600_000).toISOString(),
      error: null,
    };
  }

  const elegida = new Date(urgencia.fecha);
  if (!urgencia.fecha || Number.isNaN(elegida.getTime())) {
    return { valor: null, error: "Elegí hasta cuándo es urgente." };
  }
  if (elegida.getTime() <= ahora) {
    return {
      valor: null,
      error: "La fecha de vencimiento tiene que ser futura.",
    };
  }
  return { valor: elegida.toISOString(), error: null };
}
