import { useEffect, useState } from "react";
import { Link } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";
import PopoverForm, { PopoverFormButton } from "../components/PopoverForm";

function obtenerEdificios() {
  return supabase.from("edificio").select("*").order("nombre");
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

export default function AdminEdificios() {
  const [edificios, setEdificios] = useState(null);
  const [listError, setListError] = useState(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState(null);
  const [creadoOk, setCreadoOk] = useState(false);

  async function refrescarEdificios() {
    const { data, error } = await obtenerEdificios();
    if (error) {
      setListError(error.message);
      return;
    }
    setListError(null);
    setEdificios(data);
  }

  useEffect(() => {
    async function cargarInicial() {
      const { data, error } = await obtenerEdificios();
      if (error) {
        setListError(error.message);
        return;
      }
      setListError(null);
      setEdificios(data);
    }
    cargarInicial();
  }, []);

  async function handleCrearEdificio(e) {
    e.preventDefault();
    setCreando(true);
    setFormError(null);

    const { error } = await supabase.from("edificio").insert({
      nombre,
      direccion,
      ciudad: ciudad || null,
      provincia: provincia || null,
      codigo_postal: codigoPostal || null,
    });

    setCreando(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    refrescarEdificios();
    setCreadoOk(true);
    setTimeout(() => {
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

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-stone-900">Edificios</h1>
          <button
            type="button"
            onClick={() => setFormAbierto((v) => !v)}
            className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 sm:w-auto sm:py-2"
          >
            {formAbierto ? "Cancelar" : "+ Nuevo edificio"}
          </button>
        </div>

        <PopoverForm
          open={formAbierto}
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

            <PopoverFormButton
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
        </PopoverForm>

        {/* Mobile: tarjetas */}
        <div className="mt-6 space-y-3 sm:hidden">
          {edificios?.map((ed) => (
            <Link
              key={ed.id}
              href={`/admin/edificios/${ed.id}`}
              className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-amber-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
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
                  {ed.nombre}
                </p>
                <p className="truncate text-sm text-stone-500">
                  {ed.direccion}
                  {ed.ciudad ? ` · ${ed.ciudad}` : ""}
                </p>
              </div>
            </Link>
          ))}
          {edificios?.length === 0 && (
            <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-500 shadow-sm">
              Todavía no hay edificios cargados.
            </p>
          )}
        </div>

        {/* sm+: tabla */}
        <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                <th className="px-4 py-3 font-medium">Ciudad</th>
              </tr>
            </thead>
            <tbody>
              {edificios?.map((ed) => (
                <tr
                  key={ed.id}
                  className="border-b border-stone-100 last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/edificios/${ed.id}`}
                      className="font-medium text-stone-900 hover:text-amber-700 hover:underline"
                    >
                      {ed.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{ed.direccion}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {ed.ciudad || "—"}
                  </td>
                </tr>
              ))}
              {edificios?.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-stone-500"
                  >
                    Todavía no hay edificios cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
