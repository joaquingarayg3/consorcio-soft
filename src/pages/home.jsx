import { Link } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";
import AppHeader from "../components/AppHeader";

export default function Home() {
  const { session, perfil } = useAuth();
  const email = session?.user?.email;

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader>
        {perfil?.rol === "admin" && (
          <div className="flex items-center gap-4">
            <Link
              href="/admin/edificios"
              className="text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline"
            >
              Edificios
            </Link>
            <Link
              href="/admin/usuarios"
              className="text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline"
            >
              Gestión de usuarios
            </Link>
          </div>
        )}
      </AppHeader>

      <main className="flex flex-col items-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M3 21h18" />
              <path d="M6 21V8l6-4 6 4v13" />
              <path d="M10 21v-6h4v6" />
              <path d="M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
            </svg>
          </div>

          <h1 className="text-lg font-semibold text-stone-900 sm:text-xl">
            ¡Bienvenido/a!
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Sesión iniciada como{" "}
            <span className="font-medium text-stone-700">{email}</span>
          </p>
          <p className="mt-4 text-sm text-stone-500">
            El panel de gestión de consorcios está en construcción. Pronto vas
            a poder administrar propiedades, mantenimiento y comunicación
            desde acá.
          </p>
        </div>
      </main>
    </div>
  );
}
