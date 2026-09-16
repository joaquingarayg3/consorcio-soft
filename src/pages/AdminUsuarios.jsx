import { useEffect, useState } from "react";
import { Link } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";
import ConfirmDialog from "../components/ConfirmDialog";
import PopoverForm, { PopoverFormButton } from "../components/PopoverForm";

function obtenerUsuarios() {
  return supabase
    .from("perfiles")
    .select("*")
    .order("created_at", { ascending: false });
}

function generarContrasena() {
  const alfabeto =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const valores = new Uint32Array(12);
  crypto.getRandomValues(valores);
  return Array.from(valores, (v) => alfabeto[v % alfabeto.length]).join("");
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState(null);
  const [listError, setListError] = useState(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generarContrasena());
  const [rol, setRol] = useState("user");
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState(null);
  const [credencialesCreadas, setCredencialesCreadas] = useState(null);

  const [accionPendiente, setAccionPendiente] = useState(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(null);

  async function refrescarUsuarios() {
    const { data, error } = await obtenerUsuarios();
    if (error) {
      setListError(error.message);
      return;
    }
    setListError(null);
    setUsuarios(data);
  }

  useEffect(() => {
    async function cargarInicial() {
      const { data, error } = await obtenerUsuarios();
      if (error) {
        setListError(error.message);
        return;
      }
      setListError(null);
      setUsuarios(data);
    }
    cargarInicial();
  }, []);

  async function handleCrearUsuario(e) {
    e.preventDefault();
    setCreando(true);
    setFormError(null);

    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "create", email, password, nombre, apellido, rol },
    });

    setCreando(false);

    if (error || data?.error) {
      setFormError(data?.error || error.message);
      return;
    }

    setCredencialesCreadas({ email, password });
    setNombre("");
    setApellido("");
    setEmail("");
    setPassword(generarContrasena());
    setRol("user");
    setFormAbierto(false);
    refrescarUsuarios();
  }

  async function handleCambiarEstado(usuario, activar) {
    setAccionPendiente(usuario.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: activar ? "reactivate" : "deactivate",
        userId: usuario.id,
      },
    });
    setAccionPendiente(null);

    if (error || data?.error) {
      setListError(data?.error || error.message);
      return;
    }
    refrescarUsuarios();
  }

  function handleClickEstado(usuario) {
    if (usuario.activo) {
      setConfirmandoBaja(usuario);
    } else {
      handleCambiarEstado(usuario, true);
    }
  }

  async function handleConfirmarBaja() {
    if (!confirmandoBaja) return;
    await handleCambiarEstado(confirmandoBaja, false);
    setConfirmandoBaja(null);
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/home" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-stone-900">
            Gestión de usuarios
          </h1>
          <button
            type="button"
            onClick={() => {
              setFormAbierto((v) => !v);
              setCredencialesCreadas(null);
            }}
            className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 sm:w-auto sm:py-2"
          >
            {formAbierto ? "Cancelar" : "+ Nuevo usuario"}
          </button>
        </div>

        {credencialesCreadas && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">
              Usuario creado. Copiá estos datos y compartíselos por afuera de
              la app (no se van a volver a mostrar):
            </p>
            <p className="mt-1">
              Email: <span className="font-mono">{credencialesCreadas.email}</span>
            </p>
            <p>
              Contraseña temporal:{" "}
              <span className="font-mono">{credencialesCreadas.password}</span>
            </p>
          </div>
        )}

        <PopoverForm open={formAbierto} title="Nuevo usuario">
          <form onSubmit={handleCrearUsuario} className="space-y-4">
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
                  disabled={creando}
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
                  disabled={creando}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={creando}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Contraseña temporal
              </label>
              <div className="flex gap-2">
                <input
                  id="password"
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={creando}
                  className={`${inputClass} font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setPassword(generarContrasena())}
                  disabled={creando}
                  className="shrink-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
                >
                  Generar
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="rol" className={labelClass}>
                Rol
              </label>
              <select
                id="rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                disabled={creando}
                className={inputClass}
              >
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <PopoverFormButton
              loading={creando}
              label="Crear usuario"
              loadingLabel="Creando..."
            />

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {formError}
              </div>
            )}
          </form>
        </PopoverForm>

        {/* Mobile: tarjetas apiladas */}
        <div className="mt-6 space-y-3 sm:hidden">
          {usuarios?.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/admin/usuarios/${u.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-semibold text-stone-900">
                    {u.nombre} {u.apellido}
                  </p>
                  <p className="truncate text-sm text-stone-500">
                    {u.email}
                  </p>
                </Link>
                <span
                  className={
                    u.activo
                      ? "shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                      : "shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600"
                  }
                >
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                <span className="text-xs font-medium text-stone-500">
                  {u.rol === "admin" ? "Administrador" : "Usuario"}
                </span>
                <button
                  type="button"
                  onClick={() => handleClickEstado(u)}
                  disabled={accionPendiente === u.id}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {u.activo ? "Dar de baja" : "Reactivar"}
                </button>
              </div>
            </div>
          ))}
          {usuarios?.length === 0 && (
            <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-500 shadow-sm">
              Todavía no hay usuarios cargados.
            </p>
          )}
        </div>

        {/* sm+: tabla */}
        <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((u) => (
                <tr key={u.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/usuarios/${u.id}`}
                      className="font-medium text-stone-900 hover:text-amber-700 hover:underline"
                    >
                      {u.nombre} {u.apellido}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{u.email}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {u.rol === "admin" ? "Administrador" : "Usuario"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.activo
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                          : "rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600"
                      }
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleClickEstado(u)}
                      disabled={accionPendiente === u.id}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {u.activo ? "Dar de baja" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-stone-500">
                    Todavía no hay usuarios cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {listError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {listError}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={!!confirmandoBaja}
        title="¿Dar de baja este usuario?"
        message={
          confirmandoBaja &&
          `${confirmandoBaja.nombre} ${confirmandoBaja.apellido} no va a poder iniciar sesión hasta que lo reactives.`
        }
        confirmLabel="Dar de baja"
        pending={accionPendiente === confirmandoBaja?.id}
        onConfirm={handleConfirmarBaja}
        onCancel={() => setConfirmandoBaja(null)}
      />
    </div>
  );
}
