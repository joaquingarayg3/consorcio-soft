import { useEffect, useState } from "react";

// La hora actual en milisegundos, actualizada cada tanto. Sirve para que algo
// que vence (como un aviso urgente) cambie de aspecto sin recargar.
export function useAhora(intervaloMs = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(intervalo);
  }, [intervaloMs]);

  return ahora;
}
