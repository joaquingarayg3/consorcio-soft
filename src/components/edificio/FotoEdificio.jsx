import { useId, useState } from "react";
import { useUrlsFotos } from "../../hooks/useUrlsFotos";
import {
  quitarFotoEdificio,
  subirFotoEdificio,
} from "../../services/fotosEdificio";
import { prepararFotoEdificio } from "../../utils/imagen";
import { mensajeDeError } from "../../utils/supabase-errors";
import ConfirmDialog from "../ConfirmDialog";
import ImagenEdificio from "../ImagenEdificio";

// Foto del edificio (una sola). La ven los vecinos en su inicio. Al elegir un
// archivo se recorta a 16:9, se achica y se sube; la foto anterior se borra.
export default function FotoEdificio({ edificio, onChange }) {
  const idArchivo = useId();
  const urls = useUrlsFotos([edificio.foto_path]);
  const url = edificio.foto_path ? urls[edificio.foto_path] : null;

  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

  async function handleElegirArchivo(evento) {
    const archivo = evento.target.files?.[0];
    // Permite volver a elegir el mismo archivo más tarde.
    evento.target.value = "";
    if (!archivo) return;

    setTrabajando(true);
    setError(null);
    try {
      const preparada = await prepararFotoEdificio(archivo);
      const actualizado = await subirFotoEdificio(edificio, preparada);
      onChange(actualizado);
    } catch (fallo) {
      setError(mensajeDeError(fallo, "No se pudo subir la foto."));
    } finally {
      setTrabajando(false);
    }
  }

  async function handleQuitar() {
    setTrabajando(true);
    setError(null);
    try {
      const actualizado = await quitarFotoEdificio(edificio);
      onChange(actualizado);
    } catch (fallo) {
      setError(mensajeDeError(fallo, "No se pudo quitar la foto."));
    } finally {
      setTrabajando(false);
      setConfirmandoQuitar(false);
    }
  }

  return (
    <section
      aria-labelledby="foto-edificio-titulo"
      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <h2
        id="foto-edificio-titulo"
        className="text-lg font-semibold text-stone-900"
      >
        Foto del edificio
      </h2>
      <p className="mt-0.5 text-sm text-stone-500">
        La ven los vecinos de {edificio.nombre} en su inicio. Se recorta en
        formato apaisado y se achica sola.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-center">
        <div className="relative">
          {edificio.foto_path ? (
            url ? (
              <ImagenEdificio
                src={url}
                alt={`Foto de ${edificio.nombre}`}
                className="aspect-video w-full rounded-xl"
              />
            ) : (
              <div
                aria-hidden="true"
                className="aspect-video w-full animate-pulse rounded-xl bg-stone-200 motion-reduce:animate-none"
              />
            )
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-stone-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="11" r="2" />
                <path d="m21 16-5-5-8 8" />
              </svg>
              <span className="text-sm">Todavía no tiene foto</span>
            </div>
          )}
          {trabajando && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 text-sm font-medium text-stone-700"
            >
              Procesando...
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor={idArchivo}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-within:ring-2 focus-within:ring-brand-600/50 sm:w-fit ${
              trabajando ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {edificio.foto_path ? "Cambiar foto" : "Subir foto"}
            <input
              id={idArchivo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={trabajando}
              onChange={handleElegirArchivo}
              className="sr-only"
            />
          </label>
          {edificio.foto_path && (
            <button
              type="button"
              disabled={trabajando}
              onClick={() => setConfirmandoQuitar(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
            >
              Quitar foto
            </button>
          )}
          <p className="text-xs text-stone-500">
            JPG, PNG o WEBP, de al menos 640 px de ancho. En el celular podés
            sacarla en el momento.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <ConfirmDialog
        open={confirmandoQuitar}
        title="¿Quitar la foto del edificio?"
        message="Los vecinos van a dejar de verla en su inicio. Podés subir otra cuando quieras."
        confirmLabel="Quitar foto"
        pending={trabajando}
        onConfirm={handleQuitar}
        onCancel={() => setConfirmandoQuitar(false)}
      />
    </section>
  );
}
