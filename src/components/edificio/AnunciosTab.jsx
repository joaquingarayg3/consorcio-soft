import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/auth-context/use-auth";
import {
  actualizarAnuncio,
  crearAnuncio,
  eliminarAnuncio,
  fetchAnunciosDeEdificio,
} from "../../services/anuncios";
import { useAhora } from "../../hooks/useAhora";
import {
  URGENCIA_VACIA,
  esUrgente,
  urgenciaDesdeAnuncio,
  urgenteHastaDesdeCampo,
} from "../../utils/anuncios";
import { formatearFechaHora } from "../../utils/fechas";
import { urlWhatsApp } from "../../utils/whatsapp";
import { mensajeDeError } from "../../utils/supabase-errors";
import ConfirmDialog from "../ConfirmDialog";
import ModalForm, { ModalFormButton } from "../ModalForm";
import CampoUrgente from "./CampoUrgente";

const MAX_TITULO = 120;
const MAX_CONTENIDO = 4000;

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

const CLAVE_COMPARTIR = "anuncios-abrir-whatsapp";

// Abrir WhatsApp al publicar viene activado; si se desactiva, se recuerda.
function leerCompartir() {
  try {
    return localStorage.getItem(CLAVE_COMPARTIR) !== "no";
  } catch {
    return true;
  }
}

