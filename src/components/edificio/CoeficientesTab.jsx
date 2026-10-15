import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  crearEsquema,
  eliminarEsquema,
  fetchEsquemas,
  nuevaVersionEsquema,
} from "../../services/coeficientes";
import {
  METODOS,
  formatearPorcentaje,
  normalizarNombre,
  porcentajeAFraccion,
  situacionVigencia,
  sumaCierra,
} from "../../utils/coeficientes";
import { formatearFecha, hoy } from "../../utils/fechas";
import { puedeVolverAtras } from "../../utils/navegacion";
import { mensajeDeError } from "../../utils/supabase-errors";
import ConfirmDialog from "../ConfirmDialog";
import ModalForm, { ModalFormButton } from "../ModalForm";
import SegmentedControl from "../SegmentedControl";
import EsquemaEditor from "./EsquemaEditor";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

const CODIGOS_SUGERIDOS = [
  "GENERAL",
  "DPTOS",
  "COCHERAS",
  "LOCALES",
  "TASAS",
  "SECTOR_A",
  "SECTOR_B",
];

const OPCIONES_METODO = [
  {
    value: "manual",
    label: "Manual",
    activa: "bg-white text-stone-900 ring-1 ring-stone-300",
    punto: "bg-stone-500",
  },
  {
    value: "derivado",
    label: "Derivado",
    activa: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    punto: "bg-amber-500",
  },
  {
    value: "partes_iguales",
    label: "Partes iguales",
    activa: "bg-sky-100 text-sky-900 ring-1 ring-sky-300",
    punto: "bg-sky-500",
  },
];

const AYUDA_METODO = {
  manual: "Vos cargás el porcentaje de cada unidad, según el reglamento.",
  derivado:
    "Se calcula solo a partir de otro esquema, para un grupo de unidades (por ejemplo, un sector).",
  partes_iguales:
    "Reparte el 100% en partes iguales, o según un peso por unidad (por ejemplo, tasas).",
};

// Código de esquema: mayúsculas, números y guion bajo ("Sector A" → "SECTOR_A").
function normalizarCodigo(texto) {
  return String(texto ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 30);
}

const ETIQUETA_SITUACION = {
  vigente: { texto: "Vigente", clase: "bg-green-100 text-green-700" },
  futuro: { texto: "Futuro", clase: "bg-sky-100 text-sky-800" },
  anterior: { texto: "Anterior", clase: "bg-stone-200 text-stone-600" },
};

