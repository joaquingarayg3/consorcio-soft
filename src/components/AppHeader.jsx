import { useEffect, useState } from "react";
import { Link } from "wouter";
import supabase from "../supabase-client";
import { useAuth } from "../contexts/auth-context/use-auth";
import {
  clearNotificationHistory,
  clearUserNotifications,
  fetchClaimsForUser,
  fetchUserNotifications,
  getNotificationHistory,
  getUnreadClaims,
  markUserNotificationsAsRead,
  markClaimsAsViewed,
} from "../services/claims";
import { asignacionVigente, hoy } from "../utils/fechas";

export default function AppHeader({ backTo }) {
  const { session, perfil, singOutUser } = useAuth();
  const email = session?.user?.email || "";
  const initial = (perfil?.nombre || email).charAt(0).toUpperCase();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [allClaims, setAllClaims] = useState([]);
  const [userAssignment, setUserAssignment] = useState(null);

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

  function notificationTitle(claim) {
    return claim.titulo || claim.title || "Nuevo reclamo";
  }

  function handleNotificationsOpen() {
    const nextOpen = !notificationsOpen;
    setProfileOpen(false);
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      setNotifications([]);
      markUserNotificationsAsRead(session?.user?.id).catch(() => null);
      markClaimsAsViewed(session?.user?.id);
    }
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
      className={`grid items-center gap-2 border-b border-stone-200 bg-white px-3 py-2.5 sm:px-6 sm:py-3 ${
        backTo ? "grid-cols-[auto_1fr_auto]" : "grid-cols-[1fr_auto]"
      }`}
    >
      {backTo && (
        <Link
          href={backTo}
          aria-label="Volver"
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-stone-600 transition-colors hover:bg-stone-100 active:bg-stone-200 sm:w-auto"
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

      <span
        className={`min-w-0 truncate text-sm font-bold text-stone-900 sm:text-lg ${
          backTo ? "text-center" : "text-left"
        }`}
      >
        Supervisión y Mantenimiento
      </span>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="relative">
          <button
            type="button"
            aria-label={`Notificaciones${notifications.length ? `: ${notifications.length} nuevas` : ""}`}
            aria-expanded={notificationsOpen}
            onClick={handleNotificationsOpen}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
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
            {notifications.length > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <p className="font-semibold text-stone-900">Notificaciones</p>
                <Link
                  href="/reclamos"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  Ver reclamos
                </Link>
              </div>
              {notificationHistory.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-stone-500">
                  No hay notificaciones en el historial.
                </p>
              ) : (
                <>
                  <div className="max-h-80 overflow-y-auto">
                    {notificationHistory.slice(0, 8).map((claim) => (
                      <Link
                        key={claim.id}
                        href={`/reclamos/${claim.id}`}
                        onClick={() => setNotificationsOpen(false)}
                        className="block border-b border-stone-100 px-4 py-3 transition-colors hover:bg-stone-50"
                      >
                        <p className="text-sm font-medium text-stone-800">
                          Nuevo reclamo: {notificationTitle(claim)}
                        </p>
                        <p className="mt-1 text-xs text-stone-400">
                          {claim.fecha_creacion
                            ? new Date(claim.fecha_creacion).toLocaleString(
                                "es-AR",
                              )
                            : ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="w-full border-t border-stone-100 px-4 py-3 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Limpiar historial
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Abrir menú de usuario"
            aria-expanded={profileOpen}
            onClick={() => {
              setNotificationsOpen(false);
              setProfileOpen((open) => !open);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-700 text-sm font-semibold text-white transition-shadow hover:ring-2 hover:ring-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
          >
            {initial}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-stone-200 bg-white p-4 shadow-xl">
              <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-700 text-sm font-semibold text-white">
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

              <button
                type="button"
                onClick={() => singOutUser()}
                className="mt-4 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
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
