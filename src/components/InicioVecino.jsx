import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";
import { useAhora } from "../hooks/useAhora";
import { useAnunciosUsuario } from "../hooks/useAnunciosUsuario";
import { fetchMisReclamosActivos } from "../services/claims";
import { fetchMisAsignaciones } from "../services/vecino";
import { esUrgente } from "../utils/anuncios";
import { tiempoRelativo } from "../utils/fechas";
import { mensajeDeError } from "../utils/supabase-errors";
import { etiquetaReclamo } from "../utils/tickets";
import AvisosUrgentes from "./AvisosUrgentes";
import SelectorUnidad from "./SelectorUnidad";
import TarjetaAnuncio from "./TarjetaAnuncio";

const REFRESCO_MS = 60_000;
const MAX_RECLAMOS = 5;
const MAX_ANUNCIOS = 5;

const ESTADOS = {
  abierto: { etiqueta: "Activo", clase: "bg-amber-100 text-amber-900" },
  en_curso: { etiqueta: "En curso", clase: "bg-blue-100 text-blue-800" },
};

const VINCULOS = {
  propietario: "Propietario",
  inquilino: "Inquilino",
  ocupante: "Ocupante",
  otros: "Otros",
};

const etiquetaVinculo = (vinculo) =>
  VINCULOS[vinculo] ??
  (vinculo ? vinculo[0].toUpperCase() + vinculo.slice(1) : "");

function claveGuardada(userId) {
  return `inicio-unidad:${userId}`;
}

function leerSeleccionGuardada(userId) {
  try {
    return localStorage.getItem(claveGuardada(userId)) ?? "todas";
  } catch {
    return "todas";
  }
}

function Titulo({ children, aparte }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        {children}
      </h2>
      {aparte}
    </div>
  );
}

function EnlaceVerTodos({ href, children }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
    >
      {children}
    </Link>
  );
}

