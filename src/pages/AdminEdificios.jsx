import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";
import ModalForm, { ModalFormButton } from "../components/ModalForm";
import { mensajeDeError } from "../utils/supabase-errors";
import { coincideBusqueda } from "../utils/texto";

const CLAVE_BUSQUEDA = "edificios-busqueda";

function obtenerEdificios() {
  return supabase.from("edificio").select("*").order("nombre");
}

function obtenerReclamosAbiertos() {
  return supabase
    .from("reclamos")
    .select("unidad_funcional:unidad_funcional_id ( edificio_id )")
    .neq("estado", "cerrado");
}

function obtenerUnidadesPorEdificio() {
  return supabase.from("edificio").select("id, unidad_funcional(count)");
}

function contarPorEdificio(filas) {
  const conteo = {};
  for (const fila of filas ?? []) {
    const edificioId = fila.unidad_funcional?.edificio_id;
    if (edificioId) conteo[edificioId] = (conteo[edificioId] || 0) + 1;
  }
  return conteo;
}

function contarUnidades(filas) {
  const conteo = {};
  for (const fila of filas ?? []) {
    conteo[fila.id] = fila.unidad_funcional?.[0]?.count ?? 0;
  }
  return conteo;
}

// Lo accesorio (reclamos, unidades) no debe tirar abajo la lista: si falla,
// la lista se muestra igual, sin esos datos.
async function cargarDatos() {
  const [edificios, reclamos, unidades] = await Promise.all([
    obtenerEdificios(),
    obtenerReclamosAbiertos(),
    obtenerUnidadesPorEdificio(),
  ]);
  return {
    error: edificios.error,
    edificios: edificios.data,
    abiertos: contarPorEdificio(reclamos.data),
    unidades: unidades.error ? null : contarUnidades(unidades.data),
  };
}

function leerBusquedaGuardada() {
  try {
    return sessionStorage.getItem(CLAVE_BUSQUEDA) ?? "";
  } catch {
    return "";
  }
}

function textoUnidades(cantidad) {
  if (cantidad == null) return "—";
  return `${cantidad} ${cantidad === 1 ? "unidad" : "unidades"}`;
}

