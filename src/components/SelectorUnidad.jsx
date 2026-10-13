import { useEffect, useId, useRef, useState } from "react";

// Lista desplegable propia (en vez del select nativo): cada opción muestra un
// título y un detalle. Se usa con el mouse, el toque y el teclado (flechas,
// Inicio/Fin, Enter, Esc), y avisa a los lectores de pantalla que es una lista.
// `opciones`: [{ value, titulo, detalle }].
export default function SelectorUnidad({
  etiqueta,
  opciones,
  value,
  onChange,
}) {
  const idLista = useId();
  const contenedor = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);

  const indiceElegido = Math.max(
    0,
    opciones.findIndex((opcion) => opcion.value === value),
  );
  const elegida = opciones[indiceElegido];

  useEffect(() => {
    if (!abierto) return undefined;
    function alTocarAfuera(evento) {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", alTocarAfuera);
    return () => document.removeEventListener("mousedown", alTocarAfuera);
  }, [abierto]);

  function abrir() {
    setActiva(indiceElegido);
    setAbierto(true);
  }

  function elegir(indice) {
    onChange(opciones[indice].value);
    setAbierto(false);
  }

  function alTeclear(evento) {
    if (!abierto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(evento.key)) {
        evento.preventDefault();
        abrir();
      }
      return;
    }
    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        setActiva((i) => Math.min(opciones.length - 1, i + 1));
        break;
      case "ArrowUp":
        evento.preventDefault();
        setActiva((i) => Math.max(0, i - 1));
        break;
      case "Home":
        evento.preventDefault();
        setActiva(0);
        break;
      case "End":
        evento.preventDefault();
        setActiva(opciones.length - 1);
        break;
      case "Enter":
      case " ":
        evento.preventDefault();
        elegir(activa);
        break;
      case "Escape":
        evento.preventDefault();
        setAbierto(false);
        break;
      case "Tab":
        setAbierto(false);
        break;
      default:
    }
  }

  return (
    <div ref={contenedor} className="relative">
      <span className="mb-1 block text-xs font-medium tracking-wide text-stone-500 uppercase">
        {etiqueta}
      </span>
      <button
        type="button"
        role="combobox"
        aria-label={etiqueta}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={abierto ? `${idLista}-${activa}` : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclear}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-stone-300 bg-white px-4 py-2 text-left shadow-sm transition-colors hover:border-stone-400 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-stone-900">
            {elegida?.titulo}
          </span>
          {elegida?.detalle && (
            <span className="block truncate text-sm text-stone-500">
              {elegida.detalle}
            </span>
          )}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 shrink-0 text-stone-400 transition-transform ${
            abierto ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={etiqueta}
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl"
        >
          {opciones.map((opcion, indice) => {
            const esElegida = opcion.value === value;
            return (
              <li
                key={opcion.value}
                id={`${idLista}-${indice}`}
                role="option"
                aria-selected={esElegida}
                onMouseEnter={() => setActiva(indice)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(indice)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${
                  indice === activa ? "bg-amber-50" : ""
                }`}
              >
                <span className="min-w-0">
                  <span
                    className={`block truncate ${
                      esElegida
                        ? "font-semibold text-brand-800"
                        : "font-medium text-stone-900"
                    }`}
                  >
                    {opcion.titulo}
                  </span>
                  {opcion.detalle && (
                    <span className="block truncate text-sm text-stone-500">
                      {opcion.detalle}
                    </span>
                  )}
                </span>
                {esElegida && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-brand-700"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
