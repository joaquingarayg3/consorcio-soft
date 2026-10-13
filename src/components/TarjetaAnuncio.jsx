import { formatearFechaHora } from "../utils/fechas";

// Una tarjeta de anuncio, igual en el Inicio y en el portal de anuncios.
//
// Colores: sin leer se destaca con un borde más intenso; leído se apaga un
// poco (gris). Un anuncio urgente (vigente) usa los colores de la marca en rojo:
// más fuerte sin leer, más tenue una vez leído, pero siempre arriba.
export default function TarjetaAnuncio({
  anuncio,
  leido,
  urgente = false,
  mostrarEdificio = false,
  resumido = false,
  etiquetaUrgente = true,
  onMarcarLeido,
  onContraer,
}) {
  const clases = urgente
    ? leido
      ? "border-brand-200 bg-brand-50/60 opacity-80"
      : "border-brand-600 bg-brand-50 shadow-md ring-1 ring-brand-600/30"
    : leido
      ? "border-stone-200 bg-stone-100/70 text-stone-500"
      : "border-amber-400 bg-white shadow-sm ring-1 ring-amber-300/60";

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors sm:p-5 ${clases}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {urgente && etiquetaUrgente && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase ${
              leido ? "bg-brand-100 text-brand-800" : "bg-brand-700 text-white"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            Aviso urgente
          </span>
        )}
        {!leido && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            Sin leer
          </span>
        )}
        {mostrarEdificio && anuncio.edificio?.nombre && (
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
            {anuncio.edificio.nombre}
          </span>
        )}
        <time dateTime={anuncio.creado_en} className="text-xs text-stone-500">
          {formatearFechaHora(anuncio.creado_en)}
        </time>
      </div>

      <h3
        className={`mt-2 break-words font-semibold ${
          leido && !urgente ? "text-stone-600" : "text-stone-900"
        } ${urgente ? "text-lg" : ""}`}
      >
        {anuncio.titulo}
      </h3>

      {anuncio.contenido && (
        <p
          className={`mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed ${
            leido && !urgente ? "text-stone-500" : "text-stone-700"
          } ${resumido ? "line-clamp-3" : ""}`}
        >
          {anuncio.contenido}
        </p>
      )}

      {urgente && anuncio.urgente_hasta && (
        <p className="mt-2 text-xs font-medium text-brand-800">
          Urgente hasta el {formatearFechaHora(anuncio.urgente_hasta)}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        {leido ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Leído
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onMarcarLeido?.(anuncio.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Marcar como leído
          </button>
        )}
        {onContraer && (
          <button
            type="button"
            onClick={onContraer}
            className="text-xs font-medium text-stone-500 hover:text-stone-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
          >
            Ocultar
          </button>
        )}
      </div>
    </article>
  );
}
