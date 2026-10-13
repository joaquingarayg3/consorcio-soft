import { useEffect, useState } from "react";
import { fetchUrlsFotos } from "../services/fotosEdificio";

const RENOVAR_MS = 40 * 60 * 1000;

// { ruta: enlace } de las fotos pedidas. Los enlaces vencen a la hora; se
// renuevan solos para pantallas que quedan abiertas mucho tiempo. Si no se
// pueden obtener, las fotos simplemente no aparecen.
export function useUrlsFotos(rutas) {
  const clave = [...new Set(rutas.filter(Boolean))].sort().join("|");
  const [urls, setUrls] = useState({});

  useEffect(() => {
    if (!clave) return undefined;
    let activo = true;

    async function cargar() {
      try {
        const resultado = await fetchUrlsFotos(clave.split("|"));
        if (activo) setUrls(resultado);
      } catch (error) {
        console.error("No se pudieron cargar las fotos", error);
      }
    }

    cargar();
    const intervalo = setInterval(cargar, RENOVAR_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [clave]);

  return urls;
}
