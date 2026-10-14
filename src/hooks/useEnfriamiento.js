import { useCallback, useEffect, useState } from "react";

// Cuenta regresiva en segundos para frenar el reenvío de correos: el botón
// queda deshabilitado hasta que llega a cero. Devuelve [restante, iniciar].
export function useEnfriamiento(segundos = 60) {
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    if (restante <= 0) return;
    const espera = setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => clearTimeout(espera);
  }, [restante]);

  const iniciar = useCallback(() => setRestante(segundos), [segundos]);
  return [restante, iniciar];
}
