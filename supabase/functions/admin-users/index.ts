import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No autorizado" }, 401);
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
      return json({ error: "No autorizado" }, 401);
    }

    const { data: perfil, error: perfilError } = await callerClient
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfilError || perfil?.rol !== "admin") {
      return json({ error: "No tenés permisos de administrador" }, 403);
    }

    // Cliente con la clave de servicio: esto nunca llega al navegador,
    // vive solo acá, en el entorno de la función.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, nombre, apellido, rol } = body;
      if (!email || !password || !nombre || !apellido) {
        return json({ error: "Faltan datos obligatorios" }, 400);
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email: String(email).toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { nombre, apellido },
      });

      if (error) {
        return json({ error: error.message }, 400);
      }

      if (rol === "admin") {
        await adminClient
          .from("perfiles")
          .update({ rol: "admin" })
          .eq("id", data.user.id);
      }

      return json({ success: true, user: data.user });
    }

    if (action === "deactivate" || action === "reactivate") {
      const { userId } = body;
      if (!userId) {
        return json({ error: "Falta el id del usuario" }, 400);
      }

      const banDuration = action === "deactivate" ? "876000h" : "none";

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
      });

      if (error) {
        return json({ error: error.message }, 400);
      }

      await adminClient
        .from("perfiles")
        .update({ activo: action === "reactivate" })
        .eq("id", userId);

      return json({ success: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return json({ error: message }, 500);
  }
});
