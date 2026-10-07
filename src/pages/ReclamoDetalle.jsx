import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import AppHeader from "../components/AppHeader";
import SegmentedControl from "../components/SegmentedControl";
import { useAuth } from "../contexts/auth-context/use-auth";
import {
  addClaimComment,
  fetchClaimById,
  fetchClaimComments,
  updateClaim,
} from "../services/claims";
import { mensajeDeError } from "../utils/supabase-errors";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50";
const statusLabels = {
  abierto: "Activo",
  en_curso: "En curso",
  cerrado: "Cerrado",
};

const ESTADOS = [
  {
    value: "abierto",
    label: "Activo",
    activa: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    punto: "bg-amber-500",
  },
  {
    value: "en_curso",
    label: "En curso",
    activa: "bg-blue-100 text-blue-800 ring-1 ring-blue-300",
    punto: "bg-blue-500",
  },
  {
    value: "cerrado",
    label: "Cerrado",
    activa: "bg-green-100 text-green-800 ring-1 ring-green-300",
    punto: "bg-green-500",
  },
];

const PRIORIDADES = [
  {
    value: "Baja",
    label: "Baja",
    activa: "bg-white text-stone-800 ring-1 ring-stone-300",
    punto: "bg-stone-400",
  },
  {
    value: "Media",
    label: "Media",
    activa: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    punto: "bg-amber-500",
  },
  {
    value: "Alta",
    label: "Alta",
    activa: "bg-orange-100 text-orange-800 ring-1 ring-orange-300",
    punto: "bg-orange-500",
  },
  {
    value: "Urgente",
    label: "Urgente",
    activa: "bg-red-100 text-red-800 ring-1 ring-red-300",
    punto: "bg-red-500",
  },
];

function claimStatus(claim) {
  return claim?.estado || claim?.status || "abierto";
}

