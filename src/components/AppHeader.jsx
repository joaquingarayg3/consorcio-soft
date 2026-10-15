import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import InfoUtil from "./InfoUtil";
import { FranjaMarca, Isotipo } from "./Marca";
import { NOMBRE_MARCA, SIGLAS } from "../utils/marca";
import supabase from "../supabase-client";
import { useAuth } from "../contexts/auth-context/use-auth";
import {
  clearNotificationHistory,
  clearUserNotifications,
  fetchClaimsForUser,
  fetchUserNotifications,
  getNotificationHistory,
  getUnreadClaims,
  markUserNotificationRead,
  markUserNotificationsAsRead,
} from "../services/claims";
import { useAhora } from "../hooks/useAhora";
import { puedeVolverAtras } from "../utils/navegacion";
import { useAnunciosUsuario } from "../hooks/useAnunciosUsuario";
import { esUrgente } from "../utils/anuncios";
import { etiquetaReclamo } from "../utils/tickets";
import { asignacionVigente, formatearFechaHora, hoy } from "../utils/fechas";

export default function AppHeader({ backTo }) {
  const { session, perfil, singOutUser } = useAuth();
  const email = session?.user?.email || "";
  const initial = (perfil?.nombre || email).charAt(0).toUpperCase();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const infoRef = useRef(null);
  const [allClaims, setAllClaims] = useState([]);
  const [userAssignment, setUserAssignment] = useState(null);
  const ahora = useAhora();
  const {
    anuncios: anunciosRecientes,
    noLeidos: anunciosNoLeidos,
    marcarLeido: marcarAnuncioLeido,
    marcarLeidos: marcarAnunciosComoLeidos,
  } = useAnunciosUsuario(session?.user?.id);
  const totalNuevas = notifications.length + anunciosNoLeidos.size;

  useEffect(() => {
    let active = true;

    async function loadUserAssignment() {
      if (!session?.user?.id) {
        setUserAssignment(null);
        return;
      }

      const today = hoy();
      const { data, error } = await supabase
        .from("unidad_usuarios")
        .select(
          "id, vinculo, fecha_desde, fecha_hasta, unidad_funcional(id, identificador, piso, edificio_id, edificio(nombre))",
        )
        .eq("usuario_id", session.user.id)
        .lte("fecha_desde", today)
        .order("fecha_desde", { ascending: false });

      if (!active) return;
      if (error) {
        setUserAssignment(null);
        return;
      }

      const activeAssignment = (data ?? []).find((row) =>
        asignacionVigente(row, today),
      );
      setUserAssignment(activeAssignment ?? null);
    }

    loadUserAssignment();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      if (!session?.user?.id) return;
      try {
        const persistentNotifications = await fetchUserNotifications(
          session.user.id,
        );
        if (persistentNotifications) {
          const visibleNotifications = persistentNotifications
            .filter((notification) => notification.reclamo)
            .map((notification) => ({
              ...notification.reclamo,
              notificationId: notification.id,
              leida: notification.leida,
              fecha_creacion:
                notification.reclamo.fecha_creacion || notification.creado_en,
            }));
          if (active) {
            setNotifications(
              visibleNotifications.filter((item) => !item.leida),
            );
            setNotificationHistory(visibleNotifications);
          }
          return;
        }
        // Solo en modo demo (sin Supabase): notificaciones desde localStorage.
        const claims = await fetchClaimsForUser();
        if (active) {
          setAllClaims(claims);
          setNotifications(getUnreadClaims(claims, session.user.id));
          setNotificationHistory(
            getNotificationHistory(claims, session.user.id),
          );
        }
      } catch (notificationError) {
        console.error(
          "No se pudieron cargar las notificaciones",
          notificationError,
        );
        if (active) setNotifications([]);
      }
    }
    loadNotifications();
    function refreshNotifications() {
      loadNotifications();
    }
    window.addEventListener("claims-viewed", refreshNotifications);
    window.addEventListener("notifications-cleared", refreshNotifications);
    return () => {
      active = false;
      window.removeEventListener("claims-viewed", refreshNotifications);
      window.removeEventListener("notifications-cleared", refreshNotifications);
    };
  }, [session?.user?.id]);

  // Con un menú abierto, tocar en cualquier otro lado (o apretar Escape) lo
  // cierra. Tocar dentro del propio menú o de su botón no lo cierra.
  useEffect(() => {
    if (!notificationsOpen && !profileOpen && !infoOpen) return;

    function alTocar(evento) {
      const dentro = [
        notificationsRef.current,
        profileRef.current,
        infoRef.current,
      ].some((contenedor) => contenedor?.contains(evento.target));
      if (dentro) return;
      setNotificationsOpen(false);
      setProfileOpen(false);
      setInfoOpen(false);
    }
    function alApretarTecla(evento) {
      if (evento.key !== "Escape") return;
      setNotificationsOpen(false);
      setProfileOpen(false);
      setInfoOpen(false);
    }

    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alApretarTecla);
    return () => {
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alApretarTecla);
    };
  }, [notificationsOpen, profileOpen, infoOpen]);

  function notificationTitle(claim) {
    return claim.titulo || claim.title || "Nuevo reclamo";
  }

  function handleNotificationsOpen() {
    setProfileOpen(false);
    setInfoOpen(false);
    setNotificationsOpen((open) => !open);
  }

  // Nada se marca como leído al abrir la campanita: se hace a propósito, de a
  // una o todas juntas.
  function recargarNotificaciones() {
    window.dispatchEvent(new CustomEvent("claims-viewed"));
  }

  function marcarNotificacionLeida(claim) {
    setNotifications((actuales) =>
      actuales.filter((item) => item.notificationId !== claim.notificationId),
    );
    setNotificationHistory((actuales) =>
      actuales.map((item) =>
        item.notificationId === claim.notificationId
          ? { ...item, leida: true }
          : item,
      ),
    );
    markUserNotificationRead(claim.notificationId).catch(
      recargarNotificaciones,
    );
  }

  function marcarTodoLeido() {
    setNotifications([]);
    setNotificationHistory((actuales) =>
      actuales.map((item) => ({ ...item, leida: true })),
    );
    markUserNotificationsAsRead(session?.user?.id).catch(
      recargarNotificaciones,
    );
    marcarAnunciosComoLeidos();
  }

  async function handleClearHistory() {
    const previous = notificationHistory;
    setNotificationHistory([]);
    try {
      await clearUserNotifications(session?.user?.id);
      clearNotificationHistory(session?.user?.id, allClaims);
    } catch (clearError) {
      // Si la base no las ocultó, volverían a aparecer al cambiar de página:
      // mejor mostrarlas de nuevo ahora.
      console.error("No se pudo limpiar el historial", clearError);
      setNotificationHistory(previous);
    }
  }

  return (
    <header
      className={`relative grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-b border-stone-200 bg-white px-3 py-2.5 sm:gap-2 sm:px-6 sm:py-3 ${
        backTo ? "" : "sm:grid-cols-[1fr_auto]"
      }`}
    >
      <FranjaMarca className="absolute inset-x-0 top-0" />
      {/* Columnas laterales iguales (1fr) para que la marca quede centrada de
          verdad aunque a un lado haya una flecha y al otro dos botones. Sin
          flecha, en pantallas chicas queda un hueco a la izquierda. */}
      {!backTo && <span aria-hidden="true" className="sm:hidden" />}
      {backTo && (
        <Link
          href={backTo}
          aria-label="Volver"
          onClick={(evento) => {
            // Con pantalla anterior dentro de la app, la flecha vuelve a ella;
            // si se entró directo, sigue el enlace a la pantalla "padre".
            const conModificador =
              evento.metaKey || evento.ctrlKey || evento.shiftKey;
            if (!conModificador && puedeVolverAtras()) {
              evento.preventDefault();
              window.history.back();
            }
          }}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 justify-self-start rounded-lg px-2 text-stone-600 transition-colors hover:bg-stone-100 active:bg-stone-200 sm:w-auto"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="hidden text-sm font-medium sm:inline">Volver</span>
        </Link>
      )}

      <Link
        href="/home"
        aria-label={`${NOMBRE_MARCA}: ir al inicio`}
        className={`flex min-w-0 items-center justify-center gap-2.5 rounded-lg py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 ${
          backTo ? "" : "sm:justify-start"
        }`}
      >
        <Isotipo className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
        <span aria-hidden="true" className="min-w-0 leading-tight">
          <span className="block text-base font-extrabold tracking-wider text-stone-800 sm:hidden">
            {SIGLAS}
          </span>
          <span className="hidden truncate text-base font-bold text-stone-900 sm:block lg:text-lg">
            Supervisión y Mantenimiento
          </span>
          <span className="hidden truncate text-[11px] font-medium tracking-[0.18em] text-stone-500 uppercase sm:block">
            Propiedad Horizontal
          </span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-1 justify-self-end sm:gap-3">
        {/* Contactos e información útil del edificio: solo para vecinos */}
        {perfil && perfil.rol !== "admin" && (
          <InfoUtil
            abierto={infoOpen}
            contenedorRef={infoRef}
            onAlternar={() => {
              setNotificationsOpen(false);
              setProfileOpen(false);
              setInfoOpen((open) => !open);
            }}
          />
        )}
        <div ref={notificationsRef} className="sm:relative">
          <button
            type="button"
            aria-label={`Notificaciones${totalNuevas ? `: ${totalNuevas} nuevas` : ""}`}
            aria-expanded={notificationsOpen}
            onClick={handleNotificationsOpen}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 sm:h-10 sm:w-10"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17H9m10-2V11a7 7 0 1 0-14 0v4l-2 2h18l-2-2Zm-5 5h-2"
              />
            </svg>
            {totalNuevas > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {totalNuevas > 9 ? "9+" : totalNuevas}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute inset-x-3 top-full z-50 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl sm:inset-x-auto sm:right-0 sm:top-12 sm:mt-0 sm:w-[22rem]">
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                <p className="font-semibold text-stone-900">Notificaciones</p>
                {totalNuevas > 0 ? (
                  <button
                    type="button"
                    onClick={marcarTodoLeido}
                    className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                  >
                    Marcar todo como leído
                  </button>
                ) : (
                  <Link
                    href="/reclamos"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs font-medium text-brand-700 hover:text-brand-800"
                  >
                    Ver reclamos
                  </Link>
                )}
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {anunciosRecientes.length > 0 && (
                  <div className="border-b border-stone-100">
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Anuncios
                      </p>
                      <Link
                        href="/anuncios"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-xs font-medium text-brand-700 hover:text-brand-800"
                      >
                        Ver todos
                      </Link>
                    </div>
                    {[...anunciosRecientes]
                      .sort(
                        (a, b) =>
                          Number(esUrgente(b, ahora)) -
                          Number(esUrgente(a, ahora)),
                      )
                      .slice(0, 4)
                      .map((anuncio) => {
                        const leido = !anunciosNoLeidos.has(anuncio.id);
                        const urgente = esUrgente(anuncio, ahora);
                        return (
                          <div
                            key={anuncio.id}
                            className={`flex items-start gap-2 border-l-4 px-3 py-2.5 ${
                              leido
                                ? "border-transparent bg-stone-50 text-stone-500"
                                : urgente
                                  ? "border-brand-600 bg-brand-50"
                                  : "border-amber-400 bg-amber-50/60"
                            }`}
                          >
                            <Link
                              href="/anuncios"
                              onClick={() => setNotificationsOpen(false)}
                              className="min-w-0 flex-1 rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
                            >
                              <p
                                className={`flex items-center gap-2 text-sm ${
                                  leido
                                    ? "font-normal text-stone-600"
                                    : "font-semibold text-stone-900"
                                }`}
                              >
                                {urgente && (
                                  <span className="shrink-0 rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                                    Urgente
                                  </span>
                                )}
                                <span className="truncate">
                                  {anuncio.titulo}
                                </span>
                              </p>
                              <p className="mt-0.5 truncate text-xs text-stone-500">
                                {anuncio.edificio?.nombre
                                  ? `${anuncio.edificio.nombre} · `
                                  : ""}
                                {formatearFechaHora(anuncio.creado_en)}
                              </p>
                            </Link>
                            {!leido && (
                              <button
                                type="button"
                                onClick={() => marcarAnuncioLeido(anuncio.id)}
                                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
                              >
                                Marcar como leído
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {notificationHistory.length === 0 ? (
                  anunciosRecientes.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-stone-500">
                      No hay notificaciones en el historial.
                    </p>
                  )
                ) : (
                  <>
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Reclamos
                      </p>
                      <Link
                        href="/reclamos"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-xs font-medium text-brand-700 hover:text-brand-800"
                      >
                        Ver reclamos
                      </Link>
                    </div>
                    {notificationHistory.slice(0, 8).map((claim) => (
                      <div
                        key={claim.notificationId ?? claim.id}
                        className={`flex items-start gap-2 border-l-4 border-b border-b-stone-100 px-3 py-2.5 ${
                          claim.leida
                            ? "border-l-transparent bg-stone-50 text-stone-500"
                            : "border-l-amber-400 bg-amber-50/60"
                        }`}
                      >
                        <Link
                          href={`/reclamos/${claim.id}`}
                          onClick={() => setNotificationsOpen(false)}
                          className="min-w-0 flex-1 rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
                        >
                          <p
                            className={`text-sm ${
                              claim.leida
                                ? "font-normal text-stone-600"
                                : "font-semibold text-stone-900"
                            }`}
                          >
                            Nuevo reclamo {etiquetaReclamo(claim)}:{" "}
                            {notificationTitle(claim)}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {claim.fecha_creacion
                              ? new Date(claim.fecha_creacion).toLocaleString(
                                  "es-AR",
                                )
                              : ""}
                          </p>
                        </Link>
                        {!claim.leida && claim.notificationId && (
                          <button
                            type="button"
                            onClick={() => marcarNotificacionLeida(claim)}
                            className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
                          >
                            Marcar como leído
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="w-full px-4 py-3 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Limpiar historial
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div ref={profileRef} className="relative">
          <button
            type="button"
            aria-label="Abrir menú de usuario"
            aria-expanded={profileOpen}
            onClick={() => {
              setNotificationsOpen(false);
              setInfoOpen(false);
              setProfileOpen((open) => !open);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white transition-shadow hover:ring-2 hover:ring-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 sm:h-9 sm:w-9"
          >
            {initial}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-stone-200 bg-white p-4 shadow-xl">
              <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">
                    {perfil?.nombre || "Usuario"} {perfil?.apellido || ""}
                  </p>
                  <p className="truncate text-xs text-stone-500">{email}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm text-stone-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-stone-500">Rol</span>
                  <span className="font-medium text-stone-800">
                    {perfil?.rol === "admin" ? "Administrador" : "Usuario"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-stone-500">Estado</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      perfil?.activo
                        ? "bg-green-100 text-green-700"
                        : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {perfil?.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>

                {perfil?.telefono && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">Teléfono</span>
                    <span className="font-medium text-stone-800">
                      {perfil.telefono}
                    </span>
                  </div>
                )}

                {userAssignment && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">Unidad</span>
                    <span className="text-right font-medium text-stone-800">
                      {userAssignment.unidad_funcional?.identificador ||
                        "Sin unidad"}
                    </span>
                  </div>
                )}

                {userAssignment?.unidad_funcional?.edificio?.nombre && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">Edificio</span>
                    <span className="text-right font-medium text-stone-800">
                      {userAssignment.unidad_funcional.edificio.nombre}
                    </span>
                  </div>
                )}

                {userAssignment?.vinculo && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">Vínculo</span>
                    <span className="font-medium capitalize text-stone-800">
                      {userAssignment.vinculo}
                    </span>
                  </div>
                )}
              </div>

              <Link
                href="/perfil"
                onClick={() => setProfileOpen(false)}
                className="mt-4 block w-full rounded-lg bg-brand-700 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
              >
                Mi perfil
              </Link>
              <button
                type="button"
                onClick={() => singOutUser()}
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
