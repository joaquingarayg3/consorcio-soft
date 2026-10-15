// CAPTCHA de Cloudflare Turnstile (gratis). Se activa solo si hay clave pública
// en VITE_TURNSTILE_SITE_KEY: sin clave, los formularios funcionan igual que
// antes y no se carga nada de Cloudflare.
//
// Ojo: la clave SECRETA no va nunca acá ni en el repositorio; se carga en
// Supabase (Authentication → Bot and Abuse Protection), que es quien valida el
// token que se manda en cada registro, inicio de sesión y recuperación.

export const CLAVE_CAPTCHA = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
export const CAPTCHA_ACTIVO = CLAVE_CAPTCHA !== "";

export const MENSAJE_CAPTCHA_FALTA =
  "Esperá un instante a que termine la verificación de seguridad y probá de nuevo.";

const URL_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let carga = null;

// Descarga el script de Turnstile una sola vez, sin importar cuántos
// formularios lo pidan. Si falla, la próxima vez se vuelve a intentar.
export function cargarTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  carga ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = URL_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => {
      carga = null;
      script.remove();
      reject(new Error("No se pudo cargar la verificación de seguridad"));
    };
    document.head.appendChild(script);
  });
  return carga;
}