function TarjetaEsquema({
  esquema,
  base,
  fecha,
  onAbrir,
  onNuevaVersion,
  onEliminar,
}) {
  const borrador = esquema.estado === "borrador";
  const situacion = ETIQUETA_SITUACION[situacionVigencia(esquema, fecha)];
  const cierra = sumaCierra(esquema.suma, esquema.tolerancia);

  return (
    <li className="group relative rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/40 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAbrir(esquema.id)}
              className="font-mono text-base font-semibold text-stone-900 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
            >
              {esquema.codigo}
            </button>
            {normalizarNombre(esquema.nombre) !==
              normalizarNombre(esquema.codigo) && (
              <span className="text-sm text-stone-500">· {esquema.nombre}</span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                borrador
                  ? "bg-amber-100 text-amber-800"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {borrador ? "Borrador" : "Publicado"}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
              {METODOS[esquema.metodo]}
              {base ? ` de ${base.codigo}` : ""}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${situacion.clase}`}
            >
              {situacion.texto}
            </span>
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Desde el {formatearFecha(esquema.vigente_desde)}
            {esquema.vigente_hasta
              ? ` hasta el ${formatearFecha(esquema.vigente_hasta)}`
              : ", sin fecha de fin"}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-stone-600">
              {esquema.unidades === 1
                ? "1 unidad"
                : `${esquema.unidades} unidades`}{" "}
              · suma{" "}
            </span>
            <span
              className={`font-semibold ${
                esquema.unidades === 0
                  ? "text-stone-500"
                  : cierra
                    ? "text-green-700"
                    : "text-red-700"
              }`}
            >
              {formatearPorcentaje(esquema.suma)}
            </span>
            {esquema.unidades > 0 && !cierra && (
              <span className="text-red-700"> (no cierra en 100%)</span>
            )}
          </p>
        </div>

        <div className="relative z-10 flex shrink-0 flex-wrap gap-2">
          {!borrador && !esquema.vigente_hasta && (
            <button
              type="button"
              onClick={() => onNuevaVersion(esquema)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
            >
              Nueva versión
            </button>
          )}
          {borrador && (
            <button
              type="button"
              onClick={() => onEliminar(esquema)}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function ListaEsquemas({ edificio, onAbrir }) {
  const [esquemas, setEsquemas] = useState(null);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [fecha] = useState(hoy);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [metodo, setMetodo] = useState("manual");
  const [baseId, setBaseId] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [toleranciaTexto, setToleranciaTexto] = useState("0,01");
  const [formAbierto, setFormAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState(null);

  const [paraEliminar, setParaEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [eliminarError, setEliminarError] = useState(null);

  const [paraVersion, setParaVersion] = useState(null);
  const [fechaVersion, setFechaVersion] = useState("");
  const [creandoVersion, setCreandoVersion] = useState(false);
  const [versionError, setVersionError] = useState(null);

  useEffect(() => {
    let vigente = true;
    fetchEsquemas(edificio.id)
      .then((filas) => {
        if (!vigente) return;
        setError(null);
        setEsquemas(filas);
      })
      .catch((falla) => {
        if (!vigente) return;
        setError(mensajeDeError(falla));
        setEsquemas([]);
      });
    return () => {
      vigente = false;
    };
  }, [edificio.id, recarga]);

  const porId = useMemo(
    () => Object.fromEntries((esquemas ?? []).map((e) => [e.id, e])),
    [esquemas],
  );

  function abrirFormulario() {
    setCodigo(esquemas?.some((e) => e.codigo === "GENERAL") ? "" : "GENERAL");
    setNombre("");
    setMetodo("manual");
    setBaseId("");
    setDesde(fecha);
    setToleranciaTexto("0,01");
    setFormError(null);
    setFormAbierto(true);
  }

  async function handleCrear(e) {
    e.preventDefault();
    const codigoFinal = normalizarCodigo(codigo);
    const nombreFinal = nombre.trim() || codigoFinal;
    const tolerancia = porcentajeAFraccion(toleranciaTexto);
    if (!codigoFinal) {
      setFormError("Elegí un código para el esquema (por ejemplo, GENERAL).");
      return;
    }
    if (metodo === "derivado" && !baseId) {
      setFormError("Elegí el esquema del que se deriva.");
      return;
    }
    if (tolerancia === null || tolerancia > 0.01) {
      setFormError(
        "La tolerancia tiene que estar entre 0 y 1 (en porcentaje).",
      );
      return;
    }

    setGuardando(true);
    setFormError(null);
    try {
      const id = await crearEsquema({
        edificioId: edificio.id,
        codigo: codigoFinal,
        nombre: nombreFinal,
        metodo,
        baseId: metodo === "derivado" ? baseId : null,
        desde,
        tolerancia,
      });
      setFormAbierto(false);
      onAbrir(id);
    } catch (falla) {
      setFormError(mensajeDeError(falla, "No se pudo crear el esquema."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!paraEliminar) return;
    setEliminando(true);
    setEliminarError(null);
    try {
      await eliminarEsquema(paraEliminar.id);
      setParaEliminar(null);
      setRecarga((n) => n + 1);
    } catch (falla) {
      setEliminarError(
        mensajeDeError(falla, "No se pudo eliminar el esquema."),
      );
    } finally {
      setEliminando(false);
    }
  }

  function abrirNuevaVersion(esquema) {
    const manana = new Date(`${fecha}T00:00:00Z`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const sugerida = manana.toISOString().slice(0, 10);
    setParaVersion(esquema);
    setFechaVersion(sugerida > esquema.vigente_desde ? sugerida : "");
    setVersionError(null);
  }

  async function handleNuevaVersion(e) {
    e.preventDefault();
    if (!paraVersion) return;
    if (!fechaVersion || fechaVersion <= paraVersion.vigente_desde) {
      setVersionError(
        `La nueva versión tiene que empezar después del ${formatearFecha(paraVersion.vigente_desde)}.`,
      );
      return;
    }
    setCreandoVersion(true);
    setVersionError(null);
    try {
      const id = await nuevaVersionEsquema(paraVersion.id, fechaVersion);
      setParaVersion(null);
      onAbrir(id);
    } catch (falla) {
      setVersionError(
        mensajeDeError(falla, "No se pudo crear la nueva versión."),
      );
    } finally {
      setCreandoVersion(false);
    }
  }

  return (
    <section
      aria-labelledby="coeficientes-titulo"
      className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="coeficientes-titulo"
            className="text-lg font-semibold text-stone-900"
          >
            Esquemas de coeficientes
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm text-stone-500">
            Cada esquema reparte el 100% de un tipo de gasto entre las unidades
            que participan. Se publica cuando suma 100%; lo publicado no se
            edita (si cambia el reglamento se crea una nueva versión).
          </p>
        </div>
        <button
          type="button"
          onClick={abrirFormulario}
          className="w-full shrink-0 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 sm:w-auto sm:py-2"
        >
          + Nuevo esquema
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {esquemas === null && !error && (
        <p className="mt-4 text-sm text-stone-500">Cargando esquemas...</p>
      )}
      {esquemas?.length === 0 && !error && (
        <p className="mt-5 rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Este edificio todavía no tiene esquemas. Empezá por el GENERAL, con
          los coeficientes del reglamento.
        </p>
      )}

      {esquemas?.length > 0 && (
        <ul className="mt-5 space-y-3">
          {esquemas.map((esquema) => (
            <TarjetaEsquema
              key={esquema.id}
              esquema={esquema}
              base={
                esquema.esquema_base_id ? porId[esquema.esquema_base_id] : null
              }
              fecha={fecha}
              onAbrir={onAbrir}
              onNuevaVersion={abrirNuevaVersion}
              onEliminar={(e) => {
                setEliminarError(null);
                setParaEliminar(e);
              }}
            />
          ))}
        </ul>
      )}

      <ModalForm
        open={formAbierto}
        onClose={() => setFormAbierto(false)}
        busy={guardando}
        title="Nuevo esquema"
        description="Se crea como borrador: después cargás los valores y lo publicás."
      >
        <form onSubmit={handleCrear} noValidate className="space-y-4">
          <div>
            <label htmlFor="esquema-codigo" className={labelClass}>
              Código
            </label>
            <input
              id="esquema-codigo"
              type="text"
              list="codigos-sugeridos"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={30}
              placeholder="GENERAL"
              value={codigo}
              onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
              disabled={guardando}
              className={`${inputClass} font-mono`}
            />
            <datalist id="codigos-sugeridos">
              {CODIGOS_SUGERIDOS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-stone-500">
              Letras, números y guion bajo. Es el nombre corto del esquema.
            </p>
          </div>
          <div>
            <label htmlFor="esquema-nombre" className={labelClass}>
              Nombre{" "}
              <span className="font-normal text-stone-400">(opcional)</span>
            </label>
            <input
              id="esquema-nombre"
              type="text"
              maxLength={80}
              placeholder="Como lo llama la administración"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={guardando}
              className={inputClass}
            />
          </div>
          <SegmentedControl
            legend="Cómo se calcula"
            value={metodo}
            onChange={setMetodo}
            options={OPCIONES_METODO}
            disabled={guardando}
          />
          <p className="-mt-2 text-xs text-stone-500">{AYUDA_METODO[metodo]}</p>

          {metodo === "derivado" && (
            <div>
              <label htmlFor="esquema-base" className={labelClass}>
                Se deriva de
              </label>
              <select
                id="esquema-base"
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                disabled={guardando}
                className={inputClass}
              >
                <option value="">Elegí un esquema</option>
                {(esquemas ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · desde {formatearFecha(e.vigente_desde)}
                    {e.estado === "borrador" ? " (borrador)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="esquema-desde" className={labelClass}>
              Rige desde
            </label>
            <input
              id="esquema-desde"
              type="date"
              required
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              disabled={guardando}
              className={inputClass}
            />
          </div>

          <details className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-stone-700">
              Opciones avanzadas
            </summary>
            <div className="mt-3">
              <label htmlFor="esquema-tolerancia" className={labelClass}>
                Tolerancia para que sume 100%
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="esquema-tolerancia"
                  type="text"
                  inputMode="decimal"
                  value={toleranciaTexto}
                  onChange={(e) => setToleranciaTexto(e.target.value)}
                  disabled={guardando}
                  className={`${inputClass} w-28 text-right font-mono`}
                />
                <span aria-hidden="true" className="text-stone-500">
                  %
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Cuánto se puede apartar la suma de 100% para poder publicar. Si
                los valores del reglamento vienen redondeados y no cierran
                justo, se sube acá solo para este esquema.
              </p>
            </div>
          </details>

          <ModalFormButton
            loading={guardando}
            label="Crear esquema"
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
        open={!!paraVersion}
        onClose={() => setParaVersion(null)}
        busy={creandoVersion}
        title="Nueva versión"
        description={
          paraVersion
            ? `Se copia ${paraVersion.codigo} con sus valores actuales y se corrige como borrador. La versión actual deja de regir cuando empieza la nueva.`
            : ""
        }
      >
        <form onSubmit={handleNuevaVersion} className="space-y-4">
          <div>
            <label htmlFor="version-fecha" className={labelClass}>
              La nueva versión rige desde
            </label>
            <input
              id="version-fecha"
              type="date"
              required
              min={paraVersion?.vigente_desde}
              value={fechaVersion}
              onChange={(e) => setFechaVersion(e.target.value)}
              disabled={creandoVersion}
              className={inputClass}
            />
          </div>
          <ModalFormButton
            loading={creandoVersion}
            label="Crear nueva versión"
            loadingLabel="Creando..."
          />
          {versionError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {versionError}
            </div>
          )}
        </form>
      </ModalForm>

      <ConfirmDialog
        open={!!paraEliminar}
        title="¿Eliminar este esquema?"
        message={
          paraEliminar && (
            <>
              Se borra el borrador <strong>{paraEliminar.codigo}</strong> con
              todos sus valores. No se puede deshacer.
              {eliminarError && (
                <span className="mt-2 block text-red-700">{eliminarError}</span>
              )}
            </>
          )
        }
        confirmLabel="Eliminar"
        pending={eliminando}
        onConfirm={handleEliminar}
        onCancel={() => setParaEliminar(null)}
      />
    </section>
  );
}

// Pestaña "Coeficientes" de un edificio: la lista de esquemas y, al abrir uno
// (/coeficientes?esquema=ID), su editor.
export default function CoeficientesTab({ edificio }) {
  const search = useSearch();
  const [, navigate] = useLocation();
  const esquemaId = new URLSearchParams(search).get("esquema");
  const ruta = `/admin/edificios/${edificio.id}/coeficientes`;

  // Al abrir un esquema desde la lista se anota en el historial que la pantalla
  // anterior es la lista: así "Volver" usa la flecha del navegador (sin apilar
  // pantallas repetidas) pero solo cuando de verdad lleva a la lista. Si se
  // pasa de un esquema a otro (nueva versión) se reemplaza la entrada, para que
  // el historial no guarde esquemas intermedios.
  const abrirDesdeLista = (id) =>
    navigate(`${ruta}?esquema=${id}`, { state: { desdeLista: true } });
  const abrirDesdeEditor = (id) =>
    navigate(`${ruta}?esquema=${id}`, {
      replace: true,
      state: window.history.state?.desdeLista ? { desdeLista: true } : null,
    });
  const volver = () => {
    if (window.history.state?.desdeLista && puedeVolverAtras()) {
      window.history.back();
    } else {
      navigate(ruta, { replace: true });
    }
  };

  if (esquemaId) {
    return (
      <EsquemaEditor
        edificio={edificio}
        esquemaId={esquemaId}
        onVolver={volver}
        onAbrir={abrirDesdeEditor}
      />
    );
  }
  return <ListaEsquemas edificio={edificio} onAbrir={abrirDesdeLista} />;
}
