import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../contexts/auth-context/use-auth";
import {
  fetchAnunciosParaUsuario,
  marcarAnunciosLeidos,
} from "../services/anuncios";
import { formatearFechaHora } from "../utils/fechas";
import { mensajeDeError } from "../utils/supabase-errors";

export default function Anuncios() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [anuncios, setAnuncios] = useState(null);
  // Los que no había leído al entrar: se marcan "Nuevo" aunque ya queden leídos.
  const [nuevos, setNuevos] = useState(new Set());
  const [error, setError] = useState(null);
  const [edificioFiltro, setEdificioFiltro] = useState("todos");

  useEffect(() => {
    if (!userId) return undefined;
    let activo = true;
    async function cargar() {
      try {
        const resultado = await fetchAnunciosParaUsuario(userId, {
          conContenido: true,
        });
        if (!activo) return;
        setAnuncios(resultado.anuncios);
        setNuevos(resultado.noLeidos);
        if (resultado.noLeidos.size > 0) {
          await marcarAnunciosLeidos(userId, [...resultado.noLeidos]);
          // La campanita del encabezado se actualiza al instante.
          window.dispatchEvent(new Event("anuncios-leidos"));
        }
      } catch (loadError) {
        if (!activo) return;
        console.error("No se pudieron cargar los anuncios", loadError);
        setError(
          mensajeDeError(loadError, "No se pudieron cargar los anuncios."),
        );
        setAnuncios((actuales) => actuales ?? []);
      }
    }
    cargar();
    return () => {
      activo = false;
    };
  }, [userId]);

  const edificios = useMemo(() => {
    const porId = new Map();
    for (const anuncio of anuncios ?? []) {
      porId.set(anuncio.edificio_id, anuncio.edificio?.nombre || "Edificio");
    }
    return [...porId].map(([id, nombre]) => ({ id, nombre }));
  }, [anuncios]);

  const visibles = (anuncios ?? []).filter(
    (anuncio) =>
      edificioFiltro === "todos" || anuncio.edificio_id === edificioFiltro,
  );
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
          {variosEdificios && (
            <div>
              <label htmlFor="filtro-edificio" className="sr-only">
                Filtrar por edificio
              </label>
              <select
                id="filtro-edificio"
                value={edificioFiltro}
                onChange={(e) => setEdificioFiltro(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 sm:w-auto"
              >
                <option value="todos">Todos los edificios</option>
                {edificios.map((edificio) => (
                  <option key={edificio.id} value={edificio.id}>
                    {edificio.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {anuncios === null && (
          <p className="mt-6 text-sm text-stone-500">Cargando anuncios...</p>
        )}

        <div className="mt-6 space-y-3">
          {visibles.map((anuncio) => (
            <article
              key={anuncio.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                {nuevos.has(anuncio.id) && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Nuevo
                  </span>
                )}
                {variosEdificios && (
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                    {anuncio.edificio?.nombre}
                  </span>
                )}
                <time
                  dateTime={anuncio.creado_en}
                  className="text-xs text-stone-400"
                >
                  {formatearFechaHora(anuncio.creado_en)}
                </time>
              </div>
              <h2 className="mt-2 break-words text-lg font-semibold text-stone-900">
                {anuncio.titulo}
              </h2>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-stone-700">
                {anuncio.contenido}
              </p>
            </article>
          ))}

          {anuncios !== null && visibles.length === 0 && !error && (
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
