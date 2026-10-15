import { useEffect, useMemo, useState } from "react";
import {
  actualizarEsquema,
  despublicarEsquema,
  fetchCoeficientesDeEsquema,
  fetchEsquema,
  fetchUnidadesDeEdificio,
  guardarCoeficientes,
  nuevaVersionEsquema,
  publicarEsquema,
} from "../../services/coeficientes";
import {
  METODOS,
  formatearPorcentaje,
  fraccionAPorcentajeTexto,
  normalizarNombre,
  porcentajeAFraccion,
  sumaCierra,
} from "../../utils/coeficientes";
import { formatearFecha, formatearFechaHora, hoy } from "../../utils/fechas";
import { mensajeDeError } from "../../utils/supabase-errors";
import { TIPOS_UNIDAD, compararUnidades } from "../../utils/unidades";
import ConfirmDialog from "../ConfirmDialog";
import ModalForm, { ModalFormButton } from "../ModalForm";
import PegarCoeficientes from "./PegarCoeficientes";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";
const botonSecundario =
  "rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50";
const botonPrimario =
  "rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500";

const EXPLICACION = {
  manual: "Cargá el porcentaje de cada unidad, según el reglamento.",
  derivado:
    "Los valores se calculan solos: el de cada unidad en el esquema base, dividido por lo que suman las unidades que participan acá.",
  partes_iguales:
    "Los valores salen de repartir el 100% según el peso de cada unidad (por defecto 1: todas pagan lo mismo).",
};

const MAX_PESO = 9999;

// Pasa lo cargado en la tabla a los valores que va a tener cada unidad y a los
// errores de cada fila. Es la misma cuenta que hace la base al guardar, para ver
// la suma al instante (la base vuelve a calcular todo y es la que manda).
function calcular(metodo, filas, base) {
  const valores = {};
  const errores = {};
  const participantes = Object.entries(filas).filter(([, f]) => f.participa);

  if (metodo === "manual") {
    for (const [id, fila] of participantes) {
      if (String(fila.valor).trim() === "") {
        errores[id] = "Falta el valor";
        continue;
      }
      const fraccion = porcentajeAFraccion(fila.valor);
      if (fraccion === null) {
        errores[id] = "Escribí un porcentaje válido, por ejemplo 6,46";
      } else if (fraccion > 1) {
        errores[id] = "No puede superar el 100%";
      } else {
        valores[id] = fraccion;
      }
    }
  } else if (metodo === "partes_iguales") {
    const pesos = {};
    let total = 0;
    for (const [id, fila] of participantes) {
      const peso = Number(String(fila.peso).replace(",", "."));
      if (!(peso > 0) || peso > MAX_PESO) {
        errores[id] = `El peso tiene que ser mayor que 0 y hasta ${MAX_PESO}`;
      } else {
        pesos[id] = peso;
        total += peso;
      }
    }
    for (const [id, peso] of Object.entries(pesos)) valores[id] = peso / total;
  } else {
    const deLaBase = {};
    let total = 0;
    for (const [id] of participantes) {
      const valorBase = base?.valores?.[id];
      if (valorBase === undefined) {
        errores[id] = "No participa en el esquema base";
      } else {
        deLaBase[id] = valorBase;
        total += valorBase;
      }
    }
    for (const [id, valorBase] of Object.entries(deLaBase)) {
      valores[id] = total > 0 ? valorBase / total : 0;
    }
  }

  const suma = Object.values(valores).reduce(
    (acumulado, v) => acumulado + v,
    0,
  );
  return { valores, errores, suma, cantidad: participantes.length };
}

function filasIniciales(unidades, participantes) {
  const porUnidad = Object.fromEntries(
    participantes.map((p) => [p.unidad_id, p]),
  );
  return Object.fromEntries(
    unidades.map((unidad) => {
      const p = porUnidad[unidad.id];
      return [
        unidad.id,
        {
          participa: Boolean(p),
          valor: p ? fraccionAPorcentajeTexto(p.valor) : "",
          peso: p ? String(p.peso).replace(".", ",") : "1",
        },
      ];
    }),
  );
}

