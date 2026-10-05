import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const allowedOrigins = new Set(
  ["http://localhost:5173", Deno.env.get("APP_ORIGIN")].filter(Boolean),
);

function headersFor(req: Request) {
  const origin = req.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin":
      origin && allowedOrigins.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const defaultCorsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(req ? headersFor(req) : defaultCorsHeaders),
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: headersFor(req) });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405, req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No autorizado" }, 401, req);
    }

    // Cliente con el JWT de quien llama: solo sirve para saber quién es.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "No autorizado" }, 401, req);
    }

    const { data: perfil, error: perfilError } = await callerClient
      .from("perfiles")
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    // activo: un admin dado de baja puede tener todavía un JWT vigente.
    if (perfilError || perfil?.rol !== "admin" || perfil?.activo === false) {
      return json({ error: "No tenés permisos de administrador" }, 403, req);
    }

    // Cliente con la clave de servicio: esto nunca llega al navegador,
    // vive solo acá, en el entorno de la función.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Solicitud inválida" }, 400, req);
    }
    const { action } = body;

    if (action === "create") {
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const nombre = String(body.nombre || "").trim();
      const apellido = String(body.apellido || "").trim();
      const rol = body.rol || "user";
      const unidadId =
        typeof body.unidad_id === "string" && body.unidad_id
          ? body.unidad_id
          : null;
      const vinculo = String(body.vinculo || "propietario").trim();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 8 ||
        password.length > 72 ||
        nombre.length < 1 ||
        nombre.length > 80 ||
        apellido.length < 1 ||
        apellido.length > 80 ||
        !["user", "admin"].includes(rol) ||
        !vinculo ||
        vinculo.length > 40
      ) {
        return json({ error: "Datos de usuario inválidos" }, 400, req);
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email: String(email).toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { nombre, apellido },
      });

      if (error) {
        return json({ error: error.message }, 400, req);
      }

      if (rol === "admin") {
        const { error: profileError } = await adminClient
          .from("perfiles")
          .update({ rol: "admin" })
          .eq("id", data.user.id);
        if (profileError) {
          await adminClient.auth.admin.deleteUser(data.user.id);
          return json({ error: "No se pudo configurar el rol" }, 500, req);
        }
      }

      if (unidadId) {
        const { error: unitError } = await adminClient
          .from("unidad_usuarios")
          .insert({
            usuario_id: data.user.id,
            unidad_id: unidadId,
            vinculo,
            fecha_desde: new Date().toISOString().slice(0, 10),
          });

        if (unitError) {
          await adminClient.auth.admin.deleteUser(data.user.id);
          return json(
            { error: "No se pudo asignar la unidad al usuario" },
            500,
            req,
          );
        }
      }

      return json({ success: true, user: data.user }, 200, req);
    }

    if (action === "deactivate" || action === "reactivate") {
      const { userId } = body;
      if (typeof userId !== "string" || !UUID_RE.test(userId)) {
        return json({ error: "Falta el id del usuario" }, 400, req);
      }
      if (action === "deactivate" && userId === user.id) {
        return json(
          { error: "No podés dar de baja tu propia cuenta" },
          400,
          req,
        );
      }

      const banDuration = action === "deactivate" ? "876000h" : "none";

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
      });

      if (error) {
        return json({ error: error.message }, 400, req);
      }

      const { error: profileError } = await adminClient
        .from("perfiles")
        .update({ activo: action === "reactivate" })
        .eq("id", userId);
      if (profileError) {
        return json({ error: "No se pudo actualizar el perfil" }, 500, req);
      }

      return json({ success: true }, 200, req);
    }

    return json({ error: "Acción desconocida" }, 400, req);
  } catch (err) {
    // El detalle queda en los logs de la función, no en la respuesta.
    console.error("admin-users:", err);
    return json({ error: "Error inesperado" }, 500, req);
  }
});
