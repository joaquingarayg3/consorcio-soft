import { useState } from "react";
import supabase from "../../supabase-client";
import { mensajeDeError } from "../../utils/supabase-errors";
import { CODIGO_EDIFICIO, normalizarCodigo } from "../../utils/tickets";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

export default function DatosTab({ edificio, onSaved }) {
  const [nombre, setNombre] = useState(edificio.nombre);
  const [codigo, setCodigo] = useState(edificio.codigo || "");
  const [direccion, setDireccion] = useState(edificio.direccion);
  const [ciudad, setCiudad] = useState(edificio.ciudad || "");
  const [provincia, setProvincia] = useState(edificio.provincia || "");
  const [codigoPostal, setCodigoPostal] = useState(
    edificio.codigo_postal || "",
  );
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [guardadoError, setGuardadoError] = useState(null);

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardadoError(null);
    setGuardadoOk(false);

    if (!CODIGO_EDIFICIO.test(codigo)) {
      setGuardadoError(
        "El código tiene que tener entre 2 y 5 letras o números.",
      );
      return;
    }
    setGuardando(true);

    const { data, error } = await supabase
      .from("edificio")
      .update({
        nombre,
        codigo,
        direccion,
        ciudad: ciudad || null,
        provincia: provincia.trim(),
        codigo_postal: codigoPostal || null,
      })
      .eq("id", edificio.id)
      .select()
      .single();

    setGuardando(false);

    if (error) {
      setGuardadoError(
        error.code === "23505"
          ? "Ese código ya lo usa otro edificio. Elegí uno distinto."
          : mensajeDeError(error),
      );
      return;
    }
    onSaved(data);
    setGuardadoOk(true);
  }

  return (
    <form
      onSubmit={handleGuardar}
      className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:grid-cols-2 lg:gap-x-6"
    >
      <h2 className="text-lg font-semibold text-stone-900 lg:col-span-2">
        Datos del edificio
      </h2>

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
          disabled={guardando}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="codigo" className={labelClass}>
          Código del edificio
        </label>
        <input
          id="codigo"
          type="text"
          required
          maxLength={5}
          autoComplete="off"
          spellCheck={false}
          value={codigo}
          onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
          disabled={guardando}
          className={`${inputClass} w-32 font-mono uppercase`}
        />
        <p className="mt-1 text-xs text-stone-500">
          Identifica sus reclamos ({codigo || "XX"}-0001...). Si lo cambiás, los
          reclamos ya cargados pasan a mostrar el código nuevo.
        </p>
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
          disabled={guardando}
          className={inputClass}
        />
      </div>

      <div className="flex gap-3 lg:col-span-2">
        <div className="flex-1">
          <label htmlFor="ciudad" className={labelClass}>
            Ciudad
          </label>
          <input
            id="ciudad"
            type="text"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            disabled={guardando}
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
            disabled={guardando}
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
            disabled={guardando}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={guardando}
        className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-base font-semibold lg:col-span-2 lg:w-auto lg:justify-self-end lg:px-8 text-white transition-colors hover:bg-brand-800 active:bg-brand-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
      >
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>

      {guardadoError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-2"
        >
          {guardadoError}
        </div>
      )}
      {guardadoOk && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 lg:col-span-2"
        >
          Cambios guardados.
        </div>
      )}
    </form>
  );
}
