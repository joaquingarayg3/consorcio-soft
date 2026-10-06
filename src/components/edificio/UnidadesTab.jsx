import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import supabase from "../../supabase-client";
import ConfirmDialog from "../ConfirmDialog";
import { asignacionVigente, hoy } from "../../utils/fechas";
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

function obtenerUsuarios() {
  return supabase
    .from("perfiles")
    .select("id, nombre, apellido, email")
    .order("nombre");
}

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";
const asignacionActiva = (a) => asignacionVigente(a);

// Evita ruido de coma flotante al sumar porcentajes (33.33 + 33.33 + 33.34).
const redondear = (numero) => Math.round(numero * 100) / 100;

// Supabase puede devolver una relación embebida como objeto único en vez de
// array si detecta (a veces por error, ej. una restricción UNIQUE mal puesta
// en la base) que la relación es "de a una". Esto la normaliza siempre a array.
function comoArray(valor) {
  if (Array.isArray(valor)) return valor;
  return valor ? [valor] : [];
}

export default function UnidadesTab({ edificioId }) {
  const [unidades, setUnidades] = useState(null);
  const [unidadesError, setUnidadesError] = useState(null);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);

  const [formUnidadAbierto, setFormUnidadAbierto] = useState(false);
  const [identificador, setIdentificador] = useState("");
  const [piso, setPiso] = useState("");
  const [tipo, setTipo] = useState("departamento");
  const [superficieM2, setSuperficieM2] = useState("");
  const [porcentajeFiscal, setPorcentajeFiscal] = useState("");
  const [creandoUnidad, setCreandoUnidad] = useState(false);
  const [unidadFormError, setUnidadFormError] = useState(null);

  const [unidadAsignando, setUnidadAsignando] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [vinculo, setVinculo] = useState("propietario");
  const [asignando, setAsignando] = useState(false);
  const [asignarError, setAsignarError] = useState(null);

  const [accionPendiente, setAccionPendiente] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const [editandoId, setEditandoId] = useState(null);
  const [editIdentificador, setEditIdentificador] = useState("");
  const [editPorcentaje, setEditPorcentaje] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [editError, setEditError] = useState(null);

  const usuariosPorId = useMemo(
    () => Object.fromEntries(usuariosDisponibles.map((u) => [u.id, u])),
    [usuariosDisponibles],
  );

  const totalPorcentajeFiscal = redondear(
    (unidades || []).reduce(
      (acc, u) => acc + (u.porcentaje_fiscal ? Number(u.porcentaje_fiscal) : 0),
      0,
    ),
  );
  const disponiblePorcentajeFiscal = Math.max(
    0,
    redondear(100 - totalPorcentajeFiscal),
  );

  useEffect(() => {
    async function cargar() {
      const [{ data: unidadesData, error: unError }, { data: usuariosData }] =
        await Promise.all([obtenerUnidades(edificioId), obtenerUsuarios()]);

      if (unError) setUnidadesError(mensajeDeError(unError));
      setUnidades(unidadesData || []);
      setUsuariosDisponibles(usuariosData || []);
    }
    cargar();
  }, [edificioId]);

  async function refrescarUnidades() {
    const { data, error } = await obtenerUnidades(edificioId);
    if (error) {
      setUnidadesError(mensajeDeError(error));
      return;
    }
    setUnidadesError(null);
    setUnidades(data);
  }

  async function handleCrearUnidad(e) {
    e.preventDefault();
    setUnidadFormError(null);

    const nuevoPorcentaje = porcentajeFiscal ? Number(porcentajeFiscal) : 0;
    if (redondear(totalPorcentajeFiscal + nuevoPorcentaje) > 100) {
      setUnidadFormError(
        `El % fiscal ingresado (${nuevoPorcentaje}%) supera el disponible (${disponiblePorcentajeFiscal}%). Ya hay ${totalPorcentajeFiscal}% asignado en este edificio.`,
      );
      return;
    }

    setCreandoUnidad(true);

    const { error } = await supabase.from("unidad_funcional").insert({
      edificio_id: edificioId,
      identificador,
      piso: piso || null,
      tipo,
      superficie_m2: superficieM2 ? Number(superficieM2) : null,
      porcentaje_fiscal: Number(porcentajeFiscal || 0),
    });

    setCreandoUnidad(false);

    if (error) {
      setUnidadFormError(mensajeDeError(error));
      return;
    }

    setIdentificador("");
    setPiso("");
    setTipo("departamento");
    setSuperficieM2("");
    setPorcentajeFiscal("");
    setFormUnidadAbierto(false);
    refrescarUnidades();
  }

  function empezarEdicion(unidad) {
    setEditandoId(unidad.id);
    setEditIdentificador(unidad.identificador);
    setEditPorcentaje(String(unidad.porcentaje_fiscal ?? 0));
    setEditError(null);
    setUnidadAsignando(null);
  }

  async function handleGuardarEdicion(e, unidad) {
    e.preventDefault();
    setEditError(null);

    const nuevoIdentificador = editIdentificador.trim();
    const nuevoPorcentaje = Number(editPorcentaje);
    if (!nuevoIdentificador) {
      setEditError("El nombre de la unidad no puede quedar vacío.");
      return;
    }
    if (!Number.isFinite(nuevoPorcentaje) || nuevoPorcentaje < 0) {
      setEditError("Ingresá un porcentaje válido.");
      return;
    }
    // Lo que suman las demás unidades: la que se edita no cuenta contra sí misma.
    const otras = redondear(
      totalPorcentajeFiscal - Number(unidad.porcentaje_fiscal || 0),
    );
    if (redondear(otras + nuevoPorcentaje) > 100) {
      setEditError(
        `El % fiscal ingresado (${nuevoPorcentaje}%) supera el disponible (${redondear(100 - otras)}%). Las otras unidades suman ${otras}%.`,
      );
      return;
    }

    setGuardandoEdicion(true);
    const { error } = await supabase
      .from("unidad_funcional")
      .update({
        identificador: nuevoIdentificador,
        porcentaje_fiscal: nuevoPorcentaje,
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

  async function handleAsignarUsuario(e, unidadId) {
    e.preventDefault();
    setAsignando(true);
    setAsignarError(null);

    const { error } = await supabase.from("unidad_usuarios").insert({
      unidad_id: unidadId,
      usuario_id: usuarioSeleccionado,
      vinculo,
      fecha_desde: hoy(),
    });

    setAsignando(false);

    if (error) {
      setAsignarError(mensajeDeError(error));
      return;
    }

    setUsuarioSeleccionado("");
    setVinculo("propietario");
    setUnidadAsignando(null);
    refrescarUnidades();
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
          <p className="mt-0.5 text-sm text-stone-500">
            % fiscal asignado:{" "}
            <span
              className={
                totalPorcentajeFiscal >= 100
                  ? "font-semibold text-green-700"
                  : "font-semibold text-stone-700"
              }
            >
              {totalPorcentajeFiscal}%
            </span>{" "}
            de 100%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormUnidadAbierto((v) => !v)}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900"
        >
          {formUnidadAbierto ? "Cancelar" : "+ Nueva unidad"}
        </button>
      </div>

      {formUnidadAbierto && (
        <form
          onSubmit={handleCrearUnidad}
          className="mt-4 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        >
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
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
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
            <div className="flex-1">
              <label htmlFor="porcentajeFiscal" className={labelClass}>
                % fiscal{" "}
                <span className="font-normal text-stone-400">
                  (disponible: {disponiblePorcentajeFiscal}%)
                </span>
              </label>
              <input
                id="porcentajeFiscal"
                type="number"
                required
                min="0"
                max={disponiblePorcentajeFiscal}
                step="0.01"
                value={porcentajeFiscal}
                onChange={(e) => setPorcentajeFiscal(e.target.value)}
                disabled={creandoUnidad}
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creandoUnidad}
            className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300"
          >
            {creandoUnidad ? "Creando..." : "Crear unidad"}
          </button>

          {unidadFormError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {unidadFormError}
            </div>
          )}
        </form>
      )}

      <div className="mt-4 space-y-3">
        {unidades?.map((u) => {
          const asignacionesActivas = comoArray(u.unidad_usuarios).filter(
            asignacionActiva,
          );
          const editando = editandoId === u.id;
          const maximoEdicion = Math.max(
            0,
            redondear(
              100 - (totalPorcentajeFiscal - Number(u.porcentaje_fiscal || 0)),
            ),
          );
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
                    <div className="w-40 shrink-0">
                      <label
                        htmlFor={`edit-porcentaje-${u.id}`}
                        className={labelClass}
                      >
                        % fiscal{" "}
                        <span className="font-normal text-stone-400">
                          (máx. {maximoEdicion}%)
                        </span>
                      </label>
                      <input
                        id={`edit-porcentaje-${u.id}`}
                        type="number"
                        required
                        min="0"
                        max={maximoEdicion}
                        step="0.01"
                        value={editPorcentaje}
                        onChange={(e) => setEditPorcentaje(e.target.value)}
                        disabled={guardandoEdicion}
                        className={inputClass}
                      />
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
                      className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-300"
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
                        {u.piso ? ` · piso ${u.piso}` : ""}
                      </span>
                    </p>
                    {(u.superficie_m2 || u.porcentaje_fiscal) && (
                      <p className="text-xs text-stone-400">
                        {u.superficie_m2 ? `${u.superficie_m2} m²` : ""}
                        {u.superficie_m2 && u.porcentaje_fiscal ? " · " : ""}
                        {u.porcentaje_fiscal
                          ? `${u.porcentaje_fiscal}% fiscal`
                          : ""}
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
                      onClick={() =>
                        setUnidadAsignando((v) => (v === u.id ? null : u.id))
                      }
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
                              className="font-medium hover:text-amber-700 hover:underline"
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

              {unidadAsignando === u.id && (
                <form
                  onSubmit={(e) => handleAsignarUsuario(e, u.id)}
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3"
                >
                  <div className="min-w-[10rem] flex-1">
                    <label htmlFor={`usuario-${u.id}`} className={labelClass}>
                      Usuario
                    </label>
                    <select
                      id={`usuario-${u.id}`}
                      required
                      value={usuarioSeleccionado}
                      onChange={(e) => setUsuarioSeleccionado(e.target.value)}
                      disabled={asignando}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        Elegí un usuario
                      </option>
                      {usuariosDisponibles.map((usr) => (
                        <option key={usr.id} value={usr.id}>
                          {usr.nombre} {usr.apellido} — {usr.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-40">
                    <label htmlFor={`vinculo-${u.id}`} className={labelClass}>
                      Vínculo
                    </label>
                    <select
                      id={`vinculo-${u.id}`}
                      value={vinculo}
                      onChange={(e) => setVinculo(e.target.value)}
                      disabled={asignando}
                      className={inputClass}
                    >
                      <option value="propietario">Propietario</option>
                      <option value="inquilino">Inquilino</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={asignando}
                    className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300"
                  >
                    {asignando ? "Asignando..." : "Confirmar"}
                  </button>
                  {asignarError && (
                    <div
                      role="alert"
                      className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {asignarError}
                    </div>
                  )}
                </form>
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
