import { useAuth } from "../contexts/auth-context/use-auth";

export default function AppHeader({ children }) {
  const { session, singOutUser } = useAuth();
  const email = session?.user?.email;
  const initial = email?.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <span className="shrink-0 text-base font-bold text-stone-900 sm:text-lg">
          Supervisión y Mantenimiento
        </span>
        {children}
      </div>

      <div className="flex shrink-0 items-center gap-3">
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
