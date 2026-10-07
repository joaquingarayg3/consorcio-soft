import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";
import ConfirmDialog from "../components/ConfirmDialog";
import EliminarUsuarioForm from "../components/EliminarUsuarioForm";
import ModalForm from "../components/ModalForm";
import SegmentedControl from "../components/SegmentedControl";
import { useAuth } from "../contexts/auth-context/use-auth";
import {
  getAdminFunctionErrorMessage,
  mensajeDeError,
} from "../utils/supabase-errors";
import { asignacionVigente, formatearFecha } from "../utils/fechas";

function obtenerPerfil(id) {
  return supabase.from("perfiles").select("*").eq("id", id).single();
}

function obtenerUnidadesAsignadas(id) {
  return supabase
    .from("unidad_usuarios")
    .select(
      "id, vinculo, fecha_desde, fecha_hasta, unidad_funcional(id, identificador, tipo, piso, edificio_id, edificio(nombre))",
    )
    .eq("usuario_id", id)
    .order("fecha_desde", { ascending: false });
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

const ROLES = [
  {
    value: "user",
    label: "Usuario",
    activa: "bg-white text-stone-900 ring-1 ring-stone-300",
    punto: "bg-stone-400",
  },
  {
    value: "admin",
    label: "Administrador",
    activa: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    punto: "bg-amber-500",
  },
];

const VINCULOS = {
  propietario: {
    etiqueta: "Propietario",
    clase: "bg-amber-100 text-amber-800",
  },
  inquilino: { etiqueta: "Inquilino", clase: "bg-sky-100 text-sky-800" },
  ocupante: { etiqueta: "Ocupante", clase: "bg-teal-100 text-teal-800" },
  otros: { etiqueta: "Otros", clase: "bg-stone-100 text-stone-700" },
};

function vinculoDe(valor) {
  return (
    VINCULOS[valor] ?? {
      etiqueta: valor ? valor[0].toUpperCase() + valor.slice(1) : "Sin vínculo",
      clase: "bg-stone-100 text-stone-700",
    }
  );
}

const TIPOS = {
  departamento: "Departamento",
  cochera: "Cochera",
  baulera: "Baulera",
  local: "Local",
};

// Una asignación, solo para mirar: las altas y cambios se hacen desde el
// panel de cada edificio.
function FilaAsignacion({ asignacion, vigente }) {
  const unidad = asignacion.unidad_funcional;
  const edificio = unidad?.edificio?.nombre ?? "Edificio";
  const vinculo = vinculoDe(asignacion.vinculo);
  const detalle = [
    unidad?.identificador ?? "Unidad",
    TIPOS[unidad?.tipo] ?? unidad?.tipo,
    unidad?.piso ? `piso ${unidad.piso}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        vigente ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            vigente
              ? "bg-amber-100 text-amber-700"
              : "bg-stone-200 text-stone-500"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <rect x="6" y="3" width="12" height="18" rx="1" />
            <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
            <path d="M3 21h18" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-900">{edificio}</p>
          <p className="text-sm text-stone-600">{detalle}</p>
          <p className="mt-1 text-xs text-stone-500">
            Desde {formatearFecha(asignacion.fecha_desde)}
            {asignacion.fecha_hasta
              ? ` · hasta ${formatearFecha(asignacion.fecha_hasta)}`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${vinculo.clase}`}
        >
          {vinculo.etiqueta}
        </span>
        {unidad?.edificio_id && (
          <Link
            href={`/admin/edificios/${unidad.edificio_id}/unidades`}
            className="text-xs font-medium text-amber-700 hover:text-amber-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
          >
            Ver en el edificio →
          </Link>
        )}
      </div>
    </li>
  );
}

