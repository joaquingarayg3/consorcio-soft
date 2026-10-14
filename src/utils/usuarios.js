// Estados de una cuenta, según lo que guarda el perfil:
//   pendiente = se registró, verificó su correo y todavía no la aprobó la
//               administración (activo false, aprobado_en vacío)
//   activo    = puede usar la plataforma
//   baja      = la administración la dio de baja después de aprobarla
//               (activo false, aprobado_en con fecha)
export function estadoPerfil(perfil) {
  if (perfil?.activo !== false) return "activo";
  return perfil.aprobado_en ? "baja" : "pendiente";
}

export const ESTADOS_PERFIL = {
  activo: { etiqueta: "Activo", clase: "bg-green-100 text-green-700" },
  pendiente: { etiqueta: "Pendiente", clase: "bg-amber-100 text-amber-800" },
  baja: { etiqueta: "De baja", clase: "bg-stone-200 text-stone-600" },
};
