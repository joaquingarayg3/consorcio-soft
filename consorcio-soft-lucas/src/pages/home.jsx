import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/auth-context/use-auth";
import { resolveUserProfile } from "../utils/claims";
import {
  closeClaim,
  createClaim,
  fetchClaimsForUser,
  fetchMyUnidadesFuncionales,
} from "../services/claimsService";

const categoryOptions = [
  "Plomería",
  "Ascensor",
  "Electricidad",
  "Limpieza",
  "Seguridad",
  "Obra / albañilería",
  "Otro",
];

const priorityOptions = ["Baja", "Media", "Alta"];
const statusOptions = ["abierto", "en_curso", "cerrado"];

function formatDateTime(value) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status) {
  const labels = {
    abierto: "Abierto",
    en_curso: "En curso",
    cerrado: "Cerrado",
  };

  return labels[status] || status;
}

function statusClasses(status) {
  const classes = {
    abierto: "bg-amber-100 text-amber-700 border border-amber-200",
    en_curso: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    cerrado: "bg-stone-200 text-stone-700 border border-stone-300",
  };

  return classes[status] || "bg-stone-100 text-stone-700 border border-stone-200";
}

function mapClaimFromDb(claim) {
  return {
    id: claim.id,
    title: claim.titulo,
    category: claim.categoria,
    priority: claim.prioridad,
    unit: claim.unidad_funcional?.identificador ?? "Sin unidad",
    unidadFuncionalId: claim.unidad_funcional_id,
    location: claim.ubicacion ?? "Sin ubicación",
    description: claim.descripcion,
    status: claim.estado ?? "abierto",
    reportanteId: claim.reportante_id,
    reporterName: claim.reportante?.nombre ?? "",
    reporterSurname: claim.reportante?.apellido ?? "",
    reporterEmail: claim.reportante?.email ?? "",
    createdAt: claim.fecha_creacion ?? new Date().toISOString(),
    closedAt: claim.fecha_cierre,
    closedBy: claim.cerrado_por
      ? `${claim.cerrado_por.nombre ?? ""} ${claim.cerrado_por.apellido ?? ""}`.trim()
      : "",
    adminNote: claim.nota_admin ?? "",
  };
}

