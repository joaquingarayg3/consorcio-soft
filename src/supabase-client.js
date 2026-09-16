import { createClient } from "@supabase/supabase-js";
const { VITE_SUPABASE_URL: subapaseUrl, VITE_SUPABASE_KEY: supabaseKey } =
  import.meta.env;

const supabase = createClient(subapaseUrl, supabaseKey);

export default supabase;
