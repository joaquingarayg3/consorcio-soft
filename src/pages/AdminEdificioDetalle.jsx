import { useEffect, useState } from "react";
import { Link, Redirect, useParams } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";
import ClaimsPanel from "../components/ClaimsPanel";
import UnidadesTab from "../components/edificio/UnidadesTab";
import DatosTab from "../components/edificio/DatosTab";
import AnunciosTab from "../components/edificio/AnunciosTab";
import { mensajeDeError } from "../utils/supabase-errors";

const TABS = [
  { key: "reclamos", label: "Reclamos" },
  { key: "unidades", label: "Unidades" },
  { key: "anuncios", label: "Anuncios" },
  { key: "datos", label: "Datos" },
];

function obtenerEdificio(id) {
  return supabase.from("edificio").select("*").eq("id", id).single();
}

export default function AdminEdificioDetalle() {
  const { id, tab = "reclamos" } = useParams();

  const [edificio, setEdificio] = useState(undefined);
  const [edificioError, setEdificioError] = useState(null);

  useEffect(() => {
    async function cargar() {
      const { data, error } = await obtenerEdificio(id);
      if (error) {
        setEdificioError(mensajeDeError(error));
        setEdificio(null);
        return;
      }
      setEdificio(data);
    }
    cargar();
  }, [id]);

  if (!TABS.some((t) => t.key === tab)) {
    return <Redirect to={`/admin/edificios/${id}/reclamos`} />;
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/admin/edificios" />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {edificioError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {edificioError}
          </div>
        )}

        {edificio === undefined && !edificioError && (
          <p className="text-sm text-stone-500">Cargando edificio...</p>
        )}

        {edificio === null && !edificioError && (
          <p className="text-stone-500">Edificio no encontrado.</p>
        )}

        {edificio && (
          <>
            <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <div
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <rect x="6" y="3" width="12" height="18" rx="1" />
                  <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
                  <path d="M3 21h18" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-stone-900">
                  {edificio.nombre}
                </h1>
                <p className="truncate text-sm text-stone-500">
                  {edificio.direccion}
                  {edificio.ciudad ? ` · ${edificio.ciudad}` : ""}
                </p>
              </div>
            </div>

            <nav
              aria-label="Secciones del edificio"
              className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-stone-200/60 p-1"
            >
              {TABS.map((t) => {
                const activa = t.key === tab;
                return (
                  <Link
                    key={t.key}
                    href={`/admin/edificios/${id}/${t.key}`}
                    aria-current={activa ? "page" : undefined}
                    className={`flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold sm:px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 ${
                      activa
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-5">
              {tab === "reclamos" && <ClaimsPanel edificio={edificio} />}
              {tab === "unidades" && (
                <div className="max-w-4xl">
                  <UnidadesTab edificioId={edificio.id} />
                </div>
              )}
              {tab === "anuncios" && (
                <div className="max-w-4xl">
                  <AnunciosTab edificio={edificio} />
                </div>
              )}
              {tab === "datos" && (
                <div className="max-w-2xl">
                  <DatosTab edificio={edificio} onSaved={setEdificio} />
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
