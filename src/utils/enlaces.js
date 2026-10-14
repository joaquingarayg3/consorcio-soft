// Enlaces de los correos de Supabase (verificar cuenta, recuperar contraseña).
// Llegan como /ruta?token_hash=...&type=... y se canjean desde la app.

// Devuelve el token del enlace si es del tipo esperado y tiene un formato
// razonable; si no, null. `tipos`: los valores de `type` que acepta la pantalla.
export function leerTokenDelEnlace(tipos) {
  const parametros = new URLSearchParams(window.location.search);
  const token = parametros.get("token_hash");
  const tipo = parametros.get("type");
  if (!token || !tipos.includes(tipo)) return null;
  if (token.length > 200 || !/^[\w-]+$/.test(token)) return null;
  return token;
}

// Saca el token de la barra de direcciones y del historial, para que no quede
// a la vista ni se copie sin querer al compartir la pantalla.
export function limpiarTokenDeLaDireccion() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("token_hash") && !url.searchParams.has("type")) {
    return;
  }
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
