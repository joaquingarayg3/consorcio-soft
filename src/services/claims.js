import supabase from "../supabase-client";
import { getStoredClaims, saveStoredClaims } from "../utils/claims";

const TABLE_NAME = "reclamos";
const COMMENTS_TABLE_NAME = "reclamo_comentarios";
const COMMENTS_STORAGE_KEY = "consorcio-soft-claim-comments-v1";
const CLAIMS_BUCKET = "reclamos";
const CLAIMS_VIEWED_KEY = "consorcio-soft-claims-viewed-v1";
const CLAIMS_HISTORY_KEY = "consorcio-soft-claims-history-v1";
const MAX_CLAIM_IMAGES = 5;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SELECT_FIELDS = `
  *,
  unidad_funcional:unidad_funcional_id ( id, identificador, piso, edificio_id ),
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
  if (files.length > MAX_CLAIM_IMAGES) {
    throw new Error("Podés adjuntar hasta 5 imágenes por reclamo.");
  }
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Solo se permiten imágenes JPG, PNG o WEBP.");
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Cada imagen debe pesar como máximo 5 MB.");
    }
  }
  if (isDemoMode()) return Promise.all(files.map(readFileAsDataUrl));

  const uploadedPaths = [];
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
      if (uploadedPaths.length) {
        await supabase.storage.from(CLAIMS_BUCKET).remove(uploadedPaths);
      }
      if (isMissingClaimsBucket(error)) {
        console.warn(
          "El bucket reclamos no existe; se guardarán las imágenes en el reclamo.",
        );
        return Promise.all(files.map(readFileAsDataUrl));
      }
      throw error;
    }
    uploadedPaths.push(path);
  }
  return uploadedPaths;
}

function storagePathFromImage(image) {
  if (!image || image.startsWith("data:")) return null;
  if (!image.startsWith("http")) return image;

  const match = image.match(
    /\/storage\/v1\/object\/(?:public|authenticated|sign)\/reclamos\/(.+?)(?:\?.*)?$/,
  );
  return match ? decodeURIComponent(match[1]) : null;
}

async function addSignedImageUrls(claims) {
  const normalizedClaims = claims ?? [];
  const paths = normalizedClaims.flatMap((claim) =>
    (claim.imagen_urls || claim.image_urls || [])
      .map(storagePathFromImage)
      .filter(Boolean),
  );
  if (!paths.length) return normalizedClaims;

  const { data, error } = await supabase.storage
    .from(CLAIMS_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error) throw error;

  const signedUrls = new Map(
    (data || []).map((item, index) => [paths[index], item.signedUrl]),
  );
  return normalizedClaims.map((claim) => ({
    ...claim,
    imagen_urls: (claim.imagen_urls || claim.image_urls || []).map(
      (image) => signedUrls.get(storagePathFromImage(image)) || image,
    ),
  }));
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

async function fetchActiveBuildingIdsForUser(userId) {
  if (!userId) return new Set();

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("unidad_usuarios")
    .select(
      "unidad_id, fecha_desde, fecha_hasta, unidad_funcional:unidad_id ( edificio_id )",
    )
    .eq("usuario_id", userId)
    .lte("fecha_desde", today);

  if (error) throw error;

  return new Set(
    (data ?? [])
      .filter((row) => !row.fecha_hasta || row.fecha_hasta >= today)
      .map((row) => row.unidad_funcional?.edificio_id)
      .filter(Boolean),
  );
}

export async function fetchUserNotifications(userId) {
  if (!userId || isDemoMode()) return null;

  const { data, error } = await supabase
    .from("usuario_notificaciones")
    .select(
      "id, reclamo_id, tipo, leida, ocultada, creado_en, reclamo:reclamo_id ( id, titulo, categoria, fecha_creacion, unidad_funcional:unidad_funcional_id ( edificio_id ) )",
    )
    .eq("usuario_id", userId)
    .eq("ocultada", false)
    .order("creado_en", { ascending: false });
  if (error) throw error;

  const allowedBuildingIds = await fetchActiveBuildingIdsForUser(userId);
  if (!allowedBuildingIds.size) return [];

  return (data ?? []).filter(
    (item) => allowedBuildingIds.has(item.reclamo?.unidad_funcional?.edificio_id),
  );
}

export async function markUserNotificationsAsRead(userId) {
  if (!userId || isDemoMode()) return;
  const { error } = await supabase
    .from("usuario_notificaciones")
    .update({ leida: true })
    .eq("usuario_id", userId)
    .eq("leida", false);
  if (error) throw error;
}

export async function clearUserNotifications(userId) {
  if (!userId || isDemoMode()) return;
  const { error } = await supabase
    .from("usuario_notificaciones")
    .update({ ocultada: true, leida: true })
    .eq("usuario_id", userId)
    .eq("ocultada", false);
  if (error) throw error;
}

export async function fetchClaimsForUser({ userId, userEmail, isAdmin }) {
  if (isDemoMode()) return demoClaimsForUser(userId, userEmail, isAdmin);

  const query = supabase
    .from(TABLE_NAME)
    .select(SELECT_FIELDS)
    .order("fecha_creacion", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  if (isAdmin || !userId) {
    return addSignedImageUrls(data ?? []);
  }

  const allowedBuildingIds = await fetchActiveBuildingIdsForUser(userId);
  if (!allowedBuildingIds.size) {
    return [];
  }

  return addSignedImageUrls(
    (data ?? []).filter((claim) =>
      allowedBuildingIds.has(claim.unidad_funcional?.edificio_id),
    ),
  );
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: activeAssignments, error: assignmentsError } = await supabase
    .from("unidad_usuarios")
    .select(
      "unidad_id, fecha_desde, fecha_hasta, unidad_funcional:unidad_id ( id, identificador, piso )",
    )
    .eq("usuario_id", userId)
    .lte("fecha_desde", today);
  if (assignmentsError) throw assignmentsError;
  const assignedUnits = (activeAssignments ?? [])
    .filter((row) => !row.fecha_hasta || row.fecha_hasta >= today)
    .map((row) => row.unidad_funcional)
    .filter(Boolean);
  return assignedUnits;
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
  if (error) {
    const uploadedPaths = imageUrls.filter(
      (image) =>
        image && !image.startsWith("data:") && !image.startsWith("http"),
    );
    if (uploadedPaths.length) {
      await supabase.storage.from(CLAIMS_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }
  return (await addSignedImageUrls([data]))[0];
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
  return (await addSignedImageUrls([data]))[0];
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
  return (await addSignedImageUrls([data]))[0];
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