function Insignia({ clase, children }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${clase}`}>
      {children}
    </span>
  );
}

function Cuerpo({ datos, aviso, onRecargar, onVolver, onAbrir }) {
  const { esquema, unidades, participantes, base } = datos;
  const editable = esquema.estado === "borrador";
  const metodo = esquema.metodo;

  const ordenadas = useMemo(
    () => [...unidades].sort(compararUnidades),
    [unidades],
  );
  const identificadorPorId = useMemo(
    () => Object.fromEntries(unidades.map((u) => [u.id, u.identificador])),
    [unidades],
  );

  const [inicial] = useState(() => filasIniciales(unidades, participantes));
  const [filas, setFilas] = useState(inicial);
  const [hoyTexto] = useState(hoy);

  const [ocupado, setOcupado] = useState(null); // 'guardando' | 'publicando' | 'despublicando'
  const [error, setError] = useState(null);
  const [dialogo, setDialogo] = useState(null); // 'pegar' | 'publicar' | 'despublicar' | 'version' | 'datos' | 'salir'

  const [fechaVersion, setFechaVersion] = useState("");
  const [formError, setFormError] = useState(null);
  const [guardandoForm, setGuardandoForm] = useState(false);
  const [datosNombre, setDatosNombre] = useState(esquema.nombre);
  const [datosDesde, setDatosDesde] = useState(esquema.vigente_desde);
  const [datosHasta, setDatosHasta] = useState(esquema.vigente_hasta ?? "");
  const [datosTolerancia, setDatosTolerancia] = useState(
    fraccionAPorcentajeTexto(esquema.tolerancia),
  );

  const calculo = useMemo(
    () => calcular(metodo, filas, base),
    [metodo, filas, base],
  );
  const valorGuardado = useMemo(
    () => Object.fromEntries(participantes.map((p) => [p.unidad_id, p.valor])),
    [participantes],
  );
  const sucio = useMemo(
    () => JSON.stringify(filas) !== JSON.stringify(inicial),
    [filas, inicial],
  );
  const hayErrores = Object.keys(calculo.errores).length > 0;
  const cierra = sumaCierra(calculo.suma, esquema.tolerancia);
  const sumaMostrada = editable
    ? calculo.suma
    : participantes.reduce((t, p) => t + p.valor, 0);
  const cierraMostrada = editable
    ? cierra
    : sumaCierra(sumaMostrada, esquema.tolerancia);
  const diferencia = sumaMostrada - 1;

  function cambiarFila(id, cambios) {
    setFilas((actuales) => ({
      ...actuales,
      [id]: { ...actuales[id], ...cambios },
    }));
  }

  function marcar(todas) {
    setFilas((actuales) =>
      Object.fromEntries(
        Object.entries(actuales).map(([id, fila]) => [
          id,
          {
            ...fila,
            participa:
              todas &&
              (metodo !== "derivado" || base?.valores?.[id] !== undefined),
          },
        ]),
      ),
    );
  }

  function aplicarPegado(encontradas) {
    setFilas((actuales) => {
      const siguientes = { ...actuales };
      for (const { unidadId, valor, peso } of encontradas) {
        siguientes[unidadId] = {
          ...siguientes[unidadId],
          participa: true,
          ...(valor !== undefined ? { valor } : {}),
          ...(peso !== undefined ? { peso } : {}),
        };
      }
      return siguientes;
    });
    setDialogo(null);
  }

  function filasParaGuardar() {
    return Object.entries(filas)
      .filter(([, fila]) => fila.participa)
      .map(([id, fila]) => {
        if (metodo === "manual")
          return { unidad_id: id, valor: calculo.valores[id] };
        if (metodo === "partes_iguales") {
          return {
            unidad_id: id,
            peso: Number(String(fila.peso).replace(",", ".")),
          };
        }
        return { unidad_id: id };
      });
  }

  // Guarda el borrador y vuelve a leer lo que calculó la base.
  async function guardar({ despues } = {}) {
    if (hayErrores) {
      setError("Corregí las filas marcadas en rojo antes de guardar.");
      return false;
    }
    setOcupado("guardando");
    setError(null);
    let guardado = false;
    try {
      await guardarCoeficientes(esquema.id, filasParaGuardar());
      guardado = true;
      if (despues) await despues();
      onRecargar(despues ? "Esquema publicado." : "Borrador guardado.");
      return true;
    } catch (falla) {
      const mensaje = mensajeDeError(
        falla,
        "No se pudo completar la operación.",
      );
      if (guardado) {
        // Se guardó, pero no se pudo publicar: se vuelve a leer lo guardado y se avisa.
        onRecargar(
          `El borrador se guardó, pero no se pudo publicar: ${mensaje}`,
          "error",
        );
      } else {
        setError(mensaje);
      }
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function handlePublicar() {
    setDialogo(null);
    await guardar({ despues: () => publicarEsquema(esquema.id) });
  }

  async function handleDespublicar() {
    setDialogo(null);
    setOcupado("despublicando");
    setError(null);
    try {
      await despublicarEsquema(esquema.id);
      onRecargar("El esquema volvió a borrador. Ya lo podés editar.");
    } catch (falla) {
      setError(mensajeDeError(falla, "No se pudo despublicar el esquema."));
    } finally {
      setOcupado(null);
    }
  }

  function abrirNuevaVersion() {
    const manana = new Date(`${hoyTexto}T00:00:00Z`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const sugerida = manana.toISOString().slice(0, 10);
    setFechaVersion(sugerida > esquema.vigente_desde ? sugerida : "");
    setFormError(null);
    setDialogo("version");
  }

  async function handleNuevaVersion(e) {
    e.preventDefault();
    if (!fechaVersion || fechaVersion <= esquema.vigente_desde) {
      setFormError(
        `La nueva versión tiene que empezar después del ${formatearFecha(esquema.vigente_desde)}.`,
      );
      return;
    }
    setGuardandoForm(true);
    setFormError(null);
    try {
      const nuevoId = await nuevaVersionEsquema(esquema.id, fechaVersion);
      onAbrir(nuevoId);
    } catch (falla) {
      setFormError(mensajeDeError(falla, "No se pudo crear la nueva versión."));
    } finally {
      setGuardandoForm(false);
    }
  }

  function abrirDatos() {
    setDatosNombre(esquema.nombre);
    setDatosDesde(esquema.vigente_desde);
    setDatosHasta(esquema.vigente_hasta ?? "");
    setDatosTolerancia(fraccionAPorcentajeTexto(esquema.tolerancia));
    setFormError(null);
    setDialogo("datos");
  }

  async function handleGuardarDatos(e) {
    e.preventDefault();
    const nombre = datosNombre.trim();
    const tolerancia = porcentajeAFraccion(datosTolerancia);
    if (!nombre) return setFormError("Escribí un nombre para el esquema.");
    if (tolerancia === null || tolerancia > 0.01) {
      return setFormError(
        "La tolerancia tiene que estar entre 0 y 1 (en porcentaje).",
      );
    }
    if (!datosDesde) return setFormError("Elegí desde cuándo rige.");
    if (datosHasta && datosHasta <= datosDesde) {
      return setFormError(
        "La fecha de fin tiene que ser posterior a la de inicio.",
      );
    }
    setGuardandoForm(true);
    setFormError(null);
    try {
      await actualizarEsquema(esquema.id, {
        nombre,
        tolerancia,
        vigente_desde: datosDesde,
        vigente_hasta: datosHasta || null,
      });
      setDialogo(null);
      onRecargar("Datos del esquema guardados.");
    } catch (falla) {
      setFormError(mensajeDeError(falla, "No se pudieron guardar los datos."));
    } finally {
      setGuardandoForm(false);
    }
  }

  const textoEstado = editable ? "Borrador" : "Publicado";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <button
          type="button"
          onClick={() => (sucio ? setDialogo("salir") : onVolver())}
          className="mb-3 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          ← Esquemas del edificio
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-stone-900">
              <span className="font-mono">{esquema.codigo}</span>
              {normalizarNombre(esquema.nombre) !==
                normalizarNombre(esquema.codigo) && (
                <span className="font-normal text-stone-500">
                  · {esquema.nombre}
                </span>
              )}
              <Insignia
                clase={
                  editable
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-100 text-green-700"
                }
              >
                {textoEstado}
              </Insignia>
              <Insignia clase="bg-stone-100 text-stone-700">
                {METODOS[metodo]}
                {base ? ` de ${base.esquema.codigo}` : ""}
              </Insignia>
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Rige desde el {formatearFecha(esquema.vigente_desde)}
              {esquema.vigente_hasta
                ? ` hasta el ${formatearFecha(esquema.vigente_hasta)}`
                : ", sin fecha de fin"}
              . Tolerancia: {formatearPorcentaje(esquema.tolerancia)}.
            </p>
            <p className="mt-1 text-sm text-stone-600">{EXPLICACION[metodo]}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {editable ? (
              <button
                type="button"
                onClick={abrirDatos}
                className={botonSecundario}
              >
                Editar datos
              </button>
            ) : (
              <>
                {!esquema.vigente_hasta && (
                  <button
                    type="button"
                    onClick={abrirNuevaVersion}
                    disabled={ocupado !== null}
                    className={botonPrimario}
                  >
                    Nueva versión
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDialogo("despublicar")}
                  disabled={ocupado !== null}
                  className={botonSecundario}
                >
                  Despublicar para corregir
                </button>
              </>
            )}
          </div>
        </div>

        {!editable && (
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
            No se edita: si fue un error de carga, despublicalo y corregilo; si
            cambió el reglamento, creá una nueva versión con su fecha de inicio
            (publicado el {formatearFechaHora(esquema.publicado_en)}).
          </p>
        )}
      </div>

      {aviso && (
        <div
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-sm ${
            aviso.tipo === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {aviso.texto}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
          <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
            Unidades ({calculo.cantidad} de {ordenadas.length} participan)
          </p>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => marcar(true)}
                className={botonSecundario}
              >
                Marcar todas
              </button>
              <button
                type="button"
                onClick={() => marcar(false)}
                className={botonSecundario}
              >
                Desmarcar todas
              </button>
              <button
                type="button"
                onClick={() => setDialogo("pegar")}
                className={botonSecundario}
              >
                Pegar desde Excel
              </button>
            </div>
          )}
        </div>

        {ordenadas.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-stone-500">
            Este edificio todavía no tiene unidades. Cargalas en la pestaña
            Unidades.
          </p>
        )}

        <ul className="divide-y divide-stone-100">
          {ordenadas.map((unidad) => {
            const fila = filas[unidad.id];
            const errorFila = calculo.errores[unidad.id];
            const noEnBase =
              metodo === "derivado" && base?.valores?.[unidad.id] === undefined;
            const calculado = editable
              ? calculo.valores[unidad.id]
              : valorGuardado[unidad.id];
            const participa = editable
              ? fila.participa
              : unidad.id in valorGuardado;
            return (
              <li
                key={unidad.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${
                  participa ? "" : "bg-stone-50/60"
                }`}
              >
                <input
                  id={`participa-${unidad.id}`}
                  type="checkbox"
                  checked={participa}
                  disabled={!editable || (noEnBase && !fila.participa)}
                  onChange={(e) =>
                    cambiarFila(unidad.id, { participa: e.target.checked })
                  }
                  aria-label={`${unidad.identificador} participa`}
                  className="h-5 w-5 shrink-0 rounded border-stone-300 accent-brand-700"
                />
                <label
                  htmlFor={`participa-${unidad.id}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <span
                    className={`block truncate font-medium ${participa ? "text-stone-900" : "text-stone-500"}`}
                  >
                    {unidad.identificador}
                    {unidad.numero_uf && (
                      <span className="ml-1.5 text-xs font-normal text-stone-400">
                        UF {unidad.numero_uf}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-stone-500">
                    {TIPOS_UNIDAD[unidad.tipo] ?? unidad.tipo}
                    {String(unidad.piso ?? "").trim()
                      ? ` · piso ${String(unidad.piso).trim()}`
                      : ""}
                    {unidad.unidad_principal_id
                      ? ` · anexa a ${identificadorPorId[unidad.unidad_principal_id] ?? "otra unidad"}`
                      : ""}
                    {noEnBase ? " · no está en el esquema base" : ""}
                  </span>
                </label>

                {participa && metodo === "manual" && editable && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Porcentaje de ${unidad.identificador}`}
                      aria-invalid={errorFila ? "true" : undefined}
                      placeholder="0,00"
                      value={fila.valor}
                      onChange={(e) =>
                        cambiarFila(unidad.id, { valor: e.target.value })
                      }
                      disabled={ocupado !== null}
                      className={`${inputClass} w-28 text-right font-mono ${errorFila ? "border-red-400" : ""}`}
                    />
                    <span aria-hidden="true" className="text-stone-500">
                      %
                    </span>
                  </div>
                )}

                {participa && metodo === "partes_iguales" && editable && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-stone-500">
                      Peso
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Peso de ${unidad.identificador}`}
                        aria-invalid={errorFila ? "true" : undefined}
                        value={fila.peso}
                        onChange={(e) =>
                          cambiarFila(unidad.id, { peso: e.target.value })
                        }
                        disabled={ocupado !== null}
                        className={`${inputClass} w-20 text-right font-mono ${errorFila ? "border-red-400" : ""}`}
                      />
                    </label>
                  </div>
                )}

                {participa &&
                  (metodo !== "manual" || !editable) &&
                  calculado !== undefined && (
                    <span className="w-28 text-right font-mono text-sm text-stone-700">
                      {formatearPorcentaje(calculado)}
                    </span>
                  )}

                {errorFila && (
                  <p
                    role="alert"
                    className="basis-full pl-8 text-xs text-red-700"
                  >
                    {errorFila}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite">
            <p className="text-sm text-stone-600">
              Suma:{" "}
              <span
                className={`text-lg font-semibold ${
                  cierraMostrada ? "text-green-700" : "text-red-700"
                }`}
              >
                {formatearPorcentaje(sumaMostrada)}
              </span>{" "}
              de 100%
            </p>
            <p className="text-xs text-stone-500">
              {cierraMostrada
                ? editable
                  ? "Cierra: se puede publicar."
                  : "Cierra en 100%."
                : diferencia < 0
                  ? `Faltan ${formatearPorcentaje(-diferencia)} para llegar a 100%.`
                  : `Sobran ${formatearPorcentaje(diferencia)}.`}
              {editable && sucio ? " · Hay cambios sin guardar." : ""}
            </p>
          </div>
          {editable && (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => guardar()}
                disabled={ocupado !== null || !sucio}
                className={botonSecundario}
              >
                {ocupado === "guardando" ? "Guardando..." : "Guardar borrador"}
              </button>
              <button
                type="button"
                onClick={() => setDialogo("publicar")}
                disabled={
                  ocupado !== null || hayErrores || calculo.cantidad === 0
                }
                className={botonPrimario}
              >
                Publicar
              </button>
            </div>
          )}
        </div>
      </div>

      <ModalForm
        open={dialogo === "pegar"}
        onClose={() => setDialogo(null)}
        title="Pegar desde Excel"
        description="Completá la tabla con lo que copiaste de la planilla."
      >
        <PegarCoeficientes
          unidades={unidades}
          metodo={metodo}
          onAplicar={aplicarPegado}
          onCancelar={() => setDialogo(null)}
        />
      </ModalForm>

      <ModalForm
        open={dialogo === "version"}
        onClose={() => setDialogo(null)}
        busy={guardandoForm}
        title="Nueva versión"
        description={`Se copia ${esquema.codigo} con sus valores actuales y se corrige como borrador. La versión actual deja de regir cuando empieza la nueva.`}
      >
        <form onSubmit={handleNuevaVersion} className="space-y-4">
          <div>
            <label htmlFor="fecha-version" className={labelClass}>
              La nueva versión rige desde
            </label>
            <input
              id="fecha-version"
              type="date"
              required
              min={esquema.vigente_desde}
              value={fechaVersion}
              onChange={(e) => setFechaVersion(e.target.value)}
              disabled={guardandoForm}
              className={inputClass}
            />
          </div>
          <ModalFormButton
            loading={guardandoForm}
            label="Crear nueva versión"
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
      </ModalForm>

      <ModalForm
        open={dialogo === "datos"}
        onClose={() => setDialogo(null)}
        busy={guardandoForm}
        title="Datos del esquema"
        description="El código y el método no se cambian: si hace falta, creá otro esquema."
      >
        <form onSubmit={handleGuardarDatos} className="space-y-4">
          <div>
            <label htmlFor="datos-nombre" className={labelClass}>
              Nombre
            </label>
            <input
              id="datos-nombre"
              type="text"
              required
              maxLength={80}
              value={datosNombre}
              onChange={(e) => setDatosNombre(e.target.value)}
              disabled={guardandoForm}
              className={inputClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="datos-desde" className={labelClass}>
                Rige desde
              </label>
              <input
                id="datos-desde"
                type="date"
                required
                value={datosDesde}
                onChange={(e) => setDatosDesde(e.target.value)}
                disabled={guardandoForm}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="datos-hasta" className={labelClass}>
                Hasta{" "}
                <span className="font-normal text-stone-400">(opcional)</span>
              </label>
              <input
                id="datos-hasta"
                type="date"
                value={datosHasta}
                onChange={(e) => setDatosHasta(e.target.value)}
                disabled={guardandoForm}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="datos-tolerancia" className={labelClass}>
              Tolerancia para que sume 100%
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="datos-tolerancia"
                type="text"
                inputMode="decimal"
                value={datosTolerancia}
                onChange={(e) => setDatosTolerancia(e.target.value)}
                disabled={guardandoForm}
                className={`${inputClass} w-28 text-right font-mono`}
              />
              <span aria-hidden="true" className="text-stone-500">
                %
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Cuánto se puede apartar la suma de 100% para publicar. Por defecto
              0,01%.
            </p>
          </div>
          <ModalFormButton
            loading={guardandoForm}
            label="Guardar datos"
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
        open={dialogo === "publicar"}
        title="¿Publicar este esquema?"
        message={`Se guarda y se publica con ${calculo.cantidad} unidades que suman ${formatearPorcentaje(calculo.suma)}. Una vez publicado no se edita: para corregirlo hay que despublicarlo o crear una nueva versión.`}
        confirmLabel="Publicar"
        danger={false}
        onConfirm={handlePublicar}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === "despublicar"}
        title="¿Despublicar este esquema?"
        message="Vuelve a borrador para poder corregirlo. Usalo para arreglar un error de carga; si cambió el reglamento, creá una nueva versión."
        confirmLabel="Despublicar"
        onConfirm={handleDespublicar}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === "salir"}
        title="Hay cambios sin guardar"
        message="Si salís ahora, se pierde lo que cargaste desde la última vez que guardaste."
        confirmLabel="Salir sin guardar"
        onConfirm={onVolver}
        onCancel={() => setDialogo(null)}
      />
    </div>
  );
}

// Editor de un esquema: carga lo que hace falta y se lo pasa al cuerpo, que se
// vuelve a armar desde cero cada vez que se recargan los datos.
export default function EsquemaEditor({
  edificio,
  esquemaId,
  onVolver,
  onAbrir,
}) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const esquema = await fetchEsquema(esquemaId);
        if (!esquema || esquema.edificio_id !== edificio.id) {
          if (vigente) setError("No se encontró el esquema.");
          return;
        }
        const [unidades, participantes] = await Promise.all([
          fetchUnidadesDeEdificio(edificio.id),
          fetchCoeficientesDeEsquema(esquemaId),
        ]);
        let base = null;
        if (esquema.esquema_base_id) {
          const [esquemaBase, valoresBase] = await Promise.all([
            fetchEsquema(esquema.esquema_base_id),
            fetchCoeficientesDeEsquema(esquema.esquema_base_id),
          ]);
          base = {
            esquema: esquemaBase,
            valores: Object.fromEntries(
              valoresBase.map((f) => [f.unidad_id, f.valor]),
            ),
          };
        }
        if (vigente) {
          setError(null);
          setDatos({ esquema, unidades, participantes, base, version });
        }
      } catch (falla) {
        if (vigente) setError(mensajeDeError(falla));
      }
    }
    cargar();
    return () => {
      vigente = false;
    };
  }, [esquemaId, edificio.id, version]);

  if (error && !datos) {
    return (
      <div className="space-y-3">
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
        <button type="button" onClick={onVolver} className={botonSecundario}>
          ← Esquemas del edificio
        </button>
      </div>
    );
  }
  if (!datos)
    return <p className="text-sm text-stone-500">Cargando esquema...</p>;

  return (
    <Cuerpo
      key={`${datos.esquema.id}-${datos.version}`}
      datos={datos}
      aviso={aviso}
      onRecargar={(texto, tipo = "ok") => {
        setAviso(texto ? { texto, tipo } : null);
        setVersion((n) => n + 1);
      }}
      onVolver={onVolver}
      onAbrir={onAbrir}
    />
  );
}
