import supabase from "../supabase-client";
import { getStoredClaims, saveStoredClaims } from "../utils/claims";

const TABLE_NAME = "reclamos";
const COMMENTS_TABLE_NAME = "reclamo_comentarios";
const COMMENTS_STORAGE_KEY = "consorcio-soft-claim-comments-v1";
const CLAIMS_BUCKET = "reclamos";
const CLAIMS_VIEWED_KEY = "consorcio-soft-claims-viewed-v1";
const CLAIMS_HISTORY_KEY = "consorcio-soft-claims-history-v1";
const SELECT_FIELDS = `
  *,
  unidad_funcional:unidad_funcional_id ( id, identificador, piso ),
  reportante:reportante_id ( nombre, apellido, email ),
  cerrado_por:cerrado_por_id ( nombre, apellido )
`;

function isMissingCommentsTable(error) {
  return (
    error?.code === "PGRST205" ||
    error?.message?.includes("reclamo_comentarios")
  );
}

function isMissingClaimsBucket(error) {
  return (
    error?.message?.toLowerCase().includes("bucket not found") ||
    error?.statusCode === "404"
  );
}

function readLocalComments(claimId) {
  try {
    const comments = JSON.parse(
      localStorage.getItem(COMMENTS_STORAGE_KEY) || "{}",
    );
    return comments[claimId] || [];
  } catch {
    return [];
  }
}

function saveLocalComment(claimId, comment) {
  const comments = JSON.parse(
    localStorage.getItem(COMMENTS_STORAGE_KEY) || "{}",
  );
  comments[claimId] = [...(comments[claimId] || []), comment];
  localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
}

