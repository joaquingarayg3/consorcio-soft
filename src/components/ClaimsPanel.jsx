import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";
import {
  createClaim,
  fetchClaimsForUser,
  fetchMyUnidadesFuncionales,
  updateClaimPriority,
} from "../services/claims";
import { ModalFormButton } from "./ModalForm";
import { mensajeDeError } from "../utils/supabase-errors";
import { coincideBusqueda } from "../utils/texto";

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50";
const labelClass =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500";
const statusLabels = {
  abierto: "Activo",
  en_curso: "En curso",
  cerrado: "Cerrado",
};
const priorities = ["Baja", "Media", "Alta", "Urgente"];

function titleOf(claim) {
  return claim.titulo || claim.title || "Reclamo sin título";
}
function dateOf(claim) {
  return claim.fecha_creacion || claim.createdAt;
}
function badgeClass(value) {
  if (value === "Urgente" || value === "Alta") return "bg-red-100 text-red-700";
  if (value === "Media") return "bg-amber-100 text-amber-800";
  if (value === "Cerrado" || value === "cerrado")
    return "bg-green-100 text-green-700";
  if (value === "En curso" || value === "en_curso")
    return "bg-blue-100 text-blue-700";
  return "bg-stone-100 text-stone-600";
}

function priorityFilterClass(value, selected) {
  const colors = {
    todas: "bg-stone-900 text-white",
    Baja: "bg-stone-100 text-stone-700",
    Media: "bg-amber-100 text-amber-800",
    Alta: "bg-orange-100 text-orange-800",
    Urgente: "bg-red-100 text-red-700",
  };
  return selected ? colors[value] : "text-stone-600 hover:bg-stone-100";
}

// Cada edificio tiene siempre el mismo color (según su id), para distinguirlos
// de un vistazo en la planilla. Se evitan rojo, verde y azul porque ya significan
// prioridad y estado. Con muchos edificios los colores se repiten: el nombre
// siempre está escrito, el color es una ayuda más.
const COLORES_EDIFICIO = [
  { chip: "bg-violet-100 text-violet-800", barra: "border-l-violet-400" },
  { chip: "bg-teal-100 text-teal-800", barra: "border-l-teal-400" },
  { chip: "bg-fuchsia-100 text-fuchsia-800", barra: "border-l-fuchsia-400" },
  { chip: "bg-cyan-100 text-cyan-800", barra: "border-l-cyan-400" },
  { chip: "bg-indigo-100 text-indigo-800", barra: "border-l-indigo-400" },
  { chip: "bg-lime-100 text-lime-800", barra: "border-l-lime-500" },
  { chip: "bg-pink-100 text-pink-800", barra: "border-l-pink-400" },
  { chip: "bg-slate-200 text-slate-700", barra: "border-l-slate-400" },
];

function colorDeEdificio(id) {
  const texto = String(id ?? "");
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = (hash * 31 + texto.charCodeAt(i)) % 1000003;
  }
  return COLORES_EDIFICIO[hash % COLORES_EDIFICIO.length];
}

function edificioDe(claim) {
  const unidad = claim.unidad_funcional;
  const edificio = unidad?.edificio;
  if (!edificio?.nombre) return null;
  return { id: edificio.id ?? unidad.edificio_id, nombre: edificio.nombre };
}