export default function Home() {
  const { session, singOutUser, userProfile } = useAuth();
  const profile = useMemo(() => resolveUserProfile(session), [session]);
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [activeSection, setActiveSection] = useState("reclamos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    category: "Plomería",
    priority: "Media",
    unidadFuncionalId: "",
    location: "",
    description: "",
  });

  const isAdmin = (profile.role || userProfile?.role || "user") === "admin";
  const userId = session?.user?.id;

  useEffect(() => {
    async function loadClaims() {
      if (!userId) {
        setClaims([]);
        setClaimsLoading(false);
        return;
      }

      try {
        setClaimsLoading(true);
        const data = await fetchClaimsForUser({ userId, isAdmin });
        setClaims(data.map(mapClaimFromDb));
      } catch (error) {
        console.error("Error loading claims:", error);
        setClaims([]);
      } finally {
        setClaimsLoading(false);
      }
    }

    loadClaims();
  }, [userId, isAdmin]);

  useEffect(() => {
    async function loadUnits() {
      if (!userId) {
        setUnits([]);
        return;
      }

      try {
        const data = await fetchMyUnidadesFuncionales(userId);
        setUnits(data);
      } catch (error) {
        console.error("Error loading unidades funcionales:", error);
        setUnits([]);
      }
    }

    loadUnits();
  }, [userId]);

  const stats = useMemo(() => {
    const visibleClaims = claims.filter(
      (claim) => isAdmin || claim.reportanteId === userId,
    );

    return {
      abiertos: visibleClaims.filter((claim) => claim.status === "abierto").length,
      enCurso: visibleClaims.filter((claim) => claim.status === "en_curso").length,
      cerrados: visibleClaims.filter((claim) => claim.status === "cerrado").length,
    };
  }, [claims, isAdmin, userId]);

  const filteredClaims = useMemo(() => {
    let result = [...claims].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    if (activeSection === "historial") {
      result = result.filter((claim) => claim.status === "cerrado");
    } else {
      result = result.filter((claim) => claim.status !== "cerrado");
    }

    if (!isAdmin) {
      result = result.filter((claim) => claim.reportanteId === userId);
    }

    if (statusFilter !== "todos" && activeSection !== "historial") {
      result = result.filter((claim) => claim.status === statusFilter);
    }

    if (search.trim()) {
      const searchValue = search.toLowerCase();
      result = result.filter((claim) =>
        `${claim.title} ${claim.description} ${claim.category} ${claim.reporterName} ${claim.reporterSurname} ${claim.location}`
          .toLowerCase()
          .includes(searchValue),
      );
    }

    return result;
  }, [activeSection, claims, isAdmin, userId, search, statusFilter]);

  useEffect(() => {
    if (!filteredClaims.length) {
      setSelectedClaimId(null);
      return;
    }

    if (!selectedClaimId || !filteredClaims.some((claim) => claim.id === selectedClaimId)) {
      setSelectedClaimId(filteredClaims[0].id);
    }
  }, [filteredClaims, selectedClaimId]);

  const selectedClaim =
    filteredClaims.find((claim) => claim.id === selectedClaimId) || filteredClaims[0] || null;

  const handleCreateClaim = async (event) => {
    event.preventDefault();

    const title = form.title.trim();
    const description = form.description.trim();

    if (!title || !description || !userId) {
      return;
    }

    try {
      const created = await createClaim({
        title,
        category: form.category,
        priority: form.priority,
        unidadFuncionalId: form.unidadFuncionalId || null,
        location: form.location || "Sin ubicación",
        description,
        reportanteId: userId,
      });

      setClaims((current) => [mapClaimFromDb(created), ...current]);
      setShowForm(false);
      setActiveSection("reclamos");
      setStatusFilter("todos");
      setSelectedClaimId(created.id);
      setForm({
        title: "",
        category: "Plomería",
        priority: "Media",
        unidadFuncionalId: "",
        location: "",
        description: "",
      });
    } catch (error) {
      console.error("Error creating claim:", error);
    }
  };

  const handleCloseClaim = async (claimId) => {
    try {
      const updated = await closeClaim(claimId, userId);
      setClaims((current) =>
        current.map((claim) =>
          claim.id === claimId ? mapClaimFromDb(updated) : claim,
        ),
      );
      setActiveSection("historial");
    } catch (error) {
      console.error("Error closing claim:", error);
    }
  };

  const displayName = `${profile.name || "Usuario"} ${profile.surname || ""}`.trim();
  const email = session?.user?.email || profile.email || "";
  const initial = (profile.name || email?.charAt(0) || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh bg-[#d9d3cf] text-stone-800">
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="w-full bg-[#4f2c1d] px-4 py-5 text-white lg:w-[260px] lg:min-w-[260px]">
          <div className="mb-8 flex items-center gap-3 rounded-xl bg-[#62392b] px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7d7b9] text-sm font-bold text-[#4f2c1d]">
              {initial}
            </div>
            <div>
              <p className="text-lg font-bold">{displayName || "Consorcio Soft"}</p>
              <p className="text-xs text-stone-300">{profile.role === "admin" ? "Administración" : "Residente"}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-300">
              Gestión
            </p>
            <nav className="space-y-2 text-sm">
              {[
                "Panel general",
                "Reclamos",
                "Mantenimiento",
                "Expensas",
                "Unidades",
                "Proveedores",
              ].map((item) => {
                const selected = item === "Reclamos";
                return (
                  <button
                    type="button"
                    key={item}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                      selected
                        ? "bg-[#6d3d2b] text-white shadow-inner"
                        : "text-stone-200 hover:bg-[#5e3529]"
                    }`}
                    onClick={() => item === "Reclamos" && setActiveSection("reclamos")}
                  >
                    <span>{item}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto border-t border-white/10 pt-3">
            <div className="rounded-xl bg-[#733d2c] p-3 text-sm">
              <p className="font-medium">{displayName || "Usuario"}</p>
              <p className="mt-1 text-xs text-stone-300">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => singOutUser()}
              className="mt-4 w-full rounded-xl bg-[#f0a15d] px-3 py-2 font-semibold text-[#2d1c15] transition hover:bg-[#f5b06c]"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-[22px] bg-[#e3ddd8] p-3 shadow-inner sm:p-5">
            <header className="flex flex-col gap-3 rounded-[18px] bg-[#f3efe9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-stone-900">Reclamos del consorcio</h1>
                <p className="text-sm text-stone-500">
                  {profile.role === "admin" ? "Administración" : "Residente"} · Unidad 4° B · {displayName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveSection("historial")}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      activeSection === "historial"
                        ? "border-stone-300 bg-white text-stone-900"
                        : "border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    Historial
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="rounded-xl bg-[#d9642d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c95a2b]"
                >
                  + Nuevo reclamo
                </button>
              </div>
            </header>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white/60 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Abiertos</p>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-bold text-stone-900">{stats.abiertos}</span>
                  <span className="text-sm text-stone-500">en el consorcio</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/60 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">En curso</p>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-bold text-stone-900">{stats.enCurso}</span>
                  <span className="text-sm text-stone-500">requieren proveer</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/60 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cerrados</p>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-bold text-stone-900">{stats.cerrados}</span>
                  <span className="text-sm text-stone-500">histórico</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/60 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Rol</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xl font-bold text-stone-900">
                    {isAdmin ? "Admin" : "Usuario"}
                  </span>
                  <span className="rounded-full bg-stone-200 px-2 py-1 text-xs text-stone-700">
                    {isAdmin ? "activo" : "residente"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.4fr_1.05fr]">
              <section className="rounded-[18px] bg-[#f4f0ed] p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative w-full sm:w-[260px]">
                      <span className="absolute inset-y-0 left-3 flex items-center text-stone-400">⌕</span>
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar por título, categoria o ubicación"
                        className="w-full rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-700 outline-none focus:border-[#d9642d]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeSection === "reclamos" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("todos")}
                          className={`rounded-xl px-3 py-2 text-sm ${
                            statusFilter === "todos"
                              ? "bg-stone-900 text-white"
                              : "bg-stone-200 text-stone-700"
                          }`}
                        >
                          Todos
                        </button>
                        {statusOptions
                          .filter((status) => status !== "cerrado")
                          .map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setStatusFilter(status)}
                              className={`rounded-xl px-3 py-2 text-sm ${
                                statusFilter === status
                                  ? "bg-stone-900 text-white"
                                  : "bg-stone-200 text-stone-700"
                              }`}
                            >
                              {statusLabel(status)}
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {claimsLoading ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-8 text-center text-stone-500">
                      Cargando reclamos...
                    </div>
                  ) : filteredClaims.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-8 text-center text-stone-500">
                      No hay reclamos para mostrar en esta vista.
                    </div>
                  ) : (
                    filteredClaims.map((claim) => (
                      <button
                        key={claim.id}
                        type="button"
                        onClick={() => setSelectedClaimId(claim.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selectedClaim?.id === claim.id
                            ? "border-[#cf6f45] bg-[#f6eee9] shadow-sm"
                            : "border-stone-200 bg-white hover:border-stone-300"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-stone-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-stone-700">
                              {claim.category}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClasses(claim.status)}`}>
                              {statusLabel(claim.status)}
                            </span>
                          </div>
                          <span className="text-xs text-stone-500">{claim.priority}</span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-lg font-bold text-stone-900">{claim.title}</p>
                            <p className="mt-1 text-sm text-stone-600">
                              {claim.reporterName} {claim.reporterSurname} · {claim.unit}
                            </p>
                          </div>
                          <span className="text-xs text-stone-500">{formatDateTime(claim.createdAt)}</span>
                        </div>

                        <p className="mt-3 line-clamp-3 text-sm text-stone-600">{claim.description}</p>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <aside className="rounded-[18px] bg-[#f4f0ed] p-4 shadow-sm">
                {selectedClaim ? (
                  <div className="h-full">
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                          {selectedClaim.category}
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-stone-900">{selectedClaim.title}</h2>
                      </div>
                    </div>

                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Estado</p>
                        <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClasses(selectedClaim.status)}`}>
                          {statusLabel(selectedClaim.status)}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Prioridad</p>
                        <p className="mt-2 font-semibold text-stone-800">{selectedClaim.priority}</p>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl bg-white p-4 text-sm text-stone-600">
                      <p>
                        <span className="font-semibold text-stone-800">Persona:</span>{" "}
                        {selectedClaim.reporterName} {selectedClaim.reporterSurname}
                      </p>
                      <p>
                        <span className="font-semibold text-stone-800">Fecha y hora:</span>{" "}
                        {formatDateTime(selectedClaim.createdAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-stone-800">Unidad:</span>{" "}
                        {selectedClaim.unit}
                      </p>
                      <p>
                        <span className="font-semibold text-stone-800">Ubicación:</span>{" "}
                        {selectedClaim.location}
                      </p>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Descripción</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                        {selectedClaim.description}
                      </p>
                    </div>

                    {selectedClaim.status !== "cerrado" && isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleCloseClaim(selectedClaim.id)}
                        className="mt-5 w-full rounded-xl bg-[#d9642d] px-4 py-3 font-semibold text-white transition hover:bg-[#c95a2b]"
                      >
                        Cerrar reclamo y enviar al historial
                      </button>
                    )}

                    {selectedClaim.status === "cerrado" && (
                      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-100 p-3 text-sm text-stone-700">
                        <p className="font-semibold text-stone-800">Cerrado</p>
                        <p className="mt-1">Fecha: {formatDateTime(selectedClaim.closedAt)}</p>
                        <p>Responsable: {selectedClaim.closedBy || "Administración"}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-500">
                    Seleccioná un reclamo para ver su detalle.
                  </div>
                )}
              </aside>
            </div>
          </div>
        </main>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 p-4">
          <div className="w-full max-w-2xl rounded-[20px] bg-[#f3efe9] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-stone-900">Nuevo reclamo</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xl text-stone-500 hover:text-stone-800"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-stone-700">
                  Título
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#d9642d]"
                    placeholder="Ej: Fuga de agua en el pasillo"
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-stone-700">
                  Categoría
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#d9642d]"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium text-stone-700">
                  Prioridad
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, priority: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#d9642d]"
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-stone-700">
                  Unidad
                  <select
                    value={form.unidadFuncionalId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unidadFuncionalId: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#d9642d]"
                  >
                    <option value="">Espacio común / sin unidad</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.identificador}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-stone-700">
                  Ubicación
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, location: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#d9642d]"
                    placeholder="Espacio común"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-stone-700">
                Descripción
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="mt-1 min-h-32 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#d9642d]"
                  placeholder="Contá qué pasó, dónde está y cómo afecta al consorcio."
                  required
                />
              </label>

              <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                <span className="text-sm text-stone-500">
                  Se registrará con fecha y hora actuales.
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 font-medium text-stone-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#d9642d] px-4 py-2.5 font-semibold text-white transition hover:bg-[#c95a2b]"
                  >
                    Guardar reclamo
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
