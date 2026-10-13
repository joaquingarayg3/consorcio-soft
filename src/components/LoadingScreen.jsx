import { Isotipo } from "./Marca";

export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-stone-50">
      <Isotipo className="h-20 w-20 animate-pulse motion-reduce:animate-none" />
      <div
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-brand-700 motion-reduce:animate-none"
      />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
