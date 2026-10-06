import { useCallback, useEffect, useState } from "react";
import {
  fetchAnunciosParaUsuario,
  marcarAnunciosLeidos,
} from "../services/anuncios";

const REFRESCO_MS = 60_000;
const VACIO = { anuncios: [], noLeidos: new Set() };

// Anuncios recientes de los edificios de la persona y cuáles no leyó. Se
// vuelve a consultar cada minuto y al volver a la pestaña, así un anuncio
// nuevo llega a la campanita sin recargar la página.
export function useAnunciosUsuario(userId) {
  const [estado, setEstado] = useState(VACIO);

  useEffect(() => {
    if (!userId) return undefined;
    let activo = true;

    async function cargar() {
      try {
        const resultado = await fetchAnunciosParaUsuario(userId, {
          limite: 30,
        });
        if (activo) setEstado(resultado);
      } catch (error) {
        console.error("No se pudieron cargar los anuncios", error);
      }
    }
    function alVolverALaPestania() {
      if (document.visibilityState === "visible") cargar();
    }

    cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    document.addEventListener("visibilitychange", alVolverALaPestania);
    window.addEventListener("anuncios-leidos", cargar);
    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolverALaPestania);
      window.removeEventListener("anuncios-leidos", cargar);
    };
  }, [userId]);

  const marcarLeidos = useCallback(async () => {
    if (!userId || estado.noLeidos.size === 0) return;
    const ids = [...estado.noLeidos];
    setEstado((actual) => ({ ...actual, noLeidos: new Set() }));
    try {
      await marcarAnunciosLeidos(userId, ids);
    } catch (error) {
      // Siguen sin leer en la base: vuelven a figurar en la próxima consulta.
      console.error("No se pudieron marcar los anuncios como leídos", error);
    }
  }, [estado.noLeidos, userId]);

  return userId
    ? { anuncios: estado.anuncios, noLeidos: estado.noLeidos, marcarLeidos }
    : { ...VACIO, marcarLeidos };
}