function EdificioChip({ edificio }) {
  if (!edificio) {
    return <span className="text-sm text-stone-400">Sin edificio</span>;
  }
  return (
    <span
      title={edificio.nombre}
      className={`inline-flex max-w-[11rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${colorDeEdificio(edificio.id).chip}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 shrink-0"
      >
        <rect x="6" y="3" width="12" height="18" rx="1" />
        <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01" />
        <path d="M3 21h18" />
      </svg>
      <span className="truncate">{edificio.nombre}</span>
    </span>
  );
}

function ClaimRow({
  claim,
  isAdmin,
  pending,
  onPriorityChange,
  edificioId,
  mostrarEdificio,
}) {
  const [, navigate] = useLocation();
  const priority = claim.prioridad || claim.priority || "Media";
  const status = claim.estado || claim.status || "abierto";
  const reporter = claim.reportante
    ? `${claim.reportante.nombre || ""} ${claim.reportante.apellido || ""}`.trim()
    : "Residente";
  // Dentro de un edificio, el detalle recuerda de dónde venís para volver ahí.
  const detailPath = `/reclamos/${claim.id}${edificioId ? `?edificio=${edificioId}` : ""}`;
  const edificio = mostrarEdificio ? edificioDe(claim) : null;
  return (
    <tr
      tabIndex="0"
      onClick={() => navigate(detailPath)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") navigate(detailPath);
      }}
      className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600/50"
    >
      <td
        className={`px-4 py-4 align-top text-xs font-medium text-stone-400 ${
          mostrarEdificio
            ? `border-l-4 ${edificio ? colorDeEdificio(edificio.id).barra : "border-l-stone-200"}`
            : ""
        }`}
      >
        {String(claim.id).slice(0, 8)}
      </td>
      <td className="min-w-[12rem] px-4 py-4 align-top">
        <p className="font-semibold text-stone-900">{titleOf(claim)}</p>
        <p className="mt-1 text-xs text-stone-500">
          {claim.categoria || claim.category || "General"}
        </p>
        {mostrarEdificio && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
            <EdificioChip edificio={edificioDe(claim)} />
            <span className="text-xs text-stone-500">
              {claim.unidad_funcional?.identificador || "Sin unidad"}
            </span>
          </p>
        )}
      </td>
      {mostrarEdificio && (
        <td className="hidden px-4 py-4 align-top sm:table-cell">
          <EdificioChip edificio={edificio} />
        </td>
      )}
      <td className="hidden px-4 py-4 align-top text-sm text-stone-600 sm:table-cell">
        {claim.unidad_funcional?.identificador || "Sin unidad"}
      </td>
      {isAdmin && (
        <td className="hidden px-4 py-4 align-top text-sm text-stone-600 md:table-cell">
          {reporter}
        </td>
      )}
      <td className="px-4 py-4 align-top">
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(priority)}`}
        >
          {priority}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(status)}`}
        >
          {statusLabels[status] || status}
        </span>
      </td>
      <td className="hidden px-4 py-4 align-top text-sm text-stone-500 lg:table-cell">
        {dateOf(claim)
          ? new Date(dateOf(claim)).toLocaleDateString("es-AR")
          : "-"}
      </td>
      {isAdmin && (
        <td
          className="px-4 py-4 align-top"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <select
              aria-label="Cambiar prioridad"
              value={priority}
              disabled={pending}
              onChange={(event) =>
                onPriorityChange(claim.id, event.target.value)
              }
              className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-700 focus:border-amber-600 focus:outline-none"
            >
              {priorities.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </td>
      )}
    </tr>
  );
}

function SummaryCard({ label, value, detail, alert = false }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold ${alert && value > 0 ? "text-red-700" : "text-stone-900"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-stone-500">{detail}</p>
    </div>
  );
}

// Con `agrupar`, los reclamos se ordenan por edificio y cada grupo lleva su
// encabezado con el nombre y la cantidad.
function agruparPorEdificio(claims) {
  const grupos = new Map();
  for (const claim of claims) {
    const edificio = edificioDe(claim);
    const clave = edificio?.id ?? "sin-edificio";
    if (!grupos.has(clave)) grupos.set(clave, { edificio, claims: [] });
    grupos.get(clave).claims.push(claim);
  }
  // "Sin edificio" siempre al final.
  return [...grupos.values()].sort((a, b) => {
    if (!a.edificio) return 1;
    if (!b.edificio) return -1;
    return a.edificio.nombre.localeCompare(b.edificio.nombre, "es");
  });
}

function ClaimsTable({
  claims,
  isAdmin,
  pending,
  onPriorityChange,
  edificioId,
  mostrarEdificio = false,
  agrupar = false,
}) {
  const columnas = 6 + (mostrarEdificio ? 1 : 0) + (isAdmin ? 2 : 0);
  const grupos = mostrarEdificio && agrupar ? agruparPorEdificio(claims) : null;
  const fila = (claim) => (
    <ClaimRow
      key={claim.id}
      claim={claim}
      isAdmin={isAdmin}
      onPriorityChange={onPriorityChange}
      pending={pending}
      edificioId={edificioId}
      mostrarEdificio={mostrarEdificio}
    />
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Reclamo</th>
            {mostrarEdificio && (
              <th className="hidden px-4 py-3 sm:table-cell">Edificio</th>
            )}
            <th className="hidden px-4 py-3 sm:table-cell">Unidad</th>
            {isAdmin && (
              <th className="hidden px-4 py-3 md:table-cell">Reportante</th>
            )}
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3">Estado</th>
            <th className="hidden px-4 py-3 lg:table-cell">Creado</th>
            {isAdmin && <th className="px-4 py-3">Acción</th>}
          </tr>
        </thead>
        {grupos ? (
          grupos.map((grupo) => (
            <tbody key={grupo.edificio?.id ?? "sin-edificio"}>
              <tr className="border-t border-stone-200 bg-stone-50/80">
                <td colSpan={columnas} className="px-4 py-2.5">
                  <span className="flex items-center gap-3">
                    <EdificioChip edificio={grupo.edificio} />
                    <span className="text-xs text-stone-500">
                      {grupo.claims.length}{" "}
                      {grupo.claims.length === 1 ? "reclamo" : "reclamos"}
                    </span>
                  </span>
                </td>
              </tr>
              {grupo.claims.map(fila)}
            </tbody>
          ))
        ) : (
          <tbody>{claims.map(fila)}</tbody>
        )}
      </table>
    </div>
  );
}

// Sin `edificio`: todos los reclamos que el usuario puede ver. Con `edificio`:
// solo los de ese edificio (así se usa dentro de la pantalla del edificio).
export default function ClaimsPanel({ edificio = null }) {
  const edificioId = edificio?.id ?? null;
  const { session, perfil } = useAuth();
  const isAdmin = perfil?.rol === "admin";
  const userId = session?.user?.id;
  const userEmail = session?.user?.email || "";
  const [claims, setClaims] = useState(null);
  const [units, setUnits] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [edificioFilter, setEdificioFilter] = useState("todos");
  const [agrupar, setAgrupar] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Mantenimiento general");
  const [priority, setPriority] = useState("Media");
  const [unitId, setUnitId] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);

  const loadClaims = useCallback(async () => {
    try {
      setLoading(true);
      const [data, myUnits] = await Promise.all([
        fetchClaimsForUser(),
        fetchMyUnidadesFuncionales(userId, isAdmin),
      ]);
      setClaims(data);
      setUnits(myUnits);
      setError(null);
    } catch (loadError) {
      setError(
        mensajeDeError(loadError, "No se pudieron cargar los reclamos."),
      );
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userId]);

  // perfil undefined = todavía no sabemos si es admin: esperar evita cargar
  // todo una vez como usuario común y otra como admin.
  const perfilListo = perfil !== undefined;
  useEffect(() => {
    async function loadInitialClaims() {
      if (userId && perfilListo) await loadClaims();
    }
    loadInitialClaims();
  }, [loadClaims, perfilListo, userId]);

  async function handleCreate(event) {
    event.preventDefault();
    if (formError) return;
    setSaving(true);
    setFormError(null);
    try {
      const unit = units.find((item) => item.id === unitId) || null;
      const created = await createClaim({
        title,
        category,
        priority,
        unidadFuncionalId: unitId,
        unit,
        location,
        description,
        images,
        reportanteId: userId,
        reporterName: perfil?.nombre,
        reporterSurname: perfil?.apellido,
        reporterEmail: userEmail,
      });
      setTitle("");
      setLocation("");
      setDescription("");
      setImages([]);
      setFormOpen(false);
      setClaims((current) => [created, ...(current || [])]);
    } catch (createError) {
      setFormError(mensajeDeError(createError, "No se pudo crear el reclamo."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePriorityChange(claimId, nextPriority) {
    setSaving(true);
    try {
      const updated = await updateClaimPriority(claimId, nextPriority);
      setClaims((current) =>
        (current || []).map((claim) =>
          claim.id === claimId ? { ...claim, ...updated } : claim,
        ),
      );
      setError(null);
    } catch (actionError) {
      setError(
        mensajeDeError(actionError, "No se pudo actualizar la prioridad."),
      );
    } finally {
      setSaving(false);
    }
  }

  const scopedClaims = useMemo(
    () =>
      edificioId
        ? (claims || []).filter(
            (claim) => claim.unidad_funcional?.edificio_id === edificioId,
          )
        : claims || [],
    [claims, edificioId],
  );
  const scopedUnits = useMemo(
    () =>
      edificioId
        ? units.filter((unit) => unit.edificio_id === edificioId)
        : units,
    [units, edificioId],
  );
  const edificiosConReclamos = useMemo(() => {
    const porId = new Map();
    for (const claim of scopedClaims) {
      const edificioDelReclamo = edificioDe(claim);
      if (!edificioDelReclamo) continue;
      const actual = porId.get(edificioDelReclamo.id) ?? {
        ...edificioDelReclamo,
        abiertos: 0,
      };
      if ((claim.estado || claim.status || "abierto") !== "cerrado") {
        actual.abiertos += 1;
      }
      porId.set(edificioDelReclamo.id, actual);
    }
    return [...porId.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    );
  }, [scopedClaims]);
  // Solo en la vista general: dentro de un edificio todo es de ese edificio.
  const mostrarEdificio =
    !edificio && (isAdmin || edificiosConReclamos.length > 1);
  // Al crear un reclamo, las unidades se agrupan por edificio ("5K" existe en
  // muchos edificios, así que el nombre solo no alcanza).
  const unitGroups = useMemo(() => {
    if (edificio) return [];
    const porEdificio = new Map();
    for (const unit of units) {
      const clave = unit.edificio_id ?? "sin-edificio";
      if (!porEdificio.has(clave)) {
        porEdificio.set(clave, {
          clave,
          nombre: unit.edificio?.nombre ?? "Sin edificio",
          units: [],
        });
      }
      porEdificio.get(clave).units.push(unit);
    }
    const porNombre = (a, b) => a.localeCompare(b, "es", { numeric: true });
    return [...porEdificio.values()]
      .map((grupo) => ({
        ...grupo,
        units: [...grupo.units].sort((a, b) =>
          porNombre(a.identificador, b.identificador),
        ),
      }))
      .sort((a, b) => porNombre(a.nombre, b.nombre));
  }, [units, edificio]);

  const categories = useMemo(
    () => [
      ...new Set(
        scopedClaims.map(
          (claim) => claim.categoria || claim.category || "General",
        ),
      ),
    ],
    [scopedClaims],
  );
  const counts = useMemo(() => {
    const openClaims = scopedClaims.filter(
      (claim) => (claim.estado || claim.status || "abierto") !== "cerrado",
    );
    return {
      total: openClaims.length,
      activo: openClaims.filter(
        (claim) => (claim.estado || claim.status) === "abierto",
      ).length,
      curso: openClaims.filter(
        (claim) => (claim.estado || claim.status) === "en_curso",
      ).length,
      cerrado: scopedClaims.filter(
        (claim) => (claim.estado || claim.status) === "cerrado",
      ).length,
      urgente: openClaims.filter(
        (claim) => (claim.prioridad || claim.priority) === "Urgente",
      ).length,
    };
  }, [scopedClaims]);
  const filteredClaims = useMemo(
    () =>
      scopedClaims
        .filter((claim) => {
          const categoryValue = claim.categoria || claim.category || "General";
          const edificioDelReclamo = edificioDe(claim);
          return (
            (priorityFilter === "todas" ||
              (claim.prioridad || claim.priority || "Media") ===
                priorityFilter) &&
            (categoryFilter === "todas" || categoryValue === categoryFilter) &&
            (edificioFilter === "todos" ||
              edificioDelReclamo?.id === edificioFilter) &&
            coincideBusqueda(
              [
                titleOf(claim),
                categoryValue,
                claim.unidad_funcional?.identificador,
                edificioDelReclamo?.nombre,
              ],
              search,
            )
          );
        })
        .sort(
          (first, second) =>
            new Date(dateOf(second) || 0) - new Date(dateOf(first) || 0),
        ),
    [categoryFilter, edificioFilter, scopedClaims, priorityFilter, search],
  );
  const visibleClaims = filteredClaims.filter(
    (claim) => (claim.estado || claim.status || "abierto") !== "cerrado",
  );
  const historyClaims = scopedClaims
    .filter(
      (claim) => (claim.estado || claim.status || "abierto") === "cerrado",
    )
    .filter(
      (claim) =>
        edificioFilter === "todos" || edificioDe(claim)?.id === edificioFilter,
    )
    .sort(
      (first, second) =>
        new Date(dateOf(second) || 0) - new Date(dateOf(first) || 0),
    );
  const canCreateClaim = scopedUnits.length > 0;
  // Dentro de un edificio el título de la página es el del edificio.
  const Heading = edificio ? "h2" : "h1";

  return (
    <section className="w-full max-w-6xl" aria-labelledby="claims-title">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading
            id="claims-title"
            className={
              edificio
                ? "text-lg font-semibold text-stone-900"
                : "text-2xl font-semibold text-stone-900"
            }
          >
            {edificio ? "Reclamos del edificio" : "Reclamos"}
          </Heading>
          <p className="mt-1 text-sm text-stone-500">
            {edificio
              ? `Solo los reclamos de ${edificio.nombre}`
              : isAdmin
                ? "Todos los reclamos del consorcio"
                : "Tus solicitudes de mantenimiento"}
          </p>
        </div>
        <button
          type="button"
          disabled={!canCreateClaim}
          onClick={() => canCreateClaim && setFormOpen(true)}
          title={
            canCreateClaim
              ? "Crear un nuevo reclamo"
              : isAdmin
                ? "Cargá una unidad funcional para poder crear un reclamo"
                : "Necesitás una unidad asignada para crear un reclamo"
          }
          className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
        >
          + Nuevo reclamo
        </button>
      </div>
      {!isAdmin && units.length === 0 && (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Todavía no tenés una unidad asignada. Cuando el administrador la
          vincule a tu usuario, vas a poder crear reclamos.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total"
          value={counts.total}
          detail="reclamos activos"
        />
        <SummaryCard
          label="Activos"
          value={counts.activo}
          detail="pendientes de atención"
        />
        <SummaryCard
          label="En curso"
          value={counts.curso}
          detail="en seguimiento"
        />
        <SummaryCard
          label="Cerrados"
          value={counts.cerrado}
          detail="en el historial"
        />
      </div>
      <div className="mt-5 rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-stone-200 p-4">
          <div className="relative">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              aria-label="Buscar reclamo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${inputClass} w-full pl-10`}
              placeholder={
                mostrarEdificio
                  ? "Buscar reclamo, edificio o unidad"
                  : "Buscar reclamo o unidad"
              }
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1">
              {["todas", "Baja", "Media", "Alta", "Urgente"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPriorityFilter(option)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${priorityFilterClass(option, priorityFilter === option)}`}
                >
                  {option === "todas" ? "Todas" : option}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:ml-auto">
              {mostrarEdificio && (
                <>
                  <select
                    aria-label="Filtrar por edificio"
                    value={edificioFilter}
                    onChange={(event) => setEdificioFilter(event.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-amber-600 focus:outline-none"
                  >
                    <option value="todos">Todos los edificios</option>
                    {edificiosConReclamos.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                        {item.abiertos > 0 ? ` (${item.abiertos})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-pressed={agrupar}
                    onClick={() => setAgrupar((valor) => !valor)}
                    className={`whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 ${
                      agrupar
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    Agrupar por edificio
                  </button>
                </>
              )}
              <select
                aria-label="Filtrar por categoría"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-amber-600 focus:outline-none"
              >
                <option value="todas">Todas las categorías</option>
                {categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {loading && (
          <p className="p-6 text-sm text-stone-500">Cargando reclamos...</p>
        )}
        {!loading && !visibleClaims.length && (
          <p className="p-8 text-center text-sm text-stone-500">
            No hay reclamos que coincidan con los filtros.
          </p>
        )}
        {!loading && visibleClaims.length > 0 && (
          <ClaimsTable
            claims={visibleClaims}
            mostrarEdificio={mostrarEdificio}
            agrupar={agrupar}
            isAdmin={isAdmin}
            onPriorityChange={handlePriorityChange}
            pending={saving}
            edificioId={edificioId}
          />
        )}
      </div>
      {!loading && historyClaims.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-stone-50"
          >
            <span>
              <span className="font-semibold text-stone-900">
                Historial de reclamos
              </span>
              <span className="ml-2 text-sm text-stone-500">
                {historyClaims.length} cerrados
              </span>
            </span>
            <span className="text-sm font-medium text-amber-700">
              {historyOpen ? "Ocultar" : "Ver historial"}
            </span>
          </button>
          {historyOpen && (
            <ClaimsTable
              claims={historyClaims}
              mostrarEdificio={mostrarEdificio}
              agrupar={agrupar}
              isAdmin={isAdmin}
              onPriorityChange={handlePriorityChange}
              pending={saving}
              edificioId={edificioId}
            />
          )}
        </div>
      )}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 px-4 py-6"
          onClick={() => !saving && setFormOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-claim-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-3rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="new-claim-title"
                  className="text-xl font-semibold text-stone-900"
                >
                  Nuevo reclamo
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Completá la información para registrar una solicitud.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setFormOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg px-2 py-1 text-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label htmlFor="claim-title" className={labelClass}>
                  Título
                </label>
                <input
                  id="claim-title"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClass}
                  placeholder="Ej. Fuga de agua en cochera"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="claim-category" className={labelClass}>
                    Categoría
                  </label>
                  <select
                    id="claim-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={inputClass}
                  >
                    <option>Mantenimiento general</option>
                    <option>Plomería</option>
                    <option>Electricidad</option>
                    <option>Ascensor</option>
                    <option>Limpieza</option>
                    <option>Seguridad</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="claim-priority" className={labelClass}>
                    Prioridad
                  </label>
                  <select
                    id="claim-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className={inputClass}
                  >
                    {(isAdmin ? priorities : priorities.slice(0, 3)).map(
                      (option) => (
                        <option key={option}>{option}</option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="claim-unit" className={labelClass}>
                    Unidad / piso
                  </label>
                  <select
                    id="claim-unit"
                    required
                    value={unitId}
                    onChange={(event) => setUnitId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Seleccioná una unidad</option>
                    {unitGroups.length > 1
                      ? unitGroups.map((grupo) => (
                          <optgroup key={grupo.clave} label={grupo.nombre}>
                            {grupo.units.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.identificador}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      : scopedUnits.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.identificador}
                          </option>
                        ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="claim-location" className={labelClass}>
                    Espacio común
                  </label>
                  <input
                    id="claim-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className={inputClass}
                    placeholder="Cochera, SUM, terraza..."
                  />
                </div>
              </div>
              <div>
                <label htmlFor="claim-description" className={labelClass}>
                  Descripción
                </label>
                <textarea
                  id="claim-description"
                  required
                  rows="4"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={inputClass}
                  placeholder="Qué pasa, desde cuándo y a quién afecta"
                />
              </div>
              <div>
                <label htmlFor="claim-images" className={labelClass}>
                  Fotos del reclamo
                </label>
                <input
                  id="claim-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={saving}
                  onChange={(event) => {
                    const selectedImages = Array.from(event.target.files || []);
                    const invalidImage = selectedImages.find(
                      (image) =>
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          image.type,
                        ) || image.size > 5 * 1024 * 1024,
                    );
                    if (selectedImages.length > 5) {
                      setFormError("Podés adjuntar hasta 5 imágenes.");
                      setImages([]);
                      return;
                    }
                    if (invalidImage) {
                      setFormError(
                        "Solo se permiten imágenes JPG, PNG o WEBP de hasta 5 MB.",
                      );
                      setImages([]);
                      return;
                    }
                    setFormError(null);
                    setImages(selectedImages);
                  }}
                  className="block w-full rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:font-medium file:text-amber-800"
                />
                {images.length > 0 && (
                  <p className="mt-2 text-xs text-stone-500">
                    {images.length}{" "}
                    {images.length === 1
                      ? "imagen seleccionada"
                      : "imágenes seleccionadas"}
                  </p>
                )}
              </div>
              {formError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
                >
                  Cancelar
                </button>
                <div className="sm:w-48">
                  <ModalFormButton
                    loading={saving}
                    label="Crear reclamo"
                    loadingLabel="Subiendo fotos..."
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
