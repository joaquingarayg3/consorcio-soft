import { useMemo, useState } from "react";
import {
  normalizarNombre,
  parsearPegado,
  porcentajeAFraccion,
} from "../../utils/coeficientes";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 font-mono text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

// Cruza lo pegado con las unidades del edificio por su nombre (o por su número
// de UF). Devuelve lo que se encontró, lo que no, y lo que tiene un valor que no
// se entiende.
function analizar(texto, unidades, metodo) {
  const porNombre = new Map();
  for (const unidad of unidades) {
    porNombre.set(normalizarNombre(unidad.identificador), unidad);
    if (unidad.numero_uf) {
      porNombre.set(normalizarNombre(`UF ${unidad.numero_uf}`), unidad);
    }
  }

  const aplicar = [];
  const noEncontradas = [];
  const valorInvalido = [];
  const vistas = new Set();

  for (const linea of parsearPegado(texto)) {
    const unidad = porNombre.get(normalizarNombre(linea.nombre));
    if (!unidad) {
      noEncontradas.push(linea.nombre);
      continue;
    }
    if (vistas.has(unidad.id)) continue;
    vistas.add(unidad.id);

    if (metodo === "manual") {
      const fraccion = porcentajeAFraccion(linea.valor);
      if (fraccion === null || fraccion > 1) {
        valorInvalido.push(`${unidad.identificador} («${linea.valor}»)`);
        continue;
      }
      aplicar.push({ unidadId: unidad.id, valor: linea.valor });
    } else if (metodo === "partes_iguales") {
      const peso = Number(String(linea.valor).replace(",", "."));
      aplicar.push({
        unidadId: unidad.id,
        peso: peso > 0 ? String(peso).replace(".", ",") : "1",
      });
    } else {
      aplicar.push({ unidadId: unidad.id });
    }
  }
  return { aplicar, noEncontradas, valorInvalido };
}

const AYUDA = {
  manual:
    "Pegá dos columnas copiadas del Excel: la unidad y su porcentaje (por ejemplo, 6,46).",
  partes_iguales:
    "Pegá la columna de las unidades que participan y, si hace falta, una segunda con su peso (por defecto 1).",
  derivado:
    "Pegá la columna de las unidades que participan. Los valores se calculan solos.",
};

// Contenido de la ventana "Pegar desde Excel".
export default function PegarCoeficientes({
  unidades,
  metodo,
  onAplicar,
  onCancelar,
}) {
  const [texto, setTexto] = useState("");
  const resultado = useMemo(
    () => analizar(texto, unidades, metodo),
    [texto, unidades, metodo],
  );
  const hayTexto = texto.trim() !== "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">{AYUDA[metodo]}</p>
      <div>
        <label
          htmlFor="pegar-coeficientes"
          className="mb-1 block text-sm font-medium text-stone-700"
        >
          Datos copiados
        </label>
        <textarea
          id="pegar-coeficientes"
          rows={8}
          spellCheck={false}
          autoComplete="off"
          placeholder={"1A\t6,46\n1B\t5,90\nCoch 1\t0,65"}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={inputClass}
        />
      </div>

      {hayTexto && (
        <div className="space-y-2 text-sm" aria-live="polite">
          <p className="font-medium text-green-700">
            {resultado.aplicar.length === 1
              ? "1 unidad encontrada."
              : `${resultado.aplicar.length} unidades encontradas.`}
          </p>
          {resultado.valorInvalido.length > 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              <strong>Valor que no se entiende</strong> (se ignoran):{" "}
              {resultado.valorInvalido.join(", ")}.
            </p>
          )}
          {resultado.noEncontradas.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <strong>No coinciden con ninguna unidad</strong> (se ignoran):{" "}
              {resultado.noEncontradas.join(", ")}. Revisá que el nombre sea
              igual al de la unidad.
            </p>
          )}
        </div>
      )}

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
          disabled={resultado.aplicar.length === 0}
          onClick={() => onAplicar(resultado.aplicar)}
          className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
        >
          Aplicar a la tabla
        </button>
      </div>
      <p className="text-xs text-stone-500">
        Aplicar solo completa la tabla: no se guarda nada hasta que toques
        «Guardar borrador».
      </p>
    </div>
  );
}
