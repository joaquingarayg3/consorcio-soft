import { useAuth } from "../contexts/auth-context/use-auth";

export default function Home() {
  const { session, singOutUser } = useAuth();
  const email = session?.user?.email;
  const initial = email?.charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <span className="text-base font-bold text-stone-900 sm:text-lg">
          Supervisión y Mantenimiento
        </span>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium text-stone-600 sm:inline">
            {email}
          </span>
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-700 text-sm font-semibold text-white"
          >
            {initial}
          </div>
          <button
            type="button"
            onClick={() => singOutUser()}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 active:bg-stone-200"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

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