export default function AdminUsuarioDetalle() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const esMiCuenta = session?.user?.id === id;

  const [perfil, setPerfil] = useState(undefined);
  const [unidadesAsignadas, setUnidadesAsignadas] = useState(null);
  const [cargaError, setCargaError] = useState(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState("user");

  const [guardando, setGuardando] = useState(false);
  const [guardadoError, setGuardadoError] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const [accionPendiente, setAccionPendiente] = useState(false);
  const [accionError, setAccionError] = useState(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  const [eliminandoAbierto, setEliminandoAbierto] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [eliminarError, setEliminarError] = useState(null);

  useEffect(() => {
    async function cargar() {
      const [{ data: perfilData, error: perfilError }, unidades] =
        await Promise.all([obtenerPerfil(id), obtenerUnidadesAsignadas(id)]);

      if (perfilError) {
        setCargaError(mensajeDeError(perfilError));
        setPerfil(null);
        return;
      }
      setPerfil(perfilData);
      setNombre(perfilData.nombre || "");
      setApellido(perfilData.apellido || "");
      setTelefono(perfilData.telefono || "");
      setRol(perfilData.rol);
      if (unidades.error) {
        setCargaError(
          mensajeDeError(
            unidades.error,
            "No se pudieron cargar las unidades del usuario.",
          ),
        );
      }
      setUnidadesAsignadas(unidades.data || []);
    }
    cargar();
  }, [id]);

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setGuardadoError(null);
    setGuardadoOk(false);

    const { data, error } = await supabase
      .from("perfiles")
      .update({ nombre, apellido, telefono, rol })
      .eq("id", id)
      .select()
      .single();

    setGuardando(false);

    if (error) {
      setGuardadoError(mensajeDeError(error));
      return;
    }
    setPerfil(data);
    setGuardadoOk(true);
  }

  async function handleCambiarEstado(activar) {
    setAccionPendiente(true);
    setAccionError(null);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: activar ? "reactivate" : "deactivate", userId: id },
    });
    setAccionPendiente(false);

    if (error || data?.error) {
      setAccionError(
        await getAdminFunctionErrorMessage(
          error,
          data,
          "No se pudo actualizar el estado del usuario.",
        ),
      );
      return;
    }
    setPerfil((p) => ({ ...p, activo: activar }));
  }

  function handleClickEstado() {
    if (perfil?.activo) {
      setConfirmandoBaja(true);
    } else {
      handleCambiarEstado(true);
    }
  }

  async function handleConfirmarBaja() {
    await handleCambiarEstado(false);
    setConfirmandoBaja(false);
  }

  function cerrarEliminacion() {
    setEliminandoAbierto(false);
    setEliminarError(null);
  }

  async function handleEliminar() {
    setEliminando(true);
    setEliminarError(null);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete", userId: id },
    });
    setEliminando(false);

    if (error || data?.error) {
      setEliminarError(
        await getAdminFunctionErrorMessage(
          error,
          data,
          "No se pudo eliminar el usuario.",
        ),
      );
      return;
    }
    // El perfil ya no existe: se vuelve a la lista.
    navigate("/admin/usuarios");
  }

  const vigentes = (unidadesAsignadas ?? []).filter((a) =>
    asignacionVigente(a),
  );
  const historial = (unidadesAsignadas ?? []).filter(
    (a) => !asignacionVigente(a),
  );

  // Las asignaciones se gestionan en el panel de edificios. Si la persona está
  // en un único edificio, el botón lleva directo a sus unidades; si no, a la
  // lista de edificios.
  const edificiosVigentes = [
    ...new Map(
      vigentes
        .filter((a) => a.unidad_funcional?.edificio_id)
        .map((a) => [
          a.unidad_funcional.edificio_id,
          a.unidad_funcional.edificio?.nombre ?? "el edificio",
        ]),
    ),
  ];
  const unSoloEdificio = edificiosVigentes.length === 1;
  const destinoGestion = unSoloEdificio
    ? `/admin/edificios/${edificiosVigentes[0][0]}/unidades`
    : "/admin/edificios";
  const etiquetaGestion = unSoloEdificio
    ? `Gestionar en ${edificiosVigentes[0][1]}`
    : "Ir a Edificios";

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/admin/usuarios" />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {cargaError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {cargaError}
          </div>
        )}

        {perfil === null && !cargaError && (
          <p className="text-stone-500">Usuario no encontrado.</p>
        )}

        {perfil && (
          <>
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold text-stone-900">
                    {perfil.nombre} {perfil.apellido}
                  </h1>
                  <p className="break-all text-sm text-stone-500">
                    {perfil.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      perfil.rol === "admin"
                        ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        : "rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
                    }
                  >
                    {perfil.rol === "admin" ? "Administrador" : "Usuario"}
                  </span>
                  <span
                    className={
                      perfil.activo
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                        : "rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600"
                    }
                  >
                    {perfil.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-stone-400">
                Alta: {new Date(perfil.created_at).toLocaleDateString("es-AR")}
              </p>

              {esMiCuenta ? (
                <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
                  Esta es tu propia cuenta: no podés darte de baja ni
                  eliminarte.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleClickEstado}
                    disabled={accionPendiente}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {perfil.activo ? "Dar de baja" : "Reactivar"}
                  </button>
                  {!perfil.activo && (
                    <button
                      type="button"
                      onClick={() => {
                        setEliminarError(null);
                        setEliminandoAbierto(true);
                      }}
                      disabled={accionPendiente}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}

              {accionError && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {accionError}
                </div>
              )}
            </div>

            <form
              onSubmit={handleGuardar}
              className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-base font-semibold text-stone-900">
                Editar datos
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="nombre" className={labelClass}>
                    Nombre
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    disabled={guardando}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="apellido" className={labelClass}>
                    Apellido
                  </label>
                  <input
                    id="apellido"
                    type="text"
                    required
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    disabled={guardando}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="telefono" className={labelClass}>
                  Teléfono
                </label>
                <input
                  id="telefono"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  disabled={guardando}
                  className={inputClass}
                />
              </div>

              <SegmentedControl
                legend="Rol"
                value={rol}
                onChange={setRol}
                options={ROLES}
                disabled={guardando}
              />

              <button
                type="submit"
                disabled={guardando}
                className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>

              {guardadoError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {guardadoError}
                </div>
              )}
              {guardadoOk && (
                <div
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                >
                  Cambios guardados.
                </div>
              )}
            </form>

            <section
              aria-labelledby="unidades-titulo"
              className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2
                    id="unidades-titulo"
                    className="text-base font-semibold text-stone-900"
                  >
                    Unidades y edificios
                  </h2>
                  <p className="mt-0.5 text-sm text-stone-500">
                    Solo lectura. Las asignaciones se gestionan desde el panel
                    de cada edificio.
                  </p>
                </div>
                <Link
                  href={destinoGestion}
                  className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
                >
                  {etiquetaGestion} →
                </Link>
              </div>

              {unidadesAsignadas === null && (
                <p className="mt-4 text-sm text-stone-500">
                  Cargando unidades...
                </p>
              )}

              {unidadesAsignadas?.length === 0 && (
                <p className="mt-4 rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                  Esta persona no está asignada a ninguna unidad.
                </p>
              )}

              {vigentes.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">
                    Actuales ({vigentes.length})
                  </h3>
                  <ul className="space-y-2">
                    {vigentes.map((a) => (
                      <FilaAsignacion key={a.id} asignacion={a} vigente />
                    ))}
                  </ul>
                </div>
              )}

              {historial.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">
                    Historial ({historial.length})
                  </h3>
                  <ul className="space-y-2">
                    {historial.map((a) => (
                      <FilaAsignacion key={a.id} asignacion={a} />
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmandoBaja}
        title="¿Dar de baja este usuario?"
        message={
          perfil &&
          `${perfil.nombre} ${perfil.apellido} no va a poder iniciar sesión hasta que lo reactives.`
        }
        confirmLabel="Dar de baja"
        pending={accionPendiente}
        onConfirm={handleConfirmarBaja}
        onCancel={() => setConfirmandoBaja(false)}
      />

      <ModalForm
        open={eliminandoAbierto}
        onClose={cerrarEliminacion}
        busy={eliminando}
        title="Eliminar usuario"
        description="Un usuario inactivo se puede eliminar definitivamente."
      >
        {perfil && (
          <EliminarUsuarioForm
            usuario={perfil}
            eliminando={eliminando}
            error={eliminarError}
            onCancelar={cerrarEliminacion}
            onConfirmar={handleEliminar}
          />
        )}
      </ModalForm>
    </div>
  );
}
