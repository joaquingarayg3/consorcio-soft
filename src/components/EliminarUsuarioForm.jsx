import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-stone-50 disabled:text-stone-400";

const normalizar = (texto) =>
  String(texto ?? "")
    .trim()
    .toLowerCase();

// Eliminar un usuario no se puede deshacer, así que se confirma dos veces:
// primero se explica qué se pierde y qué se conserva; después hay que escribir
// el email de la persona para habilitar el botón final. Vive dentro del modal,
// así que siempre arranca en el primer paso.
export default function EliminarUsuarioForm({
  usuario,
  eliminando,
  error,
  onCancelar,
  onConfirmar,
}) {
  const [paso, setPaso] = useState(1);
  const [escrito, setEscrito] = useState("");

  const nombre = `${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim();
  const coincide =
    normalizar(usuario.email) !== "" &&
    normalizar(escrito) === normalizar(usuario.email);

  if (paso === 1) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">
            Vas a eliminar a {nombre || usuario.email}.
          </p>
          <p className="mt-0.5 break-all text-red-800">{usuario.email}</p>
          <p className="mt-3 font-semibold">Esto no se puede deshacer.</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>
              Se borran sus datos personales (nombre, email y acceso) y{" "}
              <strong>no se pueden recuperar</strong>.
            </li>
            <li>Se quitan sus asignaciones a unidades.</li>
            <li>
              Sus reclamos, comentarios y anuncios se conservan, pero dejan de
              mostrar su nombre.
            </li>
          </ul>
        </div>
        <p className="text-sm text-stone-600">
          Si solo querés que no pueda ingresar, dejalo inactivo: eso se puede
          revertir cuando quieras.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setPaso(2)}
            className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
          >
            Entiendo, continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (coincide && !eliminando) onConfirmar();
      }}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="confirmar-email"
          className="mb-1 block text-sm font-medium text-stone-700"
        >
          Para confirmar, escribí el email de la persona:
        </label>
        <p className="mb-2 break-all rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm text-stone-800 select-all">
          {usuario.email}
        </p>
        <input
          id="confirmar-email"
          type="text"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          disabled={eliminando}
          placeholder="Escribí el email acá"
          className={inputClass}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            setPaso(1);
            setEscrito("");
          }}
          disabled={eliminando}
          className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={!coincide || eliminando}
          className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
        >
          {eliminando ? "Eliminando..." : "Eliminar definitivamente"}
        </button>
      </div>
    </form>
  );
}