function claimTitle(claim) {
  return claim?.titulo || claim?.title || "Reclamo";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ReclamoDetalle() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  // Si se llegó desde la pantalla de un edificio, "Volver" regresa ahí. Solo
  // se acepta un UUID: nada que venga de la URL se usa como ruta tal cual.
  const edificioOrigen = new URLSearchParams(useSearch()).get("edificio");
  const volverA = UUID.test(edificioOrigen ?? "")
    ? `/admin/edificios/${edificioOrigen}/reclamos`
    : "/reclamos";
  const { session, perfil } = useAuth();
  const isAdmin = perfil?.rol === "admin";
  const userId = session?.user?.id;
  const userEmail = session?.user?.email || "";
  const [claim, setClaim] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draftStatus, setDraftStatus] = useState("abierto");
  const [draftPriority, setDraftPriority] = useState("Media");

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const [foundClaim, claimComments] = await Promise.all([
        fetchClaimById(id),
        fetchClaimComments(id),
      ]);
      setClaim(foundClaim);
      if (foundClaim) {
        setDraftStatus(claimStatus(foundClaim));
        setDraftPriority(
          foundClaim.prioridad || foundClaim.priority || "Media",
        );
      }
      setComments(claimComments);
    } catch (loadError) {
      setError(mensajeDeError(loadError, "No se pudo cargar el reclamo."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    async function loadInitialDetail() {
      if (userId && id) await loadDetail();
    }
    loadInitialDetail();
  }, [id, loadDetail, userId]);

  async function handleComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    setSaving(true);
    try {
      const newComment = await addClaimComment({
        claimId: id,
        userId,
        comment: comment.trim(),
        author: {
          nombre: perfil?.nombre || "Usuario",
          apellido: perfil?.apellido || "",
          email: userEmail,
        },
      });
      setComments((current) => [...current, newComment]);
      setComment("");
      setError(null);
    } catch (commentError) {
      setError(
        mensajeDeError(commentError, "No se pudo agregar el comentario."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveChanges() {
    if (draftStatus === status && draftPriority === priority) return;
    setSaving(true);
    try {
      const updated = await updateClaim(
        id,
        {
          status: draftStatus,
          priority: draftPriority,
          previousStatus: status,
        },
        userId,
      );
      setClaim((current) => ({ ...current, ...updated }));
      setError(null);
    } catch (saveError) {
      setError(
        mensajeDeError(saveError, "No se pudieron guardar los cambios."),
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardChanges() {
    setDraftStatus(status);
    setDraftPriority(priority);
    setError(null);
  }

  const status = claimStatus(claim);
  const priority = claim?.prioridad || claim?.priority || "Media";
  const imageUrls = claim?.imagen_urls || claim?.image_urls || [];
  const hayCambios = draftStatus !== status || draftPriority !== priority;
  const authorName = (commentItem) => {
    const author = commentItem.autor || commentItem.author;
    return author
      ? `${author.nombre || ""} ${author.apellido || ""}`.trim() || author.email
      : "Usuario";
  };

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo={volverA} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(volverA)}
          className="mb-4 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15 18-6-6 6-6"
            />
          </svg>
          {volverA === "/reclamos" ? "Volver a reclamos" : "Volver al edificio"}
        </button>
        {loading && (
          <p className="text-sm text-stone-500">Cargando reclamo...</p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {!loading && !claim && (
          <p className="rounded-xl border border-stone-200 bg-white p-5 text-stone-600">
            Reclamo no encontrado.
          </p>
        )}
        {claim && (
          <>
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    R-{String(claim.id).slice(0, 8)} ·{" "}
                    {claim.categoria || claim.category || "General"}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-stone-900">
                    {claimTitle(claim)}
                  </h1>
                </div>
                <div className="flex gap-2 text-xs font-medium">
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                    {priority}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-700">
                    {statusLabels[status] || status}
                  </span>
                </div>
              </div>
              <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {claim.descripcion || claim.description}
              </p>
              <div className="mt-5 grid gap-5 border-t border-stone-100 pt-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(250px,1fr)]">
                {imageUrls.length > 0 && (
                  <div>
                    <h2 className="text-xs font-medium uppercase tracking-wide text-stone-400">
                      Fotos del reclamo
                    </h2>
                    <div
                      className={`mt-2 grid gap-2 ${imageUrls.length === 1 ? "max-w-xs grid-cols-1" : "grid-cols-2"}`}
                    >
                      {imageUrls.map((imageUrl, index) => (
                        <a
                          key={imageUrl}
                          href={imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="group aspect-[16/10] overflow-hidden rounded-lg border border-stone-200 bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
                        >
                          <img
                            src={imageUrl}
                            alt={`Foto del reclamo ${index + 1}`}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <dl
                  className={`grid content-start gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1 ${imageUrls.length === 0 ? "lg:col-span-2 lg:grid-cols-4" : ""}`}
                >
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      Ubicación
                    </dt>
                    <dd className="mt-1 font-medium text-stone-700">
                      {claim.ubicacion || claim.location || "Sin ubicación"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      Unidad / piso
                    </dt>
                    <dd className="mt-1 font-medium text-stone-700">
                      {claim.unidad_funcional?.identificador || "No indicada"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      Creado
                    </dt>
                    <dd className="mt-1 font-medium text-stone-700">
                      {claim.fecha_creacion
                        ? new Date(claim.fecha_creacion).toLocaleDateString(
                            "es-AR",
                          )
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                      Reportante
                    </dt>
                    <dd className="mt-1 font-medium text-stone-700">
                      {claim.reportante?.nombre || "Residente"}{" "}
                      {claim.reportante?.apellido || ""}
                    </dd>
                  </div>
                </dl>
              </div>
              {isAdmin && (
                <div className="mt-6 rounded-xl bg-stone-50 p-4">
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                    Gestión del reclamo
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SegmentedControl
                      legend="Estado"
                      value={draftStatus}
                      onChange={setDraftStatus}
                      options={ESTADOS}
                      disabled={saving}
                    />
                    <SegmentedControl
                      legend="Prioridad"
                      value={draftPriority}
                      onChange={setDraftPriority}
                      options={PRIORIDADES}
                      disabled={saving}
                    />
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      disabled={saving || !hayCambios}
                      onClick={handleSaveChanges}
                      className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                    >
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                    {hayCambios && (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleDiscardChanges}
                          className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Descartar cambios
                        </button>
                        <p
                          role="status"
                          className="text-sm text-amber-800 sm:ml-1"
                        >
                          Tenés cambios sin guardar.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-stone-900">
                  Comentarios e historial
                </h2>
                <span className="text-xs text-stone-400">
                  {comments.length}{" "}
                  {comments.length === 1 ? "comentario" : "comentarios"}
                </span>
              </div>
              {!comments.length && (
                <p className="mt-4 text-sm text-stone-500">
                  Todavía no hay comentarios.
                </p>
              )}
              <div className="mt-4 space-y-3">
                {comments.map((commentItem) => (
                  <div
                    key={commentItem.id}
                    className="rounded-xl bg-stone-50 p-3"
                  >
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="font-semibold text-stone-700">
                        {authorName(commentItem)}
                      </span>
                      <time className="text-stone-400">
                        {new Date(commentItem.created_at).toLocaleString(
                          "es-AR",
                        )}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
                      {commentItem.comentario || commentItem.comment}
                    </p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={handleComment}
                className="mt-5 border-t border-stone-100 pt-4"
              >
                <label
                  htmlFor="claim-comment"
                  className="mb-1 block text-sm font-medium text-stone-700"
                >
                  Agregar comentario
                </label>
                <textarea
                  id="claim-comment"
                  required
                  rows="3"
                  maxLength={2000}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  disabled={saving}
                  className={inputClass}
                  placeholder="Escribí una actualización o consulta"
                />
                <button
                  type="submit"
                  disabled={saving || !comment.trim()}
                  className="mt-3 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Comentar"}
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
