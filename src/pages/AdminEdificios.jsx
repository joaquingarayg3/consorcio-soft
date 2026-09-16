import { useEffect, useState } from "react";
import { Link } from "wouter";
import supabase from "../supabase-client";
import AppHeader from "../components/AppHeader";

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

    setNombre("");
    setDireccion("");
    setCiudad("");
    setProvincia("");
    setCodigoPostal("");
    setFormAbierto(false);
    refrescarEdificios();
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader>
        <Link
          href="/home"
          className="text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline"
        >
          ← Volver
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-stone-900">Edificios</h1>
          <button
            type="button"
            onClick={() => setFormAbierto((v) => !v)}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900"
          >
            {formAbierto ? "Cancelar" : "+ Nuevo edificio"}
          </button>
        </div>

        {formAbierto && (
          <form
            onSubmit={handleCrearEdificio}
            className="mt-4 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
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

            <button
              type="submit"
              disabled={creando}
              className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {creando ? "Creando..." : "Crear edificio"}
            </button>

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {formError}
              </div>
            )}
          </form>
        )}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
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
