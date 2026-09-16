import { createClient } from "@supabase/supabase-js";

const subapaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!subapaseUrl || !supabaseKey) {
  console.warn(
    "Supabase no está configurado aún. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_KEY en tu archivo .env"
  );
}

const supabase = createClient(
  subapaseUrl || "https://tu-proyecto.supabase.co",
  supabaseKey || "tu-clave-publica-placeholder"
);

export default supabase;
