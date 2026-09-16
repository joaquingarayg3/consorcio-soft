import { useEffect, useState } from "react";
import { useParams } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";
import ConfirmDialog from "../components/ConfirmDialog";

function obtenerPerfil(id) {
  return supabase.from("perfiles").select("*").eq("id", id).single();
}

function obtenerUnidadesAsignadas(id) {
  return supabase
    .from("unidad_usuarios")
    .select(
      "vinculo, fecha_desde, fecha_hasta, unidad_funcional(identificador, tipo, edificio(nombre))",
    )
    .eq("usuario_id", id)
    .order("fecha_desde", { ascending: false });
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

export default function AdminUsuarioDetalle() {
  const { id } = useParams();

  const [perfil, setPerfil] = useState(undefined);
  const [unidades, setUnidades] = useState(null);
  const [cargaError, setCargaError] = useState(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState("user");

  const [guardando, setGuardando] = useState(false);
  const [guardadoError, setGuardadoError] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  useEffect(() => {
    async function cargar() {
      const [{ data: perfilData, error: perfilError }, { data: unidadesData }] =
        await Promise.all([obtenerPerfil(id), obtenerUnidadesAsignadas(id)]);

      if (perfilError) {
        setCargaError(perfilError.message);
        setPerfil(null);
        return;
      }
      setPerfil(perfilData);
      setNombre(perfilData.nombre || "");
      setApellido(perfilData.apellido || "");
      setTelefono(perfilData.telefono || "");
      setRol(perfilData.rol);
      setUnidades(unidadesData || []);
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
      setGuardadoError(error.message);
      return;
    }
    setPerfil(data);
    setGuardadoOk(true);
  }

  async function handleCambiarEstado(activar) {
    setAccionPendiente(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: activar ? "reactivate" : "deactivate", userId: id },
    });
    setAccionPendiente(false);

    if (error || data?.error) {
      setGuardadoError(data?.error || error.message);
      return;
    }
    setPerfil((p) => ({ ...p, activo: activar }));
  }

  function handleClickEstado() {
    if (perfil.activo) {
      setConfirmandoBaja(true);
    } else {
      handleCambiarEstado(true);
    }
  }

  async function handleConfirmarBaja() {
    await handleCambiarEstado(false);
    setConfirmandoBaja(false);
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/admin/usuarios" />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {cargaError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
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
                <div>
                  <h1 className="text-xl font-semibold text-stone-900">
                    {perfil.nombre} {perfil.apellido}
                  </h1>
                  <p className="text-sm text-stone-500">{perfil.email}</p>
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
                Alta:{" "}
                {new Date(perfil.created_at).toLocaleDateString("es-AR")}
              </p>

              <button
                type="button"
                onClick={handleClickEstado}
                disabled={accionPendiente}
                className="mt-4 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {perfil.activo ? "Dar de baja" : "Reactivar"}
              </button>
            </div>

            <form
              onSubmit={handleGuardar}
              className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-base font-semibold text-stone-900">
                Editar datos
              </h2>

              <div className="flex gap-3">
                <div className="flex-1">
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
                <div className="flex-1">
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

              <div>
                <label htmlFor="rol" className={labelClass}>
                  Rol
                </label>
                <select
                  id="rol"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  disabled={guardando}
                  className={inputClass}
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

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

            <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900">
                Unidades asignadas
              </h2>
              {unidades?.length ? (
                <ul className="mt-3 divide-y divide-stone-100">
                  {unidades.map((u, i) => (
                    <li key={i} className="py-2 text-sm text-stone-700">
                      <span className="font-medium">
                        {u.unidad_funcional?.edificio?.nombre}
                      </span>{" "}
                      — {u.unidad_funcional?.identificador} (
                      {u.unidad_funcional?.tipo}) ·{" "}
                      <span className="text-stone-500">{u.vinculo}</span>
                      {u.fecha_hasta && (
                        <span className="text-stone-400">
                          {" "}
                          · finalizó {u.fecha_hasta}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-stone-500">
                  Sin unidades asignadas todavía.
                </p>
              )}
            </div>
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
    </div>
  );
}
