import { useEffect, useState } from "react";
import { contarPendientes } from "../services/usuarios";

// Cuántas personas se registraron y esperan que la administración apruebe su
// acceso. Devuelve null mientras se cuenta (o si no corresponde contarlas).
export function useSolicitudesPendientes(habilitado) {
  const [cantidad, setCantidad] = useState(null);

  useEffect(() => {
    if (!habilitado) return;
    let vigente = true;
    contarPendientes()
      .then((n) => {
        if (vigente) setCantidad(n);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [habilitado]);

  return habilitado ? cantidad : null;
}
