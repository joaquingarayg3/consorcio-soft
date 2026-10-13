import { useCallback, useEffect, useState } from "react";
import {
  fetchAnunciosParaUsuario,
  marcarAnunciosLeidos,
} from "../services/anuncios";
import { mensajeDeError } from "../utils/supabase-errors";

const REFRESCO_MS = 60_000;
const VACIO = {
  anuncios: [],
  noLeidos: new Set(),
  cargado: false,
  error: null,
};

// Anuncios recientes de los edificios de la persona y cuáles no leyó. Se
// vuelve a consultar cada minuto y al volver a la pestaña, así un anuncio
// nuevo llega a la campanita sin recargar la página.
//
// Nada se marca como leído solo: la persona lo hace con "Marcar como leído"
// (uno por uno o todos). Con `conContenido` trae también el texto completo.
export function useAnunciosUsuario(
  userId,
  { conContenido = false, limite = 30 } = {},
) {
  const [estado, setEstado] = useState(VACIO);

  useEffect(() => {
    if (!userId) return undefined;
    let activo = true;

    async function cargar() {
      try {
        const resultado = await fetchAnunciosParaUsuario(userId, {
          conContenido,
          limite,
        });
        if (activo) setEstado({ ...resultado, cargado: true, error: null });
      } catch (error) {
        console.error("No se pudieron cargar los anuncios", error);
        if (activo) {
          setEstado((actual) => ({
            ...actual,
            cargado: true,
            error: mensajeDeError(error, "No se pudieron cargar los anuncios."),
          }));
        }
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
  }, [userId, conContenido, limite]);

  // Marca como leídos estos anuncios: se refleja al instante y, si la base no
  // lo guarda, vuelven a figurar como no leídos en la próxima consulta.
  const marcar = useCallback(
    async (ids) => {
      if (!userId || ids.length === 0) return;
      setEstado((actual) => {
        const noLeidos = new Set(actual.noLeidos);
        for (const id of ids) noLeidos.delete(id);
        return { ...actual, noLeidos };
      });
      try {
        await marcarAnunciosLeidos(userId, ids);
        // Avisa a las otras pantallas (campanita, portal) para que se actualicen.
        window.dispatchEvent(new Event("anuncios-leidos"));
      } catch (error) {
        console.error("No se pudo marcar como leído", error);
      }
    },
    [userId],
  );

  const marcarLeido = useCallback((anuncioId) => marcar([anuncioId]), [marcar]);
  const marcarLeidos = useCallback(
    () => marcar([...estado.noLeidos]),
    [marcar, estado.noLeidos],
  );

  return userId
    ? { ...estado, marcarLeido, marcarLeidos }
    : { ...VACIO, marcarLeido, marcarLeidos };
}
