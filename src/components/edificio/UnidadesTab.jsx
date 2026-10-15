import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import supabase from "../../supabase-client";
import ConfirmDialog from "../ConfirmDialog";
import ModalForm, { ModalFormButton } from "../ModalForm";
import AsignarUsuarioForm from "./AsignarUsuarioForm";
import { fetchCoeficienteGeneral } from "../../services/coeficientes";
import { fetchUsuariosPorIds } from "../../services/usuarios";
import {
  formatearPorcentaje,
  sumarCoeficientes,
} from "../../utils/coeficientes";
import { asignacionVigente, hoy } from "../../utils/fechas";
import { compararUnidades } from "../../utils/unidades";
import { mensajeDeError } from "../../utils/supabase-errors";

function obtenerUnidades(edificioId) {
  return supabase
    .from("unidad_funcional")
    .select(
      "*, unidad_usuarios(id, usuario_id, vinculo, fecha_desde, fecha_hasta)",
    )
    .eq("edificio_id", edificioId)
    .order("identificador");
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";
const asignacionActiva = (a) => asignacionVigente(a);

// Supabase puede devolver una relación embebida como objeto único en vez de
// array si detecta (a veces por error, ej. una restricción UNIQUE mal puesta
// en la base) que la relación es "de a una". Esto la normaliza siempre a array.
function comoArray(valor) {
  if (Array.isArray(valor)) return valor;
  return valor ? [valor] : [];
}

// Solo se piden los perfiles de quienes ya están asignados (para mostrar sus
// nombres): con muchos usuarios no se puede traer a todos. A quién asignar se
// busca desde el modal.
async function cargarAsignados(unidades) {
  const ids = new Set();
  for (const unidad of unidades ?? []) {
    for (const asignacion of comoArray(unidad.unidad_usuarios)) {
      if (asignacionActiva(asignacion)) ids.add(asignacion.usuario_id);
    }
  }
  try {
    return await fetchUsuariosPorIds([...ids]);
  } catch (error) {
    console.error("No se pudieron cargar los usuarios asignados", error);
    return [];
  }
}

async function cargarCoeficienteGeneral(edificioId) {
  try {
    return await fetchCoeficienteGeneral(edificioId);
  } catch (error) {
    console.error("No se pudo cargar el coeficiente general", error);
    return null;
  }
}

export default function UnidadesTab({ edificioId }) {
  const [unidades, setUnidades] = useState(null);
  // { esquema, valores } del esquema GENERAL vigente; null si no se pudo leer.
  const [general, setGeneral] = useState(null);
  const [unidadesError, setUnidadesError] = useState(null);
  const [usuariosAsignados, setUsuariosAsignados] = useState([]);

  const [formUnidadAbierto, setFormUnidadAbierto] = useState(false);
  const [identificador, setIdentificador] = useState("");
  const [piso, setPiso] = useState("");
  const [tipo, setTipo] = useState("departamento");
  const [superficieM2, setSuperficieM2] = useState("");
  const [creandoUnidad, setCreandoUnidad] = useState(false);
  const [unidadFormError, setUnidadFormError] = useState(null);
  const [unidadCreadaOk, setUnidadCreadaOk] = useState(false);
  const cierreUnidadRef = useRef(null);

  const [unidadAsignando, setUnidadAsignando] = useState(null);
  const [asignando, setAsignando] = useState(false);
  const [asignarError, setAsignarError] = useState(null);
  const [asignadoA, setAsignadoA] = useState(null);
  const cierreAsignarRef = useRef(null);
  // El compilador de React lee estas dependencias en cada render: con la
  // ventana cerrada `unidadAsignando` es null, así que se toma el id acá.
  const unidadAsignandoId = unidadAsignando?.id;

  const [accionPendiente, setAccionPendiente] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const [editandoId, setEditandoId] = useState(null);
  const [editIdentificador, setEditIdentificador] = useState("");
  const [editNumeroUf, setEditNumeroUf] = useState("");
  const [editPrincipalId, setEditPrincipalId] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [editError, setEditError] = useState(null);

  const usuariosPorId = useMemo(
    () => Object.fromEntries(usuariosAsignados.map((u) => [u.id, u])),
    [usuariosAsignados],
  );

  const unidadesOrdenadas = useMemo(
    () => (unidades ? [...unidades].sort(compararUnidades) : unidades),
    [unidades],
  );

  const identificadorPorId = useMemo(
    () =>
      Object.fromEntries((unidades ?? []).map((u) => [u.id, u.identificador])),
    [unidades],
  );
  const sumaGeneral = sumarCoeficientes(general?.valores);
  const generalCierra =
    general?.esquema &&
    Math.abs(sumaGeneral - 1) <= Number(general.esquema.tolerancia);

  useEffect(() => {
    async function cargar() {
      const { data: unidadesData, error: unError } =
        await obtenerUnidades(edificioId);

      if (unError) setUnidadesError(mensajeDeError(unError));
      setUnidades(unidadesData || []);
      setUsuariosAsignados(await cargarAsignados(unidadesData));
      setGeneral(await cargarCoeficienteGeneral(edificioId));
    }
    cargar();
  }, [edificioId]);

  useEffect(
    () => () => {
      clearTimeout(cierreUnidadRef.current);
      clearTimeout(cierreAsignarRef.current);
    },
    [],
  );

  async function refrescarUnidades() {
    const { data, error } = await obtenerUnidades(edificioId);
    if (error) {
      setUnidadesError(mensajeDeError(error));
      return;
    }
    setUnidadesError(null);
    setUnidades(data);
    setUsuariosAsignados(await cargarAsignados(data));
    setGeneral(await cargarCoeficienteGeneral(edificioId));
  }

  async function handleCrearUnidad(e) {
    e.preventDefault();
    setUnidadFormError(null);

    setCreandoUnidad(true);

    const { error } = await supabase.from("unidad_funcional").insert({
      edificio_id: edificioId,
      identificador,
      piso: piso || null,
      tipo,
      superficie_m2: superficieM2 ? Number(superficieM2) : null,
    });

    setCreandoUnidad(false);

    if (error) {
      setUnidadFormError(
        error.code === "23505"
          ? "Ya hay una unidad con ese nombre en este edificio."
          : mensajeDeError(error),
      );
      return;
    }

    refrescarUnidades();
    setUnidadCreadaOk(true);
    cierreUnidadRef.current = setTimeout(() => {
      setFormUnidadAbierto(false);
      setUnidadCreadaOk(false);
      setIdentificador("");
      setPiso("");
      setTipo("departamento");
      setSuperficieM2("");
    }, 1400);
  }

  function empezarEdicion(unidad) {
    setEditandoId(unidad.id);
    setEditIdentificador(unidad.identificador);
    setEditNumeroUf(unidad.numero_uf ?? "");
    setEditPrincipalId(unidad.unidad_principal_id ?? "");
    setEditError(null);
  }

  async function handleGuardarEdicion(e, unidad) {
    e.preventDefault();
    setEditError(null);

    const nuevoIdentificador = editIdentificador.trim();
    if (!nuevoIdentificador) {
      setEditError("El nombre de la unidad no puede quedar vacío.");
      return;
    }

    // "UF 21", "uf21" y "21" son lo mismo: se guarda solo el número.
    const numeroUf = editNumeroUf.replace(/^uf\s*/i, "").trim();
    if (numeroUf.length > 20) {
      setEditError("El número de UF es demasiado largo.");
      return;
    }

    setGuardandoEdicion(true);
    const { error } = await supabase
      .from("unidad_funcional")
      .update({
        identificador: nuevoIdentificador,
        numero_uf: numeroUf || null,
        unidad_principal_id: editPrincipalId || null,
      })
      .eq("id", unidad.id)
      .select("id")
      .single();
    setGuardandoEdicion(false);

    if (error) {
      setEditError(
        error.code === "23505"
          ? "Ya hay una unidad con ese nombre en este edificio."
          : mensajeDeError(error),
      );
      return;
    }
    setEditandoId(null);
    refrescarUnidades();
  }

  async function handleEliminarUnidad(unidadId) {
    setAccionPendiente(unidadId);
    const { error } = await supabase
      .from("unidad_funcional")
      .delete()
      .eq("id", unidadId);
    setAccionPendiente(null);

    if (error) {
      setUnidadesError(mensajeDeError(error));
      return;
    }
    refrescarUnidades();
  }

  function empezarAsignacion(unidad) {
    setUnidadAsignando(unidad);
    setAsignarError(null);
    setAsignadoA(null);
  }

  function cerrarAsignacion() {
    setUnidadAsignando(null);
    setAsignarError(null);
    setAsignadoA(null);
  }

  async function handleAsignarUsuario(usuarioId, vinculo, nombreCompleto) {
    if (!unidadAsignandoId) return;
    setAsignando(true);
    setAsignarError(null);

    const { error } = await supabase.from("unidad_usuarios").insert({
      unidad_id: unidadAsignandoId,
      usuario_id: usuarioId,
      vinculo,
      fecha_desde: hoy(),
    });

    setAsignando(false);

    if (error) {
      setAsignarError(mensajeDeError(error));
      return;
    }

    refrescarUnidades();
    setAsignadoA(nombreCompleto || "El usuario");
    cierreAsignarRef.current = setTimeout(cerrarAsignacion, 1400);
  }

  async function handleFinalizarAsignacion(asignacionId) {
    setAccionPendiente(asignacionId);
    const { error } = await supabase
      .from("unidad_usuarios")
      .update({ fecha_hasta: hoy() })
      .eq("id", asignacionId);
    setAccionPendiente(null);

    if (error) {
      setUnidadesError(mensajeDeError(error));
      return;
    }
    refrescarUnidades();
  }

  async function handleConfirmarAccion() {
    if (!confirmacion) return;
    if (confirmacion.tipo === "eliminarUnidad") {
      await handleEliminarUnidad(confirmacion.id);
    } else if (confirmacion.tipo === "finalizarAsignacion") {
      await handleFinalizarAsignacion(confirmacion.id);
    }
    setConfirmacion(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Unidades funcionales
          </h2>
          {general?.esquema ? (
            <p className="mt-0.5 text-sm text-stone-500">
              Coeficiente general:{" "}
              <span
                className={
                  generalCierra
                    ? "font-semibold text-green-700"
                    : "font-semibold text-stone-700"
                }
              >
                {formatearPorcentaje(sumaGeneral)}
              </span>{" "}
              de 100%
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  general.esquema.estado === "publicado"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {general.esquema.estado === "publicado"
                  ? "Publicado"
                  : "Borrador"}
              </span>
            </p>
          ) : (
            general && (
              <p className="mt-0.5 text-sm text-stone-500">
                Todavía no hay coeficientes cargados para este edificio.
              </p>
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => setFormUnidadAbierto(true)}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900"
        >
          + Nueva unidad
        </button>
      </div>

      <ModalForm
        open={formUnidadAbierto}
        onClose={() => {
          setFormUnidadAbierto(false);
          setUnidadFormError(null);
        }}
        busy={creandoUnidad}
        success={unidadCreadaOk}
        successTitle="¡Unidad creada!"
        successMessage={`${identificador} ya está en la lista de unidades.`}
        title="Nueva unidad"
        description="Los coeficientes de prorrateo se cargan aparte, no acá."
      >
        <form onSubmit={handleCrearUnidad} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="identificador" className={labelClass}>
                Identificador
              </label>
              <input
                id="identificador"
                type="text"
                required
                placeholder='ej. "3B"'
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                disabled={creandoUnidad}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="piso" className={labelClass}>
                Piso
              </label>
              <input
                id="piso"
                type="text"
                value={piso}
                onChange={(e) => setPiso(e.target.value)}
                disabled={creandoUnidad}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="tipo" className={labelClass}>
              Tipo
            </label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={creandoUnidad}
              className={inputClass}
            >
              <option value="departamento">Departamento</option>
              <option value="cochera">Cochera</option>
              <option value="baulera">Baulera</option>
              <option value="local">Local</option>
              <option value="oficina">Oficina</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label htmlFor="superficieM2" className={labelClass}>
              Superficie (m²)
            </label>
            <input
              id="superficieM2"
              type="number"
              min="0"
              step="0.01"
              value={superficieM2}
              onChange={(e) => setSuperficieM2(e.target.value)}
              disabled={creandoUnidad}
              className={inputClass}
            />
          </div>

          <ModalFormButton
            loading={creandoUnidad}
            label="Crear unidad"
            loadingLabel="Creando..."
          />

          {unidadFormError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {unidadFormError}
            </div>
          )}
        </form>
      </ModalForm>

      <ModalForm
        open={!!unidadAsignando}
        onClose={cerrarAsignacion}
        busy={asignando}
        success={!!asignadoA}
        successTitle="¡Usuario asignado!"
        successMessage={`${asignadoA} ya está vinculado/a a ${
          unidadAsignando?.identificador ?? "la unidad"
        }.`}
        title={`Asignar usuario a ${unidadAsignando?.identificador ?? ""}`}
        description="Buscá a la persona y elegí su vínculo con la unidad."
      >
        <AsignarUsuarioForm
          unidadId={unidadAsignandoId}
          asignando={asignando}
          error={asignarError}
          onAsignar={handleAsignarUsuario}
        />
      </ModalForm>

      <div className="mt-4 space-y-3">
        {unidadesOrdenadas?.map((u) => {
          const asignacionesActivas = comoArray(u.unidad_usuarios).filter(
            asignacionActiva,
          );
          const editando = editandoId === u.id;
          const coeficiente = general?.valores?.[u.id];
          const tieneAnexas = unidadesOrdenadas.some(
            (otra) => otra.unidad_principal_id === u.id,
          );
          const detalle = [
            u.numero_uf ? `UF ${u.numero_uf}` : null,
            u.superficie_m2 ? `${u.superficie_m2} m²` : null,
            coeficiente != null
              ? `${formatearPorcentaje(coeficiente)} coef. general`
              : null,
            u.unidad_principal_id
              ? `anexa a ${identificadorPorId[u.unidad_principal_id] ?? "otra unidad"}`
              : null,
          ].filter(Boolean);
          return (
            <div
              key={u.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                editando ? "border-amber-300" : "border-stone-200"
              }`}
            >
              {editando ? (
                <form
                  onSubmit={(e) => handleGuardarEdicion(e, u)}
                  aria-label={`Editar unidad ${u.identificador}`}
                  className="space-y-3"
                >
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`edit-nombre-${u.id}`}
                        className={labelClass}
                      >
                        Nombre
                      </label>
                      <input
                        id={`edit-nombre-${u.id}`}
                        type="text"
                        required
                        value={editIdentificador}
                        onChange={(e) => setEditIdentificador(e.target.value)}
                        disabled={guardandoEdicion}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`edit-uf-${u.id}`} className={labelClass}>
                        Número de UF{" "}
                        <span className="font-normal text-stone-400">
                          (opcional)
                        </span>
                      </label>
                      <input
                        id={`edit-uf-${u.id}`}
                        type="text"
                        autoComplete="off"
                        maxLength={24}
                        placeholder="Ej.: 21"
                        value={editNumeroUf}
                        onChange={(e) => setEditNumeroUf(e.target.value)}
                        disabled={guardandoEdicion}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-principal-${u.id}`}
                        className={labelClass}
                      >
                        Anexa a{" "}
                        <span className="font-normal text-stone-400">
                          (cochera o baulera de un depto.)
                        </span>
                      </label>
                      <select
                        id={`edit-principal-${u.id}`}
                        value={editPrincipalId}
                        onChange={(e) => setEditPrincipalId(e.target.value)}
                        disabled={guardandoEdicion || tieneAnexas}
                        className={inputClass}
                      >
                        <option value="">Ninguna (unidad propia)</option>
                        {unidadesOrdenadas
                          .filter(
                            (otra) =>
                              otra.id !== u.id && !otra.unidad_principal_id,
                          )
                          .map((otra) => (
                            <option key={otra.id} value={otra.id}>
                              {otra.identificador}
                            </option>
                          ))}
                      </select>
                      {tieneAnexas && (
                        <p className="mt-1 text-xs text-stone-500">
                          Tiene unidades anexas, así que no puede ser anexa de
                          otra.
                        </p>
                      )}
                    </div>
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
                      disabled={guardandoEdicion}
                      className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoEdicion}
                      className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                    >
                      {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">
                      {u.identificador}{" "}
                      <span className="font-normal text-stone-500">
                        · {u.tipo}
                        {String(u.piso ?? "").trim()
                          ? ` · piso ${String(u.piso).trim()}`
                          : ""}
                      </span>
                    </p>
                    {detalle.length > 0 && (
                      <p className="text-xs text-stone-400">
                        {detalle.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => empezarEdicion(u)}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => empezarAsignacion(u)}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
                    >
                      Asignar usuario
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmacion({
                          tipo: "eliminarUnidad",
                          id: u.id,
                          nombre: u.identificador,
                        })
                      }
                      disabled={accionPendiente === u.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}

              {asignacionesActivas.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
                  {asignacionesActivas.map((a) => {
                    const usuarioAsignado = usuariosPorId[a.usuario_id];
                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-stone-700">
                          {usuarioAsignado ? (
                            <Link
                              href={`/admin/usuarios/${usuarioAsignado.id}`}
                              className="font-medium hover:text-brand-700 hover:underline"
                            >
                              {usuarioAsignado.nombre}{" "}
                              {usuarioAsignado.apellido}
                            </Link>
                          ) : (
                            <span className="italic text-stone-400">
                              Usuario no disponible
                            </span>
                          )}{" "}
                          <span className="text-stone-500">({a.vinculo})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmacion({
                              tipo: "finalizarAsignacion",
                              id: a.id,
                              nombre: usuarioAsignado
                                ? `${usuarioAsignado.nombre} ${usuarioAsignado.apellido}`
                                : "este usuario",
                            })
                          }
                          disabled={accionPendiente === a.id}
                          className="text-xs font-medium text-stone-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Finalizar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
        {unidades?.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-500 shadow-sm">
            Todavía no hay unidades cargadas en este edificio.
          </p>
        )}
      </div>

      {unidadesError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {unidadesError}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmacion}
        title={
          confirmacion?.tipo === "eliminarUnidad"
            ? "¿Eliminar esta unidad?"
            : "¿Finalizar esta asignación?"
        }
        message={
          confirmacion?.tipo === "eliminarUnidad"
            ? `Se va a eliminar la unidad "${confirmacion?.nombre}" junto con sus asignaciones asociadas. Esta acción no se puede deshacer.`
            : `${confirmacion?.nombre} va a dejar de estar vinculado/a a esta unidad. Podés volver a asignarlo/a más adelante si hace falta.`
        }
        confirmLabel={
          confirmacion?.tipo === "eliminarUnidad" ? "Eliminar" : "Finalizar"
        }
        pending={accionPendiente === confirmacion?.id}
        onConfirm={handleConfirmarAccion}
        onCancel={() => setConfirmacion(null)}
      />
    </>
  );
}
