export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-50">
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-amber-700"
      />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