function isDemoMode() {
  return (
    !import.meta.env.VITE_SUPABASE_URL ||
    !(
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_KEY
    )
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadClaimImages(files, userId) {
  if (!files?.length) return [];
  if (isDemoMode()) return Promise.all(files.map(readFileAsDataUrl));

  const uploadedUrls = [];
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(CLAIMS_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    if (error) {
      if (isMissingClaimsBucket(error)) {
        console.warn(
          "El bucket reclamos no existe; se guardarán las imágenes en el reclamo.",
        );
        return Promise.all(files.map(readFileAsDataUrl));
      }
      throw error;
    }
    const { data } = supabase.storage.from(CLAIMS_BUCKET).getPublicUrl(path);
    uploadedUrls.push(data.publicUrl);
  }
  return uploadedUrls;
}

function demoClaimsForUser() {
  const claims = getStoredClaims();
  return claims;
}

function readClaimsViewed() {
  try {
    return JSON.parse(localStorage.getItem(CLAIMS_VIEWED_KEY) || "{}");
  } catch {
    return {};
  }
}

function readNotificationState() {
  try {
    return JSON.parse(localStorage.getItem(CLAIMS_HISTORY_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getUnreadClaims(claims, userId) {
  if (!userId) return [];
  const viewedAt = readClaimsViewed()[userId] || 0;
  return (claims || []).filter((claim) => {
    const createdAt = new Date(
      claim.fecha_creacion || claim.createdAt || 0,
    ).getTime();
    return createdAt > viewedAt;
  });
}

export function getNotificationHistory(claims, userId) {
  const hiddenIds = readNotificationState()[userId]?.hiddenIds || [];
  return (claims || [])
    .filter((claim) => !hiddenIds.includes(claim.id))
    .sort(
      (first, second) =>
        new Date(second.fecha_creacion || second.createdAt || 0) -
        new Date(first.fecha_creacion || first.createdAt || 0),
    );
}

export function clearNotificationHistory(userId, claims) {
  if (!userId) return;
  const state = readNotificationState();
  state[userId] = {
    ...(state[userId] || {}),
    hiddenIds: (claims || []).map((claim) => claim.id),
  };
  localStorage.setItem(CLAIMS_HISTORY_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("notifications-cleared"));
}

export function markClaimsAsViewed(userId) {
  if (!userId) return;
  const viewed = readClaimsViewed();
  viewed[userId] = Date.now();
  localStorage.setItem(CLAIMS_VIEWED_KEY, JSON.stringify(viewed));
  window.dispatchEvent(new CustomEvent("claims-viewed"));
}

export async function fetchClaimsForUser({ userId, userEmail, isAdmin }) {
  if (isDemoMode()) return demoClaimsForUser(userId, userEmail, isAdmin);

  let query = supabase
    .from(TABLE_NAME)
    .select(SELECT_FIELDS)
    .order("fecha_creacion", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyUnidadesFuncionales(userId, isAdmin = false) {
  if (!userId) return [];
  if (isDemoMode()) {
    return [
      { id: "demo-unit-1", identificador: "3° B", piso: 3 },
      { id: "demo-unit-2", identificador: "4° A", piso: 4 },
      { id: "demo-unit-3", identificador: "5° C", piso: 5 },
    ];
  }

  if (isAdmin) {
    const { data, error } = await supabase
      .from("unidad_funcional")
      .select("id, identificador, piso")
      .order("identificador");
    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("unidad_usuarios")
    .select("unidad_funcional:unidad_id ( id, identificador, piso )")
    .eq("usuario_id", userId);
  if (error) throw error;
  const assignedUnits = (data ?? [])
    .map((row) => row.unidad_funcional)
    .filter(Boolean);
  if (assignedUnits.length > 0) return assignedUnits;

  const fallback = await supabase
    .from("unidad_funcional")
    .select("id, identificador, piso")
    .order("identificador");
  if (fallback.error) throw fallback.error;
  return fallback.data ?? [];
}

export async function createClaim(claimData) {
  const imageUrls = await uploadClaimImages(
    claimData.images,
    claimData.reportanteId,
  );
  const payload = {
    titulo: claimData.title,
    categoria: claimData.category,
    prioridad: claimData.priority,
    unidad_funcional_id: claimData.unidadFuncionalId || null,
    ubicacion: claimData.location || "Sin ubicación",
    descripcion: claimData.description,
    reportante_id: claimData.reportanteId,
    estado: "abierto",
    fecha_creacion: new Date().toISOString(),
    fecha_cierre: null,
    cerrado_por_id: null,
    nota_admin: null,
    fecha_actualizacion: new Date().toISOString(),
    imagen_urls: imageUrls,
  };

  if (isDemoMode()) {
    const unit = claimData.unit || null;
    const newClaim = {
      ...payload,
      id: `demo-${Date.now()}`,
      unidad_funcional: unit,
      reportante: {
        nombre: claimData.reporterName || "Usuario",
        apellido: claimData.reporterSurname || "",
        email: claimData.reporterEmail || "",
      },
      imagen_urls: imageUrls,
    };
    saveStoredClaims([newClaim, ...getStoredClaims()]);
    return newClaim;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select(SELECT_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateClaimStatus(claimId, status, adminId) {
  const update = {
    estado: status,
    fecha_actualizacion: new Date().toISOString(),
    ...(status === "cerrado"
      ? { fecha_cierre: new Date().toISOString(), cerrado_por_id: adminId }
      : { fecha_cierre: null, cerrado_por_id: null }),
  };

  if (isDemoMode()) {
    const nextClaims = getStoredClaims().map((claim) =>
      claim.id === claimId ? { ...claim, ...update } : claim,
    );
    saveStoredClaims(nextClaims);
    return nextClaims.find((claim) => claim.id === claimId);
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(update)
    .eq("id", claimId)
    .select(SELECT_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateClaimPriority(claimId, priority) {
  if (isDemoMode()) {
    const nextClaims = getStoredClaims().map((claim) =>
      claim.id === claimId ? { ...claim, prioridad: priority } : claim,
    );
    saveStoredClaims(nextClaims);
    return nextClaims.find((claim) => claim.id === claimId);
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({
      prioridad: priority,
      fecha_actualizacion: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select(SELECT_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchClaimComments(claimId) {
  if (isDemoMode()) {
    return readLocalComments(claimId);
  }

  const { data, error } = await supabase
    .from(COMMENTS_TABLE_NAME)
    .select("*, autor:usuario_id ( nombre, apellido, email )")
    .eq("reclamo_id", claimId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingCommentsTable(error)) return readLocalComments(claimId);
    throw error;
  }
  return data ?? [];
}

export async function addClaimComment({ claimId, userId, comment, author }) {
  if (isDemoMode()) {
    const newComment = {
      id: `demo-comment-${Date.now()}`,
      reclamo_id: claimId,
      usuario_id: userId,
      comentario: comment,
      created_at: new Date().toISOString(),
      autor: author,
    };
    saveLocalComment(claimId, newComment);
    return newComment;
  }

  const { data, error } = await supabase
    .from(COMMENTS_TABLE_NAME)
    .insert({ reclamo_id: claimId, usuario_id: userId, comentario: comment })
    .select("*, autor:usuario_id ( nombre, apellido, email )")
    .single();
  if (error) {
    if (isMissingCommentsTable(error)) {
      const newComment = {
        id: `local-comment-${Date.now()}`,
        reclamo_id: claimId,
        usuario_id: userId,
        comentario: comment,
        created_at: new Date().toISOString(),
        autor: author,
      };
      saveLocalComment(claimId, newComment);
      return newComment;
    }
    throw error;
  }
  return data;
}