function IconoWhatsApp({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.13 15.07l-.3-.18-3.1.82.83-3.03-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 3.9c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.27s.97 2.63 1.1 2.81c.14.18 1.9 3.03 4.7 4.13 2.32.91 2.8.73 3.3.68.5-.04 1.62-.66 1.85-1.3.23-.64.23-1.19.16-1.3-.07-.12-.25-.18-.52-.32-.27-.14-1.62-.8-1.87-.89-.25-.09-.43-.14-.61.14-.18.27-.7.89-.86 1.07-.16.18-.32.2-.59.07-.27-.14-1.16-.43-2.2-1.36-.81-.72-1.36-1.62-1.52-1.89-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.6-1.5-.84-2.05-.22-.5-.45-.51-.61-.52h-.52Z" />
    </svg>
  );
}

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
  const ahora = useAhora();

  const [anuncios, setAnuncios] = useState(null);
  const [listaError, setListaError] = useState(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [urgencia, setUrgencia] = useState(URGENCIA_VACIA);
  const [publicando, setPublicando] = useState(false);
  const [publicadoOk, setPublicadoOk] = useState(false);
  const [compartir, setCompartir] = useState(leerCompartir);
  const [abrioWhatsapp, setAbrioWhatsapp] = useState(false);
  // Si el navegador no dejó abrir la pestaña, el enlace queda acá para tocarlo.
  const [enlaceWhatsapp, setEnlaceWhatsapp] = useState(null);
  const [formError, setFormError] = useState(null);
  const cierreRef = useRef(null);

  const [editandoId, setEditandoId] = useState(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editContenido, setEditContenido] = useState("");
  const [editUrgencia, setEditUrgencia] = useState(URGENCIA_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [editError, setEditError] = useState(null);

  // Avisos urgentes que hoy siguen vigentes en este edificio: sirve para avisar
  // antes de sumar otro.
  const urgentesVigentes = (anuncios ?? []).filter((anuncio) =>
    esUrgente(anuncio, ahora),
  );

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
    setFormError(null);
    const { valor: urgenteHasta, error: urgenciaError } =
      urgenteHastaDesdeCampo(urgencia, Date.now());
    if (urgenciaError) {
      setFormError(urgenciaError);
      return;
    }

    // La pestaña de WhatsApp se abre ahora, dentro del clic: si se abriera recién
    // cuando la base responde, el navegador la bloquearía como ventana emergente.
    // Más abajo se completa con el mensaje.
    const ventana = compartir ? window.open("about:blank", "_blank") : null;
    if (ventana) ventana.opener = null;

    setPublicando(true);
    setEnlaceWhatsapp(null);
    try {
      const nuevo = await crearAnuncio({
        edificioId: edificio.id,
        titulo,
        contenido,
        userId,
        urgenteHasta,
      });
      setAnuncios((actuales) => [nuevo, ...(actuales || [])]);
      if (compartir) {
        const url = urlWhatsApp(nuevo.titulo, nuevo.contenido);
        if (ventana) {
          ventana.location.href = url;
        } else {
          setEnlaceWhatsapp(url);
        }
      }
      setAbrioWhatsapp(Boolean(compartir && ventana));
      setPublicadoOk(true);
      cierreRef.current = setTimeout(() => {
        setFormAbierto(false);
        setPublicadoOk(false);
        setTitulo("");
        setContenido("");
        setUrgencia(URGENCIA_VACIA);
      }, 1400);
    } catch (error) {
      // Si no se pudo publicar, no hay nada para enviar: se cierra la pestaña.
      ventana?.close();
      setFormError(mensajeDeError(error, "No se pudo publicar el anuncio."));
    } finally {
      setPublicando(false);
    }
  }

  function empezarEdicion(anuncio) {
    setEditandoId(anuncio.id);
    setEditTitulo(anuncio.titulo);
    setEditContenido(anuncio.contenido);
    setEditUrgencia(urgenciaDesdeAnuncio(anuncio, ahora));
    setEditError(null);
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault();
    setEditError(null);
    const { valor: urgenteHasta, error: urgenciaError } =
      urgenteHastaDesdeCampo(editUrgencia, Date.now());
    if (urgenciaError) {
      setEditError(urgenciaError);
      return;
    }
    setGuardando(true);
    try {
      const actualizado = await actualizarAnuncio(editandoId, {
        titulo: editTitulo,
        contenido: editContenido,
        urgenteHasta,
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
          className="w-full shrink-0 whitespace-nowrap rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 sm:w-auto sm:py-2"
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
        successMessage={`Los vecinos de ${edificio.nombre} ya pueden verlo.${
          abrioWhatsapp ? " Se abrió WhatsApp para enviarlo." : ""
        }`}
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
          <CampoUrgente
            idPrefijo="nuevo"
            value={urgencia}
            onChange={setUrgencia}
            ahora={ahora}
            otrosUrgentes={urgentesVigentes}
            disabled={publicando}
          />
          <label
            htmlFor="anuncio-whatsapp"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3"
          >
            <input
              id="anuncio-whatsapp"
              type="checkbox"
              checked={compartir}
              disabled={publicando}
              onChange={(e) => {
                setCompartir(e.target.checked);
                try {
                  localStorage.setItem(
                    CLAVE_COMPARTIR,
                    e.target.checked ? "si" : "no",
                  );
                } catch {
                  // sin almacenamiento: no se recuerda la elección
                }
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 accent-brand-700"
            />
            <span>
              <span className="block text-sm font-semibold text-stone-900">
                Abrir WhatsApp al publicar
              </span>
              <span className="block text-xs text-stone-500">
                Se abre en una pestaña nueva con el título y el mensaje, listo
                para que elijas a quién enviarlo.
              </span>
            </span>
          </label>
          <ModalFormButton
            loading={publicando}
            label={
              compartir ? "Publicar y enviar por WhatsApp" : "Publicar anuncio"
            }
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

      {enlaceWhatsapp && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900"
        >
          <p>
            El navegador no dejó abrir WhatsApp solo. Tocá el botón para enviar
            el anuncio.
          </p>
          <div className="flex items-center gap-2">
            <a
              href={enlaceWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setEnlaceWhatsapp(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/50"
            >
              <IconoWhatsApp />
              Abrir WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setEnlaceWhatsapp(null)}
              aria-label="Cerrar aviso"
              className="rounded px-1.5 text-lg leading-none text-green-800 hover:bg-green-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

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
              <CampoUrgente
                idPrefijo={`edit-${editandoId}`}
                value={editUrgencia}
                onChange={setEditUrgencia}
                ahora={ahora}
                otrosUrgentes={urgentesVigentes.filter(
                  (anuncio) => anuncio.id !== editandoId,
                )}
                disabled={guardando}
              />
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
                  className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
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
                  {anuncio.urgente_hasta && (
                    <p
                      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        esUrgente(anuncio, ahora)
                          ? "bg-brand-100 text-brand-800"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {esUrgente(anuncio, ahora)
                        ? `Urgente hasta el ${formatearFechaHora(anuncio.urgente_hasta)}`
                        : `Fue urgente hasta el ${formatearFechaHora(anuncio.urgente_hasta)}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={urlWhatsApp(anuncio.titulo, anuncio.contenido)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-800 transition-colors hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/40"
                  >
                    <IconoWhatsApp className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
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
