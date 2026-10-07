import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/auth-context/use-auth";
import {
  actualizarAnuncio,
  crearAnuncio,
  eliminarAnuncio,
  fetchAnunciosDeEdificio,
} from "../../services/anuncios";
import { formatearFechaHora } from "../../utils/fechas";
import { mensajeDeError } from "../../utils/supabase-errors";
import ConfirmDialog from "../ConfirmDialog";
import ModalForm, { ModalFormButton } from "../ModalForm";

const MAX_TITULO = 120;
const MAX_CONTENIDO = 4000;

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

function Contador({ valor, maximo }) {
  return (
    <span className="text-xs text-stone-400">
      {valor.length}/{maximo}
    </span>
  );
}

export default function AnunciosTab({ edificio }) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [anuncios, setAnuncios] = useState(null);
  const [listaError, setListaError] = useState(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [publicadoOk, setPublicadoOk] = useState(false);
  const [formError, setFormError] = useState(null);
  const cierreRef = useRef(null);

  const [editandoId, setEditandoId] = useState(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editError, setEditError] = useState(null);

  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const data = await fetchAnunciosDeEdificio(edificio.id);
        if (activo) setAnuncios(data);
      } catch (error) {
        if (activo) {
          setListaError(
            mensajeDeError(error, "No se pudieron cargar los anuncios."),
          );
          setAnuncios([]);
        }
      }
    }
    cargar();
    return () => {
      activo = false;
      clearTimeout(cierreRef.current);
    };
  }, [edificio.id]);

  async function handlePublicar(e) {
    e.preventDefault();
    setPublicando(true);
    setFormError(null);
    try {
      const nuevo = await crearAnuncio({
        edificioId: edificio.id,
        titulo,
        contenido,
        userId,
      });
      setAnuncios((actuales) => [nuevo, ...(actuales || [])]);
      setPublicadoOk(true);
      cierreRef.current = setTimeout(() => {
        setFormAbierto(false);
        setPublicadoOk(false);
        setTitulo("");
        setContenido("");
      }, 1400);
    } catch (error) {
      setFormError(mensajeDeError(error, "No se pudo publicar el anuncio."));
    } finally {
      setPublicando(false);
    }
  }

  function empezarEdicion(anuncio) {
    setEditandoId(anuncio.id);
    setEditTitulo(anuncio.titulo);
    setEditContenido(anuncio.contenido);
    setEditError(null);
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault();
    setGuardando(true);
    setEditError(null);
    try {
      const actualizado = await actualizarAnuncio(editandoId, {
        titulo: editTitulo,
        contenido: editContenido,
      });
      setAnuncios((actuales) =>
        actuales.map((a) => (a.id === actualizado.id ? actualizado : a)),
      );
      setEditandoId(null);
    } catch (error) {
      setEditError(mensajeDeError(error, "No se pudo guardar el anuncio."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      await eliminarAnuncio(aEliminar.id);
      setAnuncios((actuales) => actuales.filter((a) => a.id !== aEliminar.id));
      setAEliminar(null);
    } catch (error) {
      setListaError(mensajeDeError(error, "No se pudo eliminar el anuncio."));
      setAEliminar(null);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Anuncios del edificio
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Los ven los vecinos de {edificio.nombre} en su portal de anuncios y
            les llegan a la campanita.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormAbierto(true)}
          className="w-full shrink-0 whitespace-nowrap rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 sm:w-auto sm:py-2"
        >
          + Nuevo anuncio
        </button>
      </div>

      <ModalForm
        open={formAbierto}
        onClose={() => {
          setFormAbierto(false);
          setFormError(null);
        }}
        busy={publicando}
        success={publicadoOk}
        successTitle="¡Anuncio publicado!"
        successMessage={`Los vecinos de ${edificio.nombre} ya pueden verlo.`}
        title="Nuevo anuncio"
      >
        <form onSubmit={handlePublicar} className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="anuncio-titulo" className={labelClass}>
                Título
              </label>
              <Contador valor={titulo} maximo={MAX_TITULO} />
            </div>
            <input
              id="anuncio-titulo"
              type="text"
              required
              maxLength={MAX_TITULO}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={publicando}
              placeholder="Ej. Corte de agua el jueves"
              className={inputClass}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="anuncio-contenido" className={labelClass}>
                Mensaje
              </label>
              <Contador valor={contenido} maximo={MAX_CONTENIDO} />
            </div>
            <textarea
              id="anuncio-contenido"
              required
              rows={5}
              maxLength={MAX_CONTENIDO}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              disabled={publicando}
              placeholder="Qué pasa, cuándo y qué tienen que hacer los vecinos"
              className={inputClass}
            />
          </div>
          <ModalFormButton
            loading={publicando}
            label="Publicar anuncio"
            loadingLabel="Publicando..."
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

      {listaError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {listaError}
        </div>
      )}

      {anuncios === null && (
        <p className="mt-6 text-sm text-stone-500">Cargando anuncios...</p>
      )}

      <div className="mt-6 grid gap-3 lg:grid-cols-2 lg:items-start">
        {anuncios?.map((anuncio) =>
          editandoId === anuncio.id ? (
            <form
              key={anuncio.id}
              onSubmit={handleGuardarEdicion}
              className="space-y-3 rounded-2xl border border-amber-300 lg:col-span-2 bg-white p-4 shadow-sm sm:p-5"
            >
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="edit-titulo" className={labelClass}>
                    Título
                  </label>
                  <Contador valor={editTitulo} maximo={MAX_TITULO} />
                </div>
                <input
                  id="edit-titulo"
                  type="text"
                  required
                  maxLength={MAX_TITULO}
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  disabled={guardando}
                  className={inputClass}
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="edit-contenido" className={labelClass}>
                    Mensaje
                  </label>
                  <Contador valor={editContenido} maximo={MAX_CONTENIDO} />
                </div>
                <textarea
                  id="edit-contenido"
                  required
                  rows={5}
                  maxLength={MAX_CONTENIDO}
                  value={editContenido}
                  onChange={(e) => setEditContenido(e.target.value)}
                  disabled={guardando}
                  className={inputClass}
                />
              </div>
              {editError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {editError}
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditandoId(null)}
                  disabled={guardando}
                  className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-300"
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          ) : (
            <article
              key={anuncio.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-stone-900">
                    {anuncio.titulo}
                  </h3>
                  <p className="mt-0.5 text-xs text-stone-400">
                    Publicado el {formatearFechaHora(anuncio.creado_en)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => empezarEdicion(anuncio)}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAEliminar(anuncio)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line break-words text-sm text-stone-700">
                {anuncio.contenido}
              </p>
            </article>
          ),
        )}
        {anuncios?.length === 0 && !listaError && (
          <p className="rounded-2xl border border-stone-200 bg-white px-4 py-8 text-center lg:col-span-2 text-sm text-stone-500 shadow-sm">
            Todavía no publicaste anuncios en este edificio.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={!!aEliminar}
        title="¿Eliminar este anuncio?"
        message={
          aEliminar &&
          `"${aEliminar.titulo}" va a dejar de verse para todos los vecinos, también en su historial. Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        pending={eliminando}
        onConfirm={handleEliminar}
        onCancel={() => setAEliminar(null)}
      />
    </>
  );
}
