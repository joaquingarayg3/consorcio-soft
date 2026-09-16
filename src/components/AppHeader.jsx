import { Link } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";

export default function AppHeader({ backTo }) {
  const { session, singOutUser } = useAuth();
  const email = session?.user?.email;
  const initial = email?.charAt(0).toUpperCase();

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
  );
}
