import { ESTADOS_PERFIL, estadoPerfil } from "../utils/usuarios";

// Etiqueta con el estado de una cuenta: Activo, Pendiente o De baja.
export default function EstadoUsuario({ perfil, className = "" }) {
  const estado = ESTADOS_PERFIL[estadoPerfil(perfil)];
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase} ${className}`}
    >
      {estado.etiqueta}
    </span>
  );
}
