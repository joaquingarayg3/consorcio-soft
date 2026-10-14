import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";
import ConfirmDialog from "../components/ConfirmDialog";
import EliminarUsuarioForm from "../components/EliminarUsuarioForm";
import EstadoUsuario from "../components/EstadoUsuario";
import ModalForm, { ModalFormButton } from "../components/ModalForm";
import {
  buscarPerfiles,
  contarPendientes,
  USUARIOS_POR_PAGINA,
} from "../services/usuarios";
import { estadoPerfil } from "../utils/usuarios";
import {
  getAdminFunctionErrorMessage,
  mensajeDeError,
} from "../utils/supabase-errors";

const CLAVE_BUSQUEDA = "usuarios-busqueda";

function leerBusquedaGuardada() {
  try {
    return sessionStorage.getItem(CLAVE_BUSQUEDA) ?? "";
  } catch {
    return "";
  }
}

function Filtro({ etiqueta, children }) {
  return (
    <div role="group" aria-label={etiqueta}>
      <p className="mb-1.5 px-1 text-center text-xs font-medium tracking-wide text-stone-500 uppercase">
        {etiqueta}
      </p>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

function Chip({ activo, onClick, contador, children }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 ${
        activo
          ? "border-amber-300 bg-amber-100 text-amber-900"
          : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
      }`}
    >
      {children}
      {contador > 0 && (
        <span className="ml-1.5 inline-block min-w-5 rounded-full bg-brand-700 px-1.5 text-center text-xs font-semibold text-white">
          {contador}
        </span>
      )}
    </button>
  );
}

// Botones de una fila de la lista, según el estado de la cuenta:
//   pendiente → Aprobar / Rechazar     activo → Dar de baja
//   de baja   → Reactivar / Eliminar
function AccionesUsuario({ usuario, ocupado, onCambiarEstado, onEliminar }) {
  const estado = estadoPerfil(usuario);
  // pointer-events-auto: la fila entera es un enlace y sus botones tienen que
  // recibir el toque ellos mismos, no el enlace que está detrás.
  const secundario =
    "pointer-events-auto rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50";
  const peligro =
    "pointer-events-auto rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex gap-2">
      {estado !== "activo" && (
        <button
          type="button"
          onClick={() => onEliminar(usuario)}
          disabled={ocupado}
          className={peligro}
        >
          {estado === "pendiente" ? "Rechazar" : "Eliminar"}
        </button>
      )}
      <button
        type="button"
        onClick={() => onCambiarEstado(usuario)}
        disabled={ocupado}
        className={
          estado === "pendiente"
            ? "pointer-events-auto rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
            : secundario
        }
      >
        {estado === "activo"
          ? "Dar de baja"
          : estado === "pendiente"
            ? "Aprobar"
            : "Reactivar"}
      </button>
    </div>
  );
}

// Las columnas de escritorio se comparten entre el encabezado y las filas.
const COLUMNAS =
  "lg:grid-cols-[2.75rem_minmax(0,1fr)_8rem_6.5rem_13rem_1.25rem]";

const inicial = (texto) =>
  String(texto ?? "")
    .trim()
    .charAt(0)
    .toUpperCase();

function FilasCargando() {
  return (
    <ul aria-hidden="true" className="divide-y divide-stone-100">
      {[0, 1, 2, 3, 4].map((n) => (
        <li key={n} className="flex items-center gap-4 px-4 py-3.5 lg:px-5">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-stone-100 motion-reduce:animate-none" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-stone-100 motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100 motion-reduce:animate-none" />
          </div>
        </li>
      ))}
    </ul>
  );
}

const flecha = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

// Toda la fila lleva al perfil. El enlace del nombre se extiende sobre la fila
// entera (el ::after) y los botones de acción quedan por encima, así no hay
// botones dentro de un enlace y el teclado y los lectores de pantalla ven un
// único enlace por persona.
function FilaUsuario({ usuario, ocupado, onCambiarEstado, onEliminar }) {
  const nombreCompleto =
    `${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim() || "Sin nombre";
  const rol = usuario.rol === "admin" ? "Administrador" : "Usuario";

  return (
    <li className="group relative transition-colors hover:bg-amber-50/70 has-[a:focus-visible]:bg-amber-50/70 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-600/50 has-[a:focus-visible]:ring-inset">
      <div
        className={`px-4 py-3.5 lg:grid lg:items-center lg:gap-4 lg:px-5 ${COLUMNAS}`}
      >
        <div className="flex items-center gap-3 lg:contents">
          <div
            aria-hidden="true"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              usuario.rol === "admin"
                ? "bg-brand-700 text-white"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {inicial(usuario.nombre)}
            {inicial(usuario.apellido)}
          </div>

          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/usuarios/${usuario.id}`}
              className="block truncate font-semibold text-stone-900 outline-none after:absolute after:inset-0 after:content-['']"
            >
              {nombreCompleto}
            </Link>
            <p className="truncate text-sm text-stone-500">{usuario.email}</p>
            {usuario.unidad_declarada &&
              estadoPerfil(usuario) === "pendiente" && (
                <p className="mt-0.5 truncate text-xs text-stone-600">
                  Dice vivir en: {usuario.unidad_declarada}
                </p>
              )}
          </div>

          <EstadoUsuario perfil={usuario} className="lg:hidden" />
          <span className="lg:hidden">{flecha}</span>
        </div>

        <span
          className={`hidden text-sm lg:block ${
            usuario.rol === "admin"
              ? "font-medium text-brand-700"
              : "text-stone-600"
          }`}
        >
          {rol}
        </span>
        <span className="hidden lg:block">
          <EstadoUsuario perfil={usuario} />
        </span>

        <div className="pointer-events-none relative z-10 mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 lg:mt-0 lg:justify-end lg:border-0 lg:pt-0">
          <span
            className={`text-xs font-medium lg:hidden ${
              usuario.rol === "admin" ? "text-brand-700" : "text-stone-500"
            }`}
          >
            {rol}
          </span>
          <AccionesUsuario
            usuario={usuario}
            ocupado={ocupado}
            onCambiarEstado={onCambiarEstado}
            onEliminar={onEliminar}
          />
        </div>

        <span className="hidden lg:block">{flecha}</span>
      </div>
    </li>
  );
}

// Mismos límites que valida la Edge Function admin-users.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

function generarContrasena() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const valores = new Uint32Array(12);
  crypto.getRandomValues(valores);
  return Array.from(valores, (v) => alfabeto[v % alfabeto.length]).join("");
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

export default function AdminUsuarios() {
  const [resultado, setResultado] = useState(null);
  const [listError, setListError] = useState(null);

  const [busqueda, setBusqueda] = useState(leerBusquedaGuardada);
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [rolFiltro, setRolFiltro] = useState("todos");
  const [paginas, setPaginas] = useState(1);
  const [recarga, setRecarga] = useState(0);

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generarContrasena());
  const passwordRef = useRef(null);
  const [rol, setRol] = useState("user");
  const [vinculo, setVinculo] = useState("propietario");
  const [edificioId, setEdificioId] = useState("");
  const [unidadId, setUnidadId] = useState("");
  const [edificios, setEdificios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [cargandoEdificios, setCargandoEdificios] = useState(false);
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState(null);
  const [credencialesCreadas, setCredencialesCreadas] = useState(null);

  const [accionPendiente, setAccionPendiente] = useState(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(null);
  const [pendientes, setPendientes] = useState(null);
  const [personaAprobada, setPersonaAprobada] = useState(null);

  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [eliminarError, setEliminarError] = useState(null);
  const [usuarioEliminado, setUsuarioEliminado] = useState(null);

  useEffect(() => {
    async function cargarEdificios() {
      setCargandoEdificios(true);
      const { data, error } = await supabase
        .from("edificio")
        .select("id, nombre")
        .order("nombre");
      setCargandoEdificios(false);
      if (error) {
        setEdificios([]);
        return;
      }
      setEdificios(data ?? []);
    }
    cargarEdificios();
  }, []);

  useEffect(() => {
    async function cargarUnidades() {
      if (!edificioId) {
        setUnidades([]);
        setUnidadId("");
        return;
      }

      const { data, error } = await supabase
        .from("unidad_funcional")
        .select("id, identificador, piso, tipo")
        .eq("edificio_id", edificioId)
        .order("identificador");

      if (error) {
        setUnidades([]);
        setUnidadId("");
        return;
      }

      setUnidades(data ?? []);
      setUnidadId("");
    }

    cargarUnidades();
  }, [edificioId]);

  // Cuántas solicitudes esperan aprobación: se vuelve a contar tras cada cambio.
  useEffect(() => {
    let vigente = true;
    contarPendientes()
      .then((cantidad) => {
        if (vigente) setPendientes(cantidad);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const textoBuscado = busqueda.trim();
  // Identifica la consulta en curso: mientras el resultado guardado no sea el de
  // esta clave, se está buscando.
  const clave = JSON.stringify([
    textoBuscado,
    estadoFiltro,
    rolFiltro,
    paginas,
    recarga,
  ]);

  useEffect(() => {
    let activo = true;
    const espera = setTimeout(
      async () => {
        try {
          const { usuarios, total } = await buscarPerfiles({
            texto: textoBuscado,
            estado: estadoFiltro,
            rol: rolFiltro,
            // Sin búsqueda, lo último que se dio de alta va primero.
            orden: textoBuscado ? "alfabetico" : "recientes",
            limite: USUARIOS_POR_PAGINA * paginas,
          });
          if (!activo) return;
          setListError(null);
          setResultado({ clave, usuarios, total });
        } catch (error) {
          if (!activo) return;
          setListError(mensajeDeError(error));
          // Se deja lo último que se vio, marcado como actual para no quedar
          // "buscando" para siempre.
          setResultado((actual) => ({
            clave,
            usuarios: actual?.usuarios ?? [],
            total: actual?.total ?? 0,
          }));
        }
      },
      textoBuscado ? 250 : 0,
    );
    return () => {
      activo = false;
      clearTimeout(espera);
    };
  }, [clave, textoBuscado, estadoFiltro, rolFiltro, paginas]);

  // La búsqueda se recuerda mientras dure la pestaña: al volver del perfil de
  // alguien se sigue con la misma lista.
  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_BUSQUEDA, busqueda);
    } catch {
      // sin almacenamiento: la búsqueda simplemente no se recuerda
    }
  }, [busqueda]);

  const usuarios = resultado?.usuarios ?? null;
  const total = resultado?.total ?? 0;
  const buscando = resultado?.clave !== clave;
  const filtrando =
    textoBuscado !== "" || estadoFiltro !== "todos" || rolFiltro !== "todos";
  const hayMas = usuarios !== null && usuarios.length < total;

  function cambiarBusqueda(valor) {
    setBusqueda(valor);
    setPaginas(1);
  }
  function cambiarEstado(valor) {
    setEstadoFiltro(valor);
    setPaginas(1);
  }
  function cambiarRol(valor) {
    setRolFiltro(valor);
    setPaginas(1);
  }
  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todos");
    setRolFiltro("todos");
    setPaginas(1);
  }
  function recargar() {
    setRecarga((n) => n + 1);
  }

  const passwordCorta = password.length > 0 && password.length < PASSWORD_MIN;

  function escribirPropiaContrasena() {
    setPassword("");
    passwordRef.current?.focus();
  }

  async function handleCrearUsuario(e) {
    e.preventDefault();
    setCreando(true);
    setFormError(null);

    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "create",
        email,
        password,
        nombre,
        apellido,
        rol,
        // La asignación a una unidad es opcional; sin unidad no hay vínculo.
        ...(unidadId ? { unidad_id: unidadId, vinculo } : {}),
      },
    });

    setCreando(false);

    if (error || data?.error) {
      setFormError(
        await getAdminFunctionErrorMessage(
          error,
          data,
          "No se pudo crear el usuario. Revisá los datos e intentá nuevamente.",
        ),
      );
      return;
    }

    setCredencialesCreadas({ email, password });
    setNombre("");
    setApellido("");
    setEmail("");
    setPassword(generarContrasena());
    setRol("user");
    setVinculo("propietario");
    setEdificioId("");
    setUnidadId("");
    setUnidades([]);
    setFormAbierto(false);
    // Sin filtros, para que el usuario recién creado se vea al principio.
    limpiarFiltros();
    recargar();
  }

  async function handleCambiarEstado(usuario, activar) {
    setAccionPendiente(usuario.id);
    setPersonaAprobada(null);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: activar ? "reactivate" : "deactivate",
        userId: usuario.id,
      },
    });
    setAccionPendiente(null);

    if (error || data?.error) {
      setListError(
        await getAdminFunctionErrorMessage(
          error,
          data,
          "No se pudo actualizar el estado del usuario.",
        ),
      );
      return;
    }
    if (activar && estadoPerfil(usuario) === "pendiente") {
      setPersonaAprobada(
        `${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim() ||
          usuario.email,
      );
    }
    recargar();
  }

  function empezarEliminacion(usuario) {
    setAEliminar(usuario);
    setEliminarError(null);
    setUsuarioEliminado(null);
  }

  function cerrarEliminacion() {
    setAEliminar(null);
    setEliminarError(null);
  }

  async function handleEliminarUsuario() {
    const usuarioId = aEliminar?.id;
    if (!usuarioId) return;
    const nombreCompleto =
      `${aEliminar?.nombre ?? ""} ${aEliminar?.apellido ?? ""}`.trim() ||
      aEliminar?.email;

    setEliminando(true);
    setEliminarError(null);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete", userId: usuarioId },
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

    setUsuarioEliminado(nombreCompleto);
    setAEliminar(null);
    recargar();
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
              setFormAbierto(true);
              setCredencialesCreadas(null);
            }}
            className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 sm:w-auto sm:py-2"
          >
            + Crear usuario manualmente
          </button>
        </div>

        {personaAprobada && (
          <div
            role="status"
            className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
          >
            <p>
              <span className="font-medium">{personaAprobada}</span> ya puede
              ingresar. Para que vea algo, asignale su unidad desde el edificio
              correspondiente.{" "}
              <Link
                href="/admin/edificios"
                className="font-semibold text-green-800 underline hover:text-green-900"
              >
                Ir a Edificios
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setPersonaAprobada(null)}
              aria-label="Cerrar aviso"
              className="-my-1 shrink-0 rounded px-1.5 text-lg leading-none text-green-700 hover:bg-green-100"
            >
              ×
            </button>
          </div>
        )}

        {pendientes > 0 && estadoFiltro !== "pendientes" && (
          <div
            role="status"
            className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              <span className="font-semibold">
                {pendientes === 1
                  ? "1 persona espera"
                  : `${pendientes} personas esperan`}
              </span>{" "}
              que apruebes su acceso.
            </p>
            <button
              type="button"
              onClick={() => cambiarEstado("pendientes")}
              className="shrink-0 rounded-lg bg-amber-500 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
            >
              Ver solicitudes
            </button>
          </div>
        )}

        {usuarioEliminado && (
          <div
            role="status"
            className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
          >
            <p>
              <span className="font-medium">{usuarioEliminado}</span> fue
              eliminado/a definitivamente.
            </p>
            <button
              type="button"
              onClick={() => setUsuarioEliminado(null)}
              aria-label="Cerrar aviso"
              className="-my-1 shrink-0 rounded px-1.5 text-lg leading-none text-green-700 hover:bg-green-100"
            >
              ×
            </button>
          </div>
        )}

        {credencialesCreadas && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">
              Usuario creado. Copiá estos datos y compartíselos por afuera de la
              app (no se van a volver a mostrar):
            </p>
            <p className="mt-1">
              Email:{" "}
              <span className="font-mono">{credencialesCreadas.email}</span>
            </p>
            <p>
              Contraseña temporal:{" "}
              <span className="font-mono">{credencialesCreadas.password}</span>
            </p>
          </div>
        )}

        <ModalForm
          open={formAbierto}
          onClose={() => {
            setFormAbierto(false);
            setFormError(null);
          }}
          busy={creando}
          title="Nuevo usuario"
          description="Para cuentas que crea la administración (por ejemplo, otro administrador). Los vecinos se registran solos y acá solo se aprueban."
        >
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
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-stone-700"
                >
                  Contraseña temporal
                </label>
                <div className="flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPassword(generarContrasena())}
                    disabled={creando}
                    className="text-brand-700 hover:text-brand-800 hover:underline disabled:opacity-50"
                  >
                    Generar otra
                  </button>
                  <button
                    type="button"
                    onClick={escribirPropiaContrasena}
                    disabled={creando}
                    className="text-brand-700 hover:text-brand-800 hover:underline disabled:opacity-50"
                  >
                    Escribir la mía
                  </button>
                </div>
              </div>
              <input
                ref={passwordRef}
                id="password"
                type="text"
                required
                minLength={PASSWORD_MIN}
                maxLength={PASSWORD_MAX}
                autoComplete="new-password"
                spellCheck={false}
                aria-describedby="password-ayuda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={creando}
                className={`${inputClass} font-mono`}
              />
              <p
                id="password-ayuda"
                className={`mt-1 text-xs ${passwordCorta ? "text-red-600" : "text-stone-500"}`}
              >
                {passwordCorta
                  ? `Mínimo ${PASSWORD_MIN} caracteres (faltan ${PASSWORD_MIN - password.length}).`
                  : `Podés usar la sugerida o escribir la tuya (${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres).`}
              </p>
            </div>

            <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
              <legend className="px-1 text-sm font-semibold text-stone-700">
                Asignación de unidad{" "}
                <span className="font-normal text-stone-400">(opcional)</span>
              </legend>
              <p className="text-xs text-stone-500">
                Podés dejarla vacía y asignar la unidad más tarde, desde la
                pestaña Unidades del edificio. El vínculo se habilita al elegir
                una unidad.
              </p>
              <div>
                <label htmlFor="edificio" className={labelClass}>
                  Edificio
                </label>
                <select
                  id="edificio"
                  value={edificioId}
                  onChange={(e) => setEdificioId(e.target.value)}
                  disabled={creando || cargandoEdificios}
                  className={inputClass}
                >
                  <option value="">Sin edificio asignado</option>
                  {edificios.map((edificio) => (
                    <option key={edificio.id} value={edificio.id}>
                      {edificio.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="unidad" className={labelClass}>
                  Unidad
                </label>
                <select
                  id="unidad"
                  value={unidadId}
                  onChange={(e) => setUnidadId(e.target.value)}
                  disabled={creando || !edificioId || unidades.length === 0}
                  className={inputClass}
                >
                  <option value="">
                    {edificioId
                      ? "Seleccionar unidad"
                      : "Elegí un edificio primero"}
                  </option>
                  {unidades.map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>
                      {unidad.identificador}
                      {unidad.piso ? ` · Piso ${unidad.piso}` : ""}{" "}
                      {unidad.tipo ? `(${unidad.tipo})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="vinculo" className={labelClass}>
                  Vínculo con la unidad
                </label>
                <select
                  id="vinculo"
                  value={vinculo}
                  onChange={(e) => setVinculo(e.target.value)}
                  disabled={creando || !unidadId}
                  className={inputClass}
                >
                  <option value="propietario">Propietario</option>
                  <option value="inquilino">Inquilino</option>
                  <option value="ocupante">Ocupante</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
            </fieldset>

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

            <ModalFormButton
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
        </ModalForm>

        <div role="search" className="mt-6 space-y-4">
          <div className="relative">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Buscar usuario"
              placeholder="Buscar por nombre, apellido o email"
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cambiarBusqueda("");
              }}
              className={`${inputClass} pr-11 pl-10`}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => cambiarBusqueda("")}
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center sm:gap-10">
            <Filtro etiqueta="Estado">
              <Chip
                activo={estadoFiltro === "todos"}
                onClick={() => cambiarEstado("todos")}
              >
                Todos
              </Chip>
              <Chip
                activo={estadoFiltro === "pendientes"}
                onClick={() => cambiarEstado("pendientes")}
                contador={pendientes}
              >
                Pendientes
              </Chip>
              <Chip
                activo={estadoFiltro === "activos"}
                onClick={() => cambiarEstado("activos")}
              >
                Activos
              </Chip>
              <Chip
                activo={estadoFiltro === "inactivos"}
                onClick={() => cambiarEstado("inactivos")}
              >
                De baja
              </Chip>
            </Filtro>
            <Filtro etiqueta="Rol">
              <Chip
                activo={rolFiltro === "todos"}
                onClick={() => cambiarRol("todos")}
              >
                Todos
              </Chip>
              <Chip
                activo={rolFiltro === "admin"}
                onClick={() => cambiarRol("admin")}
              >
                Administradores
              </Chip>
              <Chip
                activo={rolFiltro === "user"}
                onClick={() => cambiarRol("user")}
              >
                Usuarios
              </Chip>
            </Filtro>
          </div>
        </div>

        {usuarios !== null && total > 0 && (
          <p aria-live="polite" className="mt-4 px-1 text-sm text-stone-500">
            {hayMas
              ? `${usuarios.length.toLocaleString("es-AR")} de ${total.toLocaleString("es-AR")} usuarios`
              : filtrando
                ? `${total.toLocaleString("es-AR")} ${total === 1 ? "resultado" : "resultados"}`
                : `${total.toLocaleString("es-AR")} ${total === 1 ? "usuario" : "usuarios"}`}
          </p>
        )}

        {usuarios?.length === 0 && !buscando && (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white px-4 py-10 text-center shadow-sm">
            {filtrando ? (
              <>
                <p className="font-medium text-stone-800">
                  {textoBuscado
                    ? `No encontramos usuarios para «${textoBuscado}»`
                    : "No hay usuarios con esos filtros"}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Probá con otra palabra o cambiá los filtros.
                </p>
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
                >
                  Ver todos los usuarios
                </button>
              </>
            ) : (
              <p className="text-sm text-stone-500">
                Todavía no hay usuarios. Los vecinos se registran solos desde la
                pantalla de inicio de sesión y acá aparecen para que apruebes su
                acceso.
              </p>
            )}
          </div>
        )}

        <div
          aria-busy={buscando}
          className={`transition-opacity ${buscando && usuarios ? "opacity-60" : ""}`}
        >
          {usuarios === null && !listError && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <FilasCargando />
            </div>
          )}

          {usuarios?.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div
                aria-hidden="true"
                className={`hidden border-b border-stone-200 bg-stone-50 px-5 py-2.5 text-xs font-medium tracking-wide text-stone-500 uppercase lg:grid lg:gap-4 ${COLUMNAS}`}
              >
                <span />
                <span>Usuario</span>
                <span>Rol</span>
                <span>Estado</span>
                <span className="text-right">Acciones</span>
                <span />
              </div>
              <ul className="divide-y divide-stone-100">
                {usuarios.map((u) => (
                  <FilaUsuario
                    key={u.id}
                    usuario={u}
                    ocupado={accionPendiente === u.id}
                    onCambiarEstado={handleClickEstado}
                    onEliminar={empezarEliminacion}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        {hayMas && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={buscando}
              onClick={() => setPaginas((n) => n + 1)}
              className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cargar más usuarios (
              {(total - usuarios.length).toLocaleString("es-AR")} restantes)
            </button>
          </div>
        )}

        {listError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {listError}
          </div>
        )}
      </main>

      <ModalForm
        open={!!aEliminar}
        onClose={cerrarEliminacion}
        busy={eliminando}
        title={
          aEliminar && estadoPerfil(aEliminar) === "pendiente"
            ? "Rechazar solicitud"
            : "Eliminar usuario"
        }
        description={
          aEliminar && estadoPerfil(aEliminar) === "pendiente"
            ? "Se elimina la cuenta de quien todavía no fue aprobado."
            : "Un usuario inactivo se puede eliminar definitivamente."
        }
      >
        {aEliminar && (
          <EliminarUsuarioForm
            usuario={aEliminar}
            rechazo={estadoPerfil(aEliminar) === "pendiente"}
            eliminando={eliminando}
            error={eliminarError}
            onCancelar={cerrarEliminacion}
            onConfirmar={handleEliminarUsuario}
          />
        )}
      </ModalForm>

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
