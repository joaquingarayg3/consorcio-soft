// Seguimiento de la navegación dentro de la app, para que la flecha de "Volver"
// lleve a la pantalla de la que se vino y no a una dirección fija.
//
// A cada entrada del historial se le anota un número (`idxNavegacion`): la
// primera es 0 y cada pantalla a la que se avanza suma 1. Reemplazar la
// dirección (redirecciones, limpiar parámetros) no suma, porque no agrega una
// pantalla. Con número mayor que 0 hay seguro una pantalla anterior de la app;
// con 0 se entró directo (enlace, recarga en una página interna) y "Volver" va
// a la pantalla "padre" que corresponda.

const CLAVE = "idxNavegacion";

export function indiceNavegacion() {
  const indice = window.history.state?.[CLAVE];
  return Number.isInteger(indice) ? indice : 0;
}

export function puedeVolverAtras() {
  return indiceNavegacion() > 0;
}

function comoObjeto(estado) {
  return typeof estado === "object" && estado !== null ? estado : {};
}

// Se llama una sola vez, al arrancar. Envuelve pushState y replaceState, que es
// lo que usa el enrutador (wouter) para navegar.
export function instalarSeguimientoNavegacion() {
  if (typeof window === "undefined" || window.__seguimientoNavegacion) return;
  window.__seguimientoNavegacion = true;

  const { pushState, replaceState } = window.history;

  window.history.pushState = function pushConIndice(estado, titulo, url) {
    return pushState.call(
      this,
      { ...comoObjeto(estado), [CLAVE]: indiceNavegacion() + 1 },
      titulo,
      url,
    );
  };

  window.history.replaceState = function replaceConIndice(estado, titulo, url) {
    return replaceState.call(
      this,
      { ...comoObjeto(estado), [CLAVE]: indiceNavegacion() },
      titulo,
      url,
    );
  };
}
