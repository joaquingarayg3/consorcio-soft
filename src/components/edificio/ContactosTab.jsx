import { useEffect, useState } from "react";
import {
  actualizarContacto,
  crearContacto,
  eliminarContacto,
  fetchContactos,
} from "../../services/contactos";
import { mensajeDeError } from "../../utils/supabase-errors";
import { enlaceTelefono, validarTelefono } from "../../utils/telefono";
import ConfirmDialog from "../ConfirmDialog";
import ModalForm, { ModalFormButton } from "../ModalForm";

const MAX_NOMBRE = 80;

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

const iconoTelefono = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </svg>
);

// Contactos útiles del edificio (ascensor, plomero, portería...). Los carga la
// administración y los ven los vecinos del edificio desde el botón de contactos
// de la cabecera.
export default function ContactosTab({ edificio }) {
  const [contactos, setContactos] = useState(null);
  const [cargaError, setCargaError] = useState(null);

  // null = cerrado; {} = contacto nuevo; {id, ...} = editando ese contacto
  const [editando, setEditando] = useState(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState(null);

  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [eliminarError, setEliminarError] = useState(null);

  useEffect(() => {
    let vigente = true;
    fetchContactos(edificio.id)
      .then((filas) => {
        if (vigente) setContactos(filas);
      })
      .catch((error) => {
        if (!vigente) return;
        setCargaError(mensajeDeError(error));
        setContactos([]);
      });
    return () => {
      vigente = false;
    };
  }, [edificio.id]);

  function abrirNuevo() {
    setEditando({});
    setNombre("");
    setTelefono("");
    setFormError(null);
  }

  function abrirEdicion(contacto) {
    setEditando(contacto);
    setNombre(contacto.nombre);
    setTelefono(contacto.telefono);
    setFormError(null);
  }

  async function handleGuardar(e) {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setFormError("Escribí un nombre para el contacto.");
      return;
    }
    const numero = validarTelefono(telefono);
    if (numero.error) {
      setFormError(numero.error);
      return;
    }

    setGuardando(true);
    setFormError(null);
    try {
      const datos = { nombre: nombreLimpio, telefono: numero.valor };
      if (editando.id) {
        const guardado = await actualizarContacto(editando.id, datos);
        setContactos((actuales) =>
          actuales.map((c) => (c.id === guardado.id ? guardado : c)),
        );
      } else {
        const guardado = await crearContacto(edificio.id, datos);
        setContactos((actuales) => [...actuales, guardado]);
      }
      setEditando(null);
    } catch (error) {
      setFormError(
        mensajeDeError(
          error,
          "No se pudo guardar el contacto. Probá de nuevo.",
        ),
      );
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    setEliminarError(null);
    try {
      await eliminarContacto(aEliminar.id);
      setContactos((actuales) => actuales.filter((c) => c.id !== aEliminar.id));
      setAEliminar(null);
    } catch (error) {
      setEliminarError(
        mensajeDeError(error, "No se pudo eliminar el contacto."),
      );
    } finally {
      setEliminando(false);
    }
  }

  return (
    <section
      aria-labelledby="contactos-titulo"
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="contactos-titulo"
            className="text-lg font-semibold text-stone-900"
          >
            Contactos del edificio
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Los ven los vecinos de {edificio.nombre} desde el botón del teléfono
            de la cabecera. Cargá, por ejemplo, el servicio de ascensores, el
            plomero o la portería.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="w-full shrink-0 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 sm:w-auto sm:py-2"
        >
          + Nuevo contacto
        </button>
      </div>

      {cargaError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {cargaError}
        </div>
      )}

      {contactos === null && !cargaError && (
        <p className="mt-4 text-sm text-stone-500">Cargando contactos...</p>
      )}

      {contactos?.length === 0 && !cargaError && (
        <p className="mt-5 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
          Todavía no hay contactos. Agregá el primero con «Nuevo contacto».
        </p>
      )}

      {contactos?.length > 0 && (
        <ul className="mt-5 divide-y divide-stone-100 rounded-xl border border-stone-200">
          {contactos.map((contacto) => (
            <li
              key={contacto.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"
                >
                  {iconoTelefono}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">
                    {contacto.nombre}
                  </p>
                  <a
                    href={enlaceTelefono(contacto.telefono)}
                    className="text-sm text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
                  >
                    {contacto.telefono}
                  </a>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => abrirEdicion(contacto)}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEliminarError(null);
                    setAEliminar(contacto);
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ModalForm
        open={editando !== null}
        onClose={() => setEditando(null)}
        busy={guardando}
        title={editando?.id ? "Editar contacto" : "Nuevo contacto"}
        description="Lo ven los vecinos de este edificio."
      >
        <form onSubmit={handleGuardar} noValidate className="space-y-4">
          <div>
            <label htmlFor="contacto-nombre" className={labelClass}>
              Nombre del contacto
            </label>
            <input
              id="contacto-nombre"
              type="text"
              required
              autoComplete="off"
              maxLength={MAX_NOMBRE}
              placeholder="Ej.: Mantenimiento ascensor"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={guardando}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="contacto-telefono" className={labelClass}>
              Teléfono
            </label>
            <input
              id="contacto-telefono"
              type="tel"
              required
              autoComplete="off"
              inputMode="tel"
              maxLength={30}
              placeholder="Ej.: 011 4444-5555"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              disabled={guardando}
              className={inputClass}
            />
          </div>

          <ModalFormButton
            loading={guardando}
            label="Guardar contacto"
            loadingLabel="Guardando..."
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

      <ConfirmDialog
        open={!!aEliminar}
        title="¿Eliminar este contacto?"
        message={
          aEliminar && (
            <>
              <strong>{aEliminar.nombre}</strong> dejará de verse para los
              vecinos de {edificio.nombre}.
              {eliminarError && (
                <span className="mt-2 block text-red-700">{eliminarError}</span>
              )}
            </>
          )
        }
        confirmLabel="Eliminar"
        pending={eliminando}
        onConfirm={handleEliminar}
        onCancel={() => setAEliminar(null)}
      />
    </section>
  );
}
