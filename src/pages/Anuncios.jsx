import { useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import TarjetaAnuncio from "../components/TarjetaAnuncio";
import { useAuth } from "../contexts/auth-context/use-auth";
import { useAhora } from "../hooks/useAhora";
import { useAnunciosUsuario } from "../hooks/useAnunciosUsuario";
import { esUrgente } from "../utils/anuncios";

export default function Anuncios() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const ahora = useAhora();
  const [edificioFiltro, setEdificioFiltro] = useState("todos");

  const { anuncios, noLeidos, cargado, error, marcarLeido, marcarLeidos } =
    useAnunciosUsuario(userId, { conContenido: true, limite: null });

  const edificios = useMemo(() => {
    const porId = new Map();
    for (const anuncio of anuncios) {
      porId.set(anuncio.edificio_id, anuncio.edificio?.nombre || "Edificio");
    }
    return [...porId].map(([id, nombre]) => ({ id, nombre }));
  }, [anuncios]);

  const visibles = anuncios.filter(
    (anuncio) =>
      edificioFiltro === "todos" || anuncio.edificio_id === edificioFiltro,
  );
  // Los urgentes vigentes van arriba; vencidos, pasan al resto cronológico.
  const urgentes = visibles.filter((anuncio) => esUrgente(anuncio, ahora));
  const comunes = visibles.filter((anuncio) => !esUrgente(anuncio, ahora));
  const variosEdificios = edificios.length > 1;

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/home" />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Anuncios</h1>
            <p className="mt-1 text-sm text-stone-500">
              Comunicados de la administración de tu edificio.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {variosEdificios && (
              <>
                <label htmlFor="filtro-edificio" className="sr-only">
                  Filtrar por edificio
                </label>
                <select
                  id="filtro-edificio"
                  value={edificioFiltro}
                  onChange={(e) => setEdificioFiltro(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 sm:w-auto"
                >
                  <option value="todos">Todos los edificios</option>
                  {edificios.map((edificio) => (
                    <option key={edificio.id} value={edificio.id}>
                      {edificio.nombre}
                    </option>
                  ))}
                </select>
              </>
            )}
            {noLeidos.size > 0 && (
              <button
                type="button"
                onClick={marcarLeidos}
                className="whitespace-nowrap rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
              >
                Marcar todos como leídos ({noLeidos.size})
              </button>
            )}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {!cargado && (
          <p className="mt-6 text-sm text-stone-500">Cargando anuncios...</p>
        )}

        <div className="mt-6 space-y-3">
          {urgentes.map((anuncio) => (
            <TarjetaAnuncio
              key={anuncio.id}
              anuncio={anuncio}
              urgente
              leido={!noLeidos.has(anuncio.id)}
              mostrarEdificio={variosEdificios}
              onMarcarLeido={marcarLeido}
            />
          ))}
          {comunes.map((anuncio) => (
            <TarjetaAnuncio
              key={anuncio.id}
              anuncio={anuncio}
              leido={!noLeidos.has(anuncio.id)}
              mostrarEdificio={variosEdificios}
              onMarcarLeido={marcarLeido}
            />
          ))}

          {cargado && visibles.length === 0 && !error && (
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-10 text-center shadow-sm">
              <p className="font-medium text-stone-800">
                Todavía no hay anuncios
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Cuando la administración publique uno para tu edificio, lo vas a
                ver acá.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
