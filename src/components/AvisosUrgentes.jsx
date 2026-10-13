import { useState } from "react";
import { Link } from "wouter";
import TarjetaAnuncio from "./TarjetaAnuncio";

// Cuántos avisos urgentes se muestran completos y cuántos como fila de una
// línea. El resto va al portal de anuncios.
const MAX_COMPLETOS = 2;
const MAX_FILAS = 3;

const IconoAlerta = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
  >
    <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </svg>
);

function FilaUrgente({ anuncio, leido, mostrarEdificio, onAbrir }) {
  return (
    <button
      type="button"
      aria-expanded="false"
      onClick={onAbrir}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 ${
        leido
          ? "border-brand-200 bg-brand-50/50 text-stone-600 hover:bg-brand-50"
          : "border-brand-400 bg-brand-50 hover:bg-brand-100/60"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          leido ? "bg-stone-300" : "bg-brand-600"
        }`}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${
            leido
              ? "font-medium text-stone-600"
              : "font-semibold text-stone-900"
          }`}
        >
          {anuncio.titulo}
        </span>
        {mostrarEdificio && anuncio.edificio?.nombre && (
          <span className="block truncate text-xs text-stone-500">
            {anuncio.edificio.nombre}
          </span>
        )}
      </span>
      <span
        className={`shrink-0 text-xs font-medium ${
          leido ? "text-stone-500" : "text-brand-800"
        }`}
      >
        {leido ? "Leído" : "Sin leer"}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-stone-400"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

// Avisos urgentes del inicio, pensados para no ocupar toda la pantalla cuando
// hay varios: los sin leer más próximos a vencer van completos (hasta 2), y el
// resto, incluidos los ya leídos, como una línea que se abre al tocarla. Siguen
// arriba hasta que vencen.
export default function AvisosUrgentes({
  anuncios,
  noLeidos,
  mostrarEdificio,
  onMarcarLeido,
}) {
  const [abiertos, setAbiertos] = useState(() => new Set());

  if (anuncios.length === 0) return null;

  const sinLeer = anuncios
    .filter((anuncio) => noLeidos.has(anuncio.id))
    .sort((a, b) => new Date(a.urgente_hasta) - new Date(b.urgente_hasta));
  const leidos = anuncios
    .filter((anuncio) => !noLeidos.has(anuncio.id))
    .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));

  const completos = sinLeer.slice(0, MAX_COMPLETOS);
  const filas = [...sinLeer.slice(MAX_COMPLETOS), ...leidos];
  const filasVisibles = filas.slice(0, MAX_FILAS);
  const ocultos = filas.length - filasVisibles.length;

  function alternar(id) {
    setAbiertos((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  return (
    <section aria-labelledby="titulo-urgentes" className="space-y-3">
      <h2
        id="titulo-urgentes"
        className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-wide text-brand-800 uppercase"
      >
        <IconoAlerta />
        {anuncios.length === 1
          ? "Aviso urgente"
          : `${anuncios.length} avisos urgentes`}
        {sinLeer.length > 0 && (
          <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold tracking-normal text-white normal-case">
            {sinLeer.length === 1 ? "1 sin leer" : `${sinLeer.length} sin leer`}
          </span>
        )}
      </h2>

      {completos.map((anuncio) => (
        <TarjetaAnuncio
          key={anuncio.id}
          anuncio={anuncio}
          urgente
          etiquetaUrgente={false}
          leido={false}
          mostrarEdificio={mostrarEdificio}
          onMarcarLeido={onMarcarLeido}
        />
      ))}

      {filasVisibles.map((anuncio) =>
        abiertos.has(anuncio.id) ? (
          <TarjetaAnuncio
            key={anuncio.id}
            anuncio={anuncio}
            urgente
            etiquetaUrgente={false}
            leido={!noLeidos.has(anuncio.id)}
            mostrarEdificio={mostrarEdificio}
            onMarcarLeido={onMarcarLeido}
            onContraer={() => alternar(anuncio.id)}
          />
        ) : (
          <FilaUrgente
            key={anuncio.id}
            anuncio={anuncio}
            leido={!noLeidos.has(anuncio.id)}
            mostrarEdificio={mostrarEdificio}
            onAbrir={() => alternar(anuncio.id)}
          />
        ),
      )}

      {ocultos > 0 && (
        <Link
          href="/anuncios"
          className="inline-block text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
        >
          Ver los {anuncios.length} avisos urgentes
        </Link>
      )}
    </section>
  );
}
