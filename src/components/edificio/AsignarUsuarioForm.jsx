import { useEffect, useState } from "react";
import {
  buscarUsuariosActivos,
  fetchAsignacionesVigentes,
} from "../../services/usuarios";
import { mensajeDeError } from "../../utils/supabase-errors";
import { ModalFormButton } from "../ModalForm";

const VINCULOS = [
  { valor: "propietario", etiqueta: "Propietario" },
  { valor: "inquilino", etiqueta: "Inquilino" },
];

const etiquetaDe = (vinculo) =>
  VINCULOS.find((v) => v.valor === vinculo)?.etiqueta ?? vinculo;

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400";

function iniciales(usuario) {
  const letras = `${usuario.nombre?.[0] ?? ""}${usuario.apellido?.[0] ?? ""}`;
  return (letras || usuario.email?.[0] || "?").toUpperCase();
}

// Una persona puede tener varias unidades (en distintos edificios o en el
// mismo): acá se muestran las que ya tiene, para que el admin lo sepa al asignar.
function resumenOtrasUnidades(otras) {
  if (otras.length === 0) return "";
  const visibles = otras
    .slice(0, 2)
    .map(
      (a) =>
        `${etiquetaDe(a.vinculo)} de ${a.unidad}${a.edificio ? ` (${a.edificio})` : ""}`,
    );
  const resto = otras.length - visibles.length;
  return `También: ${visibles.join(", ")}${resto > 0 ? ` y ${resto} más` : ""}`;
}

// Buscar y elegir a quién asignar a una unidad. Vive dentro del modal, así que
// la búsqueda y la selección arrancan de cero cada vez que se abre.
export default function AsignarUsuarioForm({
  unidadId,
  asignando,
  error,
  onAsignar,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [resultado, setResultado] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [vinculo, setVinculo] = useState("propietario");

  // Con teclado físico se enfoca el buscador; en el celular no, para que el
  // teclado en pantalla no tape la lista.
  const enfocarBuscador =
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: fine)").matches;

  useEffect(() => {
    let activo = true;
    const espera = setTimeout(
      async () => {
        try {
          const { usuarios, hayMas } = await buscarUsuariosActivos(busqueda);
          // Sus otras unidades son un dato de ayuda: si no cargan, se asigna igual.
          let asignaciones = {};
          try {
            asignaciones = await fetchAsignacionesVigentes(
              usuarios.map((u) => u.id),
            );
          } catch (asignacionesError) {
            console.error(
              "No se pudieron cargar las unidades de los usuarios",
              asignacionesError,
            );
          }
          if (activo) {
            setResultado({ para: busqueda, usuarios, hayMas, asignaciones });
          }
        } catch (loadError) {
          console.error("No se pudo buscar usuarios", loadError);
          if (activo) {
            setResultado({
              para: busqueda,
              usuarios: [],
              hayMas: false,
              asignaciones: {},
              error: mensajeDeError(
                loadError,
                "No se pudieron buscar los usuarios.",
              ),
            });
          }
        }
      },
      busqueda ? 250 : 0,
    );
    return () => {
      activo = false;
      clearTimeout(espera);
    };
  }, [busqueda]);

  const buscando = resultado === null || resultado.para !== busqueda;
  const usuarios = resultado?.usuarios ?? [];
  const asignacionesDe = (usuarioId) =>
    resultado?.asignaciones?.[usuarioId] ?? [];

  // Lo único que se frena es repetir lo mismo: el mismo vínculo, todavía
  // abierto, en esta misma unidad.
  const yaTieneEseVinculo =
    seleccionado != null &&
    asignacionesDe(seleccionado.id).some(
      (a) => a.unidadId === unidadId && a.vinculo === vinculo,
    );

  function handleSubmit(e) {
    e.preventDefault();
    if (seleccionado && !yaTieneEseVinculo)
      onAsignar(
        seleccionado.id,
        vinculo,
        `${seleccionado.nombre} ${seleccionado.apellido}`,
      );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="buscar-usuario" className="sr-only">
          Buscar usuario
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            id="buscar-usuario"
            type="text"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            autoFocus={enfocarBuscador}
            placeholder="Buscar por nombre, apellido o email"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            disabled={asignando}
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>

      <div>
        <ul
          aria-label="Usuarios encontrados"
          aria-busy={buscando}
          className="max-h-64 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200"
        >
          {usuarios.map((usuario) => {
            const elegido = seleccionado?.id === usuario.id;
            const asignaciones = asignacionesDe(usuario.id);
            const aca = asignaciones.filter((a) => a.unidadId === unidadId);
            const otras = asignaciones.filter((a) => a.unidadId !== unidadId);
            const resumen = resumenOtrasUnidades(otras);
            return (
              <li key={usuario.id}>
                <button
                  type="button"
                  disabled={asignando}
                  aria-pressed={elegido}
                  onClick={() => setSeleccionado(usuario)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-600/50 disabled:cursor-not-allowed ${
                    elegido ? "bg-amber-50" : "hover:bg-stone-50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      elegido
                        ? "bg-amber-700 text-white"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {elegido ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      iniciales(usuario)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">
                      {usuario.nombre} {usuario.apellido}
                    </span>
                    <span className="block truncate text-sm text-stone-500">
                      {usuario.email}
                    </span>
                    {resumen && (
                      <span className="line-clamp-2 block text-xs text-stone-400">
                        {resumen}
                      </span>
                    )}
                  </span>
                  {aca.length > 0 && (
                    <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                      Ya es {aca.map((a) => etiquetaDe(a.vinculo)).join(" y ")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}

          {buscando && usuarios.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-stone-500">
              Buscando...
            </li>
          )}
          {!buscando && usuarios.length === 0 && !resultado?.error && (
            <li className="px-3 py-6 text-center text-sm text-stone-500">
              {busqueda.trim()
                ? `No encontramos usuarios para «${busqueda.trim()}».`
                : "Todavía no hay usuarios activos."}
            </li>
          )}
        </ul>
        {resultado?.hayMas && !buscando && (
          <p className="mt-2 px-1 text-xs text-stone-500">
            Hay más resultados: escribí más letras para acotar la búsqueda.
          </p>
        )}
        {resultado?.error && !buscando && (
          <p role="alert" className="mt-2 px-1 text-sm text-red-700">
            {resultado.error}
          </p>
        )}
      </div>

      <fieldset disabled={asignando}>
        <legend className="mb-1 block text-sm font-medium text-stone-700">
          Vínculo con la unidad
        </legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200/60 p-1">
          {VINCULOS.map(({ valor, etiqueta }) => (
            <label
              key={valor}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-600/50 ${
                vinculo === valor
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <input
                type="radio"
                name="vinculo"
                value={valor}
                checked={vinculo === valor}
                onChange={() => setVinculo(valor)}
                className="sr-only"
              />
              {etiqueta}
            </label>
          ))}
        </div>
      </fieldset>

      {seleccionado && !yaTieneEseVinculo ? (
        <ModalFormButton
          loading={asignando}
          label={`Asignar a ${seleccionado.nombre} ${seleccionado.apellido}`}
          loadingLabel="Asignando..."
        />
      ) : (
        <button
          type="button"
          disabled
          className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-lg bg-stone-200 px-3 text-center text-base font-semibold text-stone-500"
        >
          {yaTieneEseVinculo
            ? `Ya es ${etiquetaDe(vinculo).toLowerCase()} de esta unidad`
            : "Elegí un usuario de la lista"}
        </button>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </form>
  );
}