function TarjetaReclamo({ reclamo, ahora, edificio }) {
  const estado = ESTADOS[reclamo.estado] ?? {
    etiqueta: reclamo.estado,
    clase: "bg-stone-100 text-stone-700",
  };
  return (
    <Link
      href={`/reclamos/${reclamo.id}`}
      className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs font-medium text-stone-500">
          {etiquetaReclamo(reclamo)}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${estado.clase}`}
        >
          {estado.etiqueta}
        </span>
      </div>
      <p className="mt-1.5 break-words font-semibold text-stone-900">
        {reclamo.titulo}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
        {edificio && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
            {edificio}
          </span>
        )}
        <span>
          Actualizado{" "}
          {tiempoRelativo(
            reclamo.fecha_actualizacion || reclamo.fecha_creacion,
            ahora,
          )}
        </span>
      </div>
    </Link>
  );
}

// Pantalla de inicio del vecino: avisos urgentes, el botón para reclamar, sus
// reclamos activos y el tablón de anuncios. Los avisos urgentes se ven siempre,
// sea cual sea la unidad elegida; lo demás sigue a la unidad.
export default function InicioVecino() {
  const { session, perfil } = useAuth();
  const userId = session?.user?.id;
  const ahora = useAhora();

  const [asignaciones, setAsignaciones] = useState(null);
  const [reclamos, setReclamos] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [seleccionGuardada, setSeleccionGuardada] = useState(() =>
    leerSeleccionGuardada(userId),
  );

  const {
    anuncios,
    noLeidos,
    cargado: anunciosCargados,
    marcarLeido,
  } = useAnunciosUsuario(userId, { conContenido: true, limite: 30 });

  useEffect(() => {
    if (!userId) return undefined;
    let activo = true;

    async function cargar() {
      try {
        const [mias, activos] = await Promise.all([
          fetchMisAsignaciones(userId),
          fetchMisReclamosActivos(userId),
        ]);
        if (!activo) return;
        setAsignaciones(mias);
        setReclamos(activos);
        setErrorCarga(null);
      } catch (error) {
        console.error("No se pudo cargar el inicio", error);
        if (!activo) return;
        setErrorCarga(
          mensajeDeError(error, "No se pudo cargar tu información."),
        );
        setAsignaciones((actual) => actual ?? []);
        setReclamos((actual) => actual ?? []);
      }
    }
    function alVolverALaPestania() {
      if (document.visibilityState === "visible") cargar();
    }

    cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    document.addEventListener("visibilitychange", alVolverALaPestania);
    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolverALaPestania);
    };
  }, [userId]);

  const misUnidades = asignaciones ?? [];
  const idsUnidades = misUnidades.map((a) => a.unidad_funcional.id);
  // Si la unidad guardada ya no existe (se la quitaron), vuelve a "todas".
  const seleccion = idsUnidades.includes(seleccionGuardada)
    ? seleccionGuardada
    : "todas";

  function elegirUnidad(valor) {
    setSeleccionGuardada(valor);
    try {
      localStorage.setItem(claveGuardada(userId), valor);
    } catch {
      // sin almacenamiento: no se recuerda la elección
    }
  }

  const unidadesVistas =
    seleccion === "todas"
      ? misUnidades
      : misUnidades.filter((a) => a.unidad_funcional.id === seleccion);
  const edificiosVistos = new Set(
    unidadesVistas.map((a) => a.unidad_funcional.edificio_id),
  );
  const variosEdificios =
    new Set(misUnidades.map((a) => a.unidad_funcional.edificio_id)).size > 1;

  // Urgentes: de cualquiera de sus edificios, sin importar la unidad elegida.
  const urgentes = anuncios.filter((anuncio) => esUrgente(anuncio, ahora));
  const tablon = anuncios
    .filter(
      (anuncio) =>
        !esUrgente(anuncio, ahora) && edificiosVistos.has(anuncio.edificio_id),
    )
    .slice(0, MAX_ANUNCIOS);
  const misReclamos = (reclamos ?? []).filter(
    (reclamo) =>
      seleccion === "todas" || reclamo.unidad_funcional?.id === seleccion,
  );

  // "Nuevo reclamo" arranca con la unidad que se está mirando (o la única).
  const unidadParaReclamo =
    seleccion !== "todas"
      ? seleccion
      : misUnidades.length === 1
        ? misUnidades[0].unidad_funcional.id
        : null;
  const hrefNuevoReclamo = `/reclamos?nuevo=1${
    unidadParaReclamo ? `&unidad=${unidadParaReclamo}` : ""
  }`;

  const opcionesUnidad = [
    {
      value: "todas",
      titulo: "Todas mis unidades",
      detalle: `${misUnidades.length} unidades`,
    },
    ...misUnidades.map((a) => ({
      value: a.unidad_funcional.id,
      titulo: `${a.unidad_funcional.edificio?.nombre ?? "Edificio"} · ${a.unidad_funcional.identificador}`,
      detalle: [
        etiquetaVinculo(a.vinculo),
        a.unidad_funcional.piso ? `piso ${a.unidad_funcional.piso}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  ];

  const unicaUnidad = misUnidades.length === 1 ? misUnidades[0] : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:max-w-2xl lg:max-w-5xl">
      <section aria-label="Tu unidad" className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-stone-900">
              Hola{perfil?.nombre ? `, ${perfil.nombre}` : ""}
            </h1>
            {unicaUnidad && (
              <p className="mt-1 text-stone-600">
                <span className="font-semibold text-stone-800">
                  {unicaUnidad.unidad_funcional.edificio?.nombre}
                </span>{" "}
                · {unicaUnidad.unidad_funcional.identificador} ·{" "}
                {etiquetaVinculo(unicaUnidad.vinculo)}
              </p>
            )}
          </div>

          {misUnidades.length > 1 && (
            <div className="w-full sm:w-80 lg:w-96">
              <SelectorUnidad
                etiqueta="Mirando"
                opciones={opcionesUnidad}
                value={seleccion}
                onChange={elegirUnidad}
              />
            </div>
          )}
        </div>

        {asignaciones === null && (
          <div
            aria-hidden="true"
            className="h-14 animate-pulse rounded-xl bg-stone-200/70 motion-reduce:animate-none"
          />
        )}

        {asignaciones !== null && misUnidades.length === 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Todavía no tenés una unidad asignada. Cuando la administración te
            vincule a una, vas a poder crear reclamos y ver los anuncios de tu
            edificio.
          </p>
        )}

        {errorCarga && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorCarga}
          </p>
        )}
      </section>

      <AvisosUrgentes
        anuncios={urgentes}
        noLeidos={noLeidos}
        mostrarEdificio={variosEdificios}
        onMarcarLeido={marcarLeido}
      />

      {misUnidades.length > 0 ? (
        <Link
          href={hrefNuevoReclamo}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 active:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 focus-visible:ring-offset-2"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Crear nuevo reclamo
        </Link>
      ) : (
        asignaciones !== null && (
          <button
            type="button"
            disabled
            className="flex min-h-14 w-full cursor-not-allowed items-center justify-center rounded-2xl bg-stone-300 px-5 py-4 text-base font-semibold text-stone-500"
          >
            Crear nuevo reclamo
          </button>
        )
      )}

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0">
        <section aria-labelledby="titulo-reclamos" className="space-y-3">
          <Titulo
            aparte={<EnlaceVerTodos href="/reclamos">Ver todos</EnlaceVerTodos>}
          >
            <span id="titulo-reclamos">Tus reclamos activos</span>
          </Titulo>
          {reclamos === null ? (
            <div
              aria-hidden="true"
              className="h-24 animate-pulse rounded-2xl bg-stone-200/70 motion-reduce:animate-none"
            />
          ) : misReclamos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
              No tenés reclamos activos
              {seleccion !== "todas" ? " en esta unidad" : ""}.
            </p>
          ) : (
            misReclamos
              .slice(0, MAX_RECLAMOS)
              .map((reclamo) => (
                <TarjetaReclamo
                  key={reclamo.id}
                  reclamo={reclamo}
                  ahora={ahora}
                  edificio={
                    variosEdificios && seleccion === "todas"
                      ? reclamo.unidad_funcional?.edificio?.nombre
                      : null
                  }
                />
              ))
          )}
          {misReclamos.length > MAX_RECLAMOS && (
            <EnlaceVerTodos href="/reclamos">
              Ver los {misReclamos.length} reclamos activos
            </EnlaceVerTodos>
          )}
        </section>

        <section aria-labelledby="titulo-tablon" className="space-y-3">
          <Titulo
            aparte={<EnlaceVerTodos href="/anuncios">Ver todos</EnlaceVerTodos>}
          >
            <span id="titulo-tablon">Tablón de anuncios</span>
          </Titulo>
          {!anunciosCargados ? (
            <div
              aria-hidden="true"
              className="h-24 animate-pulse rounded-2xl bg-stone-200/70 motion-reduce:animate-none"
            />
          ) : tablon.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
              Todavía no hay anuncios para mostrar.
            </p>
          ) : (
            tablon.map((anuncio) => (
              <TarjetaAnuncio
                key={anuncio.id}
                anuncio={anuncio}
                leido={!noLeidos.has(anuncio.id)}
                mostrarEdificio={variosEdificios && seleccion === "todas"}
                resumido
                onMarcarLeido={marcarLeido}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}
