import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";
import {
  createClaim,
  fetchClaimsForUser,
  fetchMyUnidadesFuncionales,
  updateClaimPriority,
} from "../services/claims";
import { PopoverFormButton } from "./PopoverForm";

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

function ClaimRow({ claim, isAdmin, pending, onPriorityChange }) {
  const [, navigate] = useLocation();
  const priority = claim.prioridad || claim.priority || "Media";
  const status = claim.estado || claim.status || "abierto";
  const reporter = claim.reportante
    ? `${claim.reportante.nombre || ""} ${claim.reportante.apellido || ""}`.trim()
    : "Residente";
  return (
    <tr
      tabIndex="0"
      onClick={() => navigate(`/reclamos/${claim.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ")
          navigate(`/reclamos/${claim.id}`);
      }}
      className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600/50"
    >
      <td className="px-4 py-4 align-top text-xs font-medium text-stone-400">
        {String(claim.id).slice(0, 8)}
      </td>
      <td className="px-4 py-4 align-top">
        <p className="font-semibold text-stone-900">{titleOf(claim)}</p>
        <p className="mt-1 text-xs text-stone-500">
          {claim.categoria || claim.category || "General"}
        </p>
      </td>
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
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(priority)}`}
        >
          {priority}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(status)}`}
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

function ClaimsTable({ claims, isAdmin, pending, onPriorityChange }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Reclamo</th>
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
        <tbody>
          {claims.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              isAdmin={isAdmin}
              onPriorityChange={onPriorityChange}
              pending={pending}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClaimsPanel() {
  const { session, perfil } = useAuth();
  const isAdmin = perfil?.rol === "admin";
  const userId = session?.user?.id;
  const userEmail = session?.user?.email || "";
  const [claims, setClaims] = useState(null);
  const [units, setUnits] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [categoryFilter, setCategoryFilter] = useState("todas");
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
      const data = await fetchClaimsForUser({ userId, userEmail, isAdmin });
      setClaims(data);
      setError(null);
      setUnits(await fetchMyUnidadesFuncionales(userId, isAdmin));
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar los reclamos.");
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userEmail, userId]);

  useEffect(() => {
    async function loadInitialClaims() {
      if (userId) await loadClaims();
    }
    loadInitialClaims();
  }, [loadClaims, userId]);

  async function handleCreate(event) {
    event.preventDefault();
    if (formError) return;
    setSaving(true);
    setFormError(null);
    try {
      const unit = units.find((item) => item.id === unitId) || null;
      await createClaim({
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
      await loadClaims();
    } catch (createError) {
      setFormError(createError.message || "No se pudo crear el reclamo.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePriorityChange(claimId, nextPriority) {
    setSaving(true);
    try {
      await updateClaimPriority(claimId, nextPriority);
      await loadClaims();
    } catch (actionError) {
      setError(actionError.message || "No se pudo actualizar la prioridad.");
    } finally {
      setSaving(false);
    }
  }

  const categories = useMemo(
    () => [
      ...new Set(
        (claims || []).map(
          (claim) => claim.categoria || claim.category || "General",
        ),
      ),
    ],
    [claims],
  );
  const counts = useMemo(() => {
    const openClaims = (claims || []).filter(
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
      cerrado: (claims || []).filter(
        (claim) => (claim.estado || claim.status) === "cerrado",
      ).length,
      urgente: openClaims.filter(
        (claim) => (claim.prioridad || claim.priority) === "Urgente",
      ).length,
    };
  }, [claims]);
  const filteredClaims = useMemo(
    () =>
      (claims || [])
        .filter((claim) => {
          const categoryValue = claim.categoria || claim.category || "General";
          const text =
            `${titleOf(claim)} ${categoryValue} ${claim.unidad_funcional?.identificador || ""}`.toLowerCase();
          return (
            (priorityFilter === "todas" ||
              (claim.prioridad || claim.priority || "Media") ===
                priorityFilter) &&
            (categoryFilter === "todas" || categoryValue === categoryFilter) &&
            (!search.trim() || text.includes(search.trim().toLowerCase()))
          );
        })
        .sort(
          (first, second) =>
            new Date(dateOf(second) || 0) - new Date(dateOf(first) || 0),
        ),
    [categoryFilter, claims, priorityFilter, search],
  );
  const visibleClaims = filteredClaims.filter(
    (claim) => (claim.estado || claim.status || "abierto") !== "cerrado",
  );
  const historyClaims = (claims || [])
    .filter(
      (claim) => (claim.estado || claim.status || "abierto") === "cerrado",
    )
    .sort(
      (first, second) =>
        new Date(dateOf(second) || 0) - new Date(dateOf(first) || 0),
    );
  const canCreateClaim = isAdmin || units.length > 0;

  return (
    <section className="w-full max-w-6xl" aria-labelledby="claims-title">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            id="claims-title"
            className="text-2xl font-semibold text-stone-900"
          >
            Reclamos
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {isAdmin
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
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center">
          <input
            aria-label="Buscar reclamo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} min-w-0 flex-1`}
            placeholder="Buscar reclamo, unidad..."
          />
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
            isAdmin={isAdmin}
            onPriorityChange={handlePriorityChange}
            pending={saving}
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
              isAdmin={isAdmin}
              onPriorityChange={handlePriorityChange}
              pending={saving}
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
                    {units.map((unit) => (
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
                  <PopoverFormButton
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
