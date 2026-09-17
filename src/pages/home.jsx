import { Link } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";
import AppHeader from "../components/AppHeader";

const accesos = [
  {
    href: "/admin/edificios",
    titulo: "Edificios",
    descripcion: "Propiedades y unidades funcionales",
    icono: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <rect x="6" y="3" width="12" height="18" rx="1" />
        <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    href: "/admin/usuarios",
    titulo: "Usuarios",
    descripcion: "Altas, bajas y perfiles",
    icono: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/reclamos",
    titulo: "Reclamos",
    descripcion: "Solicitudes y mantenimiento",
    icono: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M9 4.5h6M9 3h6a1.5 1.5 0 0 1 1.5 1.5v.5h1A1.5 1.5 0 0 1 19 6.5v14A1.5 1.5 0 0 1 17.5 22h-11A1.5 1.5 0 0 1 5 20.5v-14A1.5 1.5 0 0 1 6.5 5h1v-.5A1.5 1.5 0 0 1 9 3Z" />
        <path d="m8 13 2 2 5-5" />
      </svg>
    ),
  },
];

export default function Home() {
  const { session, perfil } = useAuth();
  const email = session?.user?.email;

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />

      <main className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:max-w-2xl">
          <div
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 21h18" />
              <path d="M6 21V8l6-4 6 4v13" />
              <path d="M10 21v-6h4v6" />
              <path d="M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
            </svg>
          </div>
          <div className="min-w-0 text-left">
            <p className="font-semibold text-stone-900">¡Bienvenido/a!</p>
            <p className="truncate text-sm text-stone-500">
              Sesión iniciada como{" "}
              <span className="font-medium text-stone-700">{email}</span>
            </p>
          </div>
        </div>

        {perfil?.rol === "admin" && (
          <div className="mt-6 w-full max-w-md sm:max-w-2xl">
            <h2 className="px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Panel de administración
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {accesos.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
                >
                  <div
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"
                  >
                    {a.icono}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-semibold text-stone-900">{a.titulo}</p>
                    <p className="truncate text-sm text-stone-500">
                      {a.descripcion}
                    </p>
                  </div>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {perfil?.rol !== "admin" && (
          <div className="mt-6 w-full max-w-md sm:max-w-2xl">
            <h2 className="px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Accesos
            </h2>
            <div className="mt-3">
              <Link
                href="/reclamos"
                className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  {accesos[2].icono}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="font-semibold text-stone-900">Reclamos</p>
                  <p className="truncate text-sm text-stone-500">
                    Solicitudes y mantenimiento
                  </p>
                </div>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