function ReclamosAbiertos({ cantidad }) {
  if (!cantidad) return null;
  return (
    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      {cantidad} {cantidad === 1 ? "reclamo abierto" : "reclamos abiertos"}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

// Las columnas de escritorio se comparten entre el encabezado y las filas.
const COLUMNAS = "lg:grid-cols-[2.75rem_minmax(0,1fr)_7rem_11rem_10rem]";

function FilaEdificio({ edificio, reclamos, unidades }) {
  const ubicacion = [edificio.direccion, edificio.ciudad]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/admin/edificios/${edificio.id}`}
        className={`group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-amber-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600/50 lg:grid lg:gap-4 lg:px-5 ${COLUMNAS}`}
      >
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <rect x="6" y="3" width="12" height="18" rx="1" />
            <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
            <path d="M3 21h18" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-stone-900">
            {edificio.nombre}
          </p>
          <p className="truncate text-sm text-stone-500">{ubicacion || "—"}</p>
          {/* Hasta tablet los datos van debajo; en escritorio tienen columna */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 lg:hidden">
            {unidades != null && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                {textoUnidades(unidades)}
              </span>
            )}
            <ReclamosAbiertos cantidad={reclamos} />
          </div>
        </div>

        <span className="hidden text-sm text-stone-600 lg:block">
          {textoUnidades(unidades)}
        </span>
        <span className="hidden lg:block">
          {reclamos > 0 ? (
            <ReclamosAbiertos cantidad={reclamos} />
          ) : (
            <span className="text-sm text-stone-400">Sin reclamos</span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="hidden items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition-colors group-hover:border-amber-700 group-hover:bg-amber-700 group-hover:text-white lg:inline-flex"
        >
          Gestionar edificio
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>

        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600 lg:hidden"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </li>
  );
}

function FilasCargando() {
  return (
    <ul aria-hidden="true" className="divide-y divide-stone-100">
      {[0, 1, 2, 3, 4].map((n) => (
        <li key={n} className="flex items-center gap-4 px-4 py-3.5 lg:px-5">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-stone-100 motion-reduce:animate-none" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-stone-100 motion-reduce:animate-none" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100 motion-reduce:animate-none" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminEdificios() {
  const [edificios, setEdificios] = useState(null);
  const [abiertos, setAbiertos] = useState({});
  const [unidades, setUnidades] = useState(null);
  const [listError, setListError] = useState(null);

  const [busqueda, setBusqueda] = useState(leerBusquedaGuardada);
  const [soloConReclamos, setSoloConReclamos] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState(null);
  const [creadoOk, setCreadoOk] = useState(false);
  const cierreRef = useRef(null);

  const aplicarDatos = useCallback((datos) => {
    if (datos.error) {
      setListError(mensajeDeError(datos.error));
      return;
    }
    setListError(null);
    setEdificios(datos.edificios);
    setAbiertos(datos.abiertos);
    setUnidades(datos.unidades);
  }, []);

  useEffect(() => {
    let activo = true;
    cargarDatos().then((datos) => {
      if (activo) aplicarDatos(datos);
    });
    return () => {
      activo = false;
      clearTimeout(cierreRef.current);
    };
  }, [aplicarDatos]);

  // La búsqueda se recuerda mientras dure la pestaña: al volver de gestionar
  // un edificio se sigue con la misma lista, sin buscar de nuevo.
  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_BUSQUEDA, busqueda);
    } catch {
      // sin almacenamiento: la búsqueda simplemente no se recuerda
    }
  }, [busqueda]);

  const totalConReclamos = useMemo(
    () => (edificios ?? []).filter((ed) => abiertos[ed.id] > 0).length,
    [edificios, abiertos],
  );

  const visibles = useMemo(
    () =>
      (edificios ?? []).filter(
        (ed) =>
          (!soloConReclamos || abiertos[ed.id] > 0) &&
          coincideBusqueda(
            [ed.nombre, ed.direccion, ed.ciudad, ed.provincia],
            busqueda,
          ),
      ),
    [edificios, abiertos, busqueda, soloConReclamos],
  );
  const filtrando = busqueda.trim() !== "" || soloConReclamos;

  function limpiarFiltros() {
    setBusqueda("");
    setSoloConReclamos(false);
  }

  async function handleCrearEdificio(e) {
    e.preventDefault();
    setCreando(true);
    setFormError(null);

    const { error } = await supabase.from("edificio").insert({
      nombre,
      direccion,
      ciudad: ciudad || null,
      provincia: provincia.trim(),
      codigo_postal: codigoPostal || null,
    });

    setCreando(false);

    if (error) {
      setFormError(mensajeDeError(error));
      return;
    }

    cargarDatos().then(aplicarDatos);
    // Sin filtros, para que el edificio recién creado se vea en la lista.
    limpiarFiltros();
    setCreadoOk(true);
    cierreRef.current = setTimeout(() => {
      setFormAbierto(false);
      setCreadoOk(false);
      setNombre("");
      setDireccion("");
      setCiudad("");
      setProvincia("");
      setCodigoPostal("");
    }, 1400);
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/home" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-stone-900">Edificios</h1>
          <button
            type="button"
            onClick={() => setFormAbierto(true)}
            className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 sm:w-auto sm:py-2"
          >
            + Nuevo edificio
          </button>
        </div>

        <ModalForm
          open={formAbierto}
          onClose={() => {
            setFormAbierto(false);
            setFormError(null);
          }}
          busy={creando}
          success={creadoOk}
          successTitle="¡Edificio creado!"
          successMessage={`${nombre} ya está disponible en la lista.`}
          title="Nuevo edificio"
        >
          <form onSubmit={handleCrearEdificio} className="space-y-4">
            <div>
              <label htmlFor="nombre" className={labelClass}>
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={creando}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="direccion" className={labelClass}>
                Dirección
              </label>
              <input
                id="direccion"
                type="text"
                required
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                disabled={creando}
                className={inputClass}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="ciudad" className={labelClass}>
                  Ciudad
                </label>
                <input
                  id="ciudad"
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  disabled={creando}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="provincia" className={labelClass}>
                  Provincia
                </label>
                <input
                  id="provincia"
                  type="text"
                  required
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  disabled={creando}
                  className={inputClass}
                />
              </div>
              <div className="w-32 shrink-0">
                <label htmlFor="codigoPostal" className={labelClass}>
                  C.P.
                </label>
                <input
                  id="codigoPostal"
                  type="text"
                  value={codigoPostal}
                  onChange={(e) => setCodigoPostal(e.target.value)}
                  disabled={creando}
                  className={inputClass}
                />
              </div>
            </div>

            <ModalFormButton
              loading={creando}
              label="Crear edificio"
              loadingLabel="Creando..."
            />

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {formError}
              </div>
            )}
          </form>
        </ModalForm>

        <div
          role="search"
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Buscar edificio"
              placeholder="Buscar por nombre, dirección o ciudad"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setBusqueda("");
              }}
              className={`${inputClass} pr-11 pl-10`}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {(totalConReclamos > 0 || soloConReclamos) && (
            <button
              type="button"
              aria-pressed={soloConReclamos}
              onClick={() => setSoloConReclamos((v) => !v)}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 ${
                soloConReclamos
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              Con reclamos abiertos
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  soloConReclamos
                    ? "bg-red-100 text-red-700"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {totalConReclamos}
              </span>
            </button>
          )}
        </div>

        {edificios !== null && edificios.length > 0 && (
          <p aria-live="polite" className="mt-3 px-1 text-sm text-stone-500">
            {filtrando
              ? `${visibles.length} de ${edificios.length} edificios`
              : `${edificios.length} ${edificios.length === 1 ? "edificio" : "edificios"}`}
          </p>
        )}

        <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {edificios === null && !listError && <FilasCargando />}

          {visibles.length > 0 && (
            <>
              <div
                aria-hidden="true"
                className={`hidden border-b border-stone-200 bg-stone-50 px-5 py-2.5 text-xs font-medium tracking-wide text-stone-500 uppercase lg:grid lg:gap-4 ${COLUMNAS}`}
              >
                <span />
                <span>Edificio</span>
                <span>Unidades</span>
                <span>Reclamos</span>
                <span />
              </div>
              <ul className="divide-y divide-stone-100">
                {visibles.map((ed) => (
                  <FilaEdificio
                    key={ed.id}
                    edificio={ed}
                    reclamos={abiertos[ed.id] ?? 0}
                    unidades={unidades ? (unidades[ed.id] ?? 0) : null}
                  />
                ))}
              </ul>
            </>
          )}

          {edificios?.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-stone-500">
              Todavía no hay edificios cargados.
            </p>
          )}

          {edificios?.length > 0 && visibles.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-medium text-stone-800">
                {busqueda.trim()
                  ? `No encontramos edificios para «${busqueda.trim()}»`
                  : "No hay edificios con reclamos abiertos"}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Probá con otra palabra o revisá la ortografía.
              </p>
              <button
                type="button"
                onClick={limpiarFiltros}
                className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
              >
                Ver todos los edificios
              </button>
            </div>
          )}
        </div>

        {listError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {listError}
          </div>
        )}
      </main>
    </div>
  );
}
