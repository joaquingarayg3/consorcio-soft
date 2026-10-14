import { formatearCuit, MAX_TEXTO_BANCARIO } from "../../utils/edificio";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

// CUIT y datos bancarios de un edificio. Los usa el alta (ventana "Nuevo
// edificio") y la pestaña Datos. `valores` y `onCambiar(campo, valor)` los
// maneja quien lo usa; `prefijo` evita ids repetidos si hay dos formularios.
export default function CamposFiscales({
  valores,
  onCambiar,
  disabled = false,
  prefijo = "fiscal",
}) {
  const id = (campo) => `${prefijo}-${campo}`;

  return (
    <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      <legend className="px-1 text-sm font-semibold text-stone-700">
        Datos fiscales y bancarios{" "}
        <span className="font-normal text-stone-400">(opcionales)</span>
      </legend>
      <p className="text-xs text-stone-500">
        Los ven los administradores y los vecinos de este edificio, en el botón
        de contactos e información útil, para que puedan pagar las expensas.
      </p>

      <div>
        <label htmlFor={id("cuit")} className={labelClass}>
          CUIT del consorcio
        </label>
        <input
          id={id("cuit")}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="30-12345678-9"
          maxLength={13}
          value={valores.cuit}
          onChange={(e) => onCambiar("cuit", formatearCuit(e.target.value))}
          disabled={disabled}
          className={`${inputClass} font-mono sm:w-56`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("banco")} className={labelClass}>
            Banco
          </label>
          <input
            id={id("banco")}
            type="text"
            autoComplete="off"
            maxLength={MAX_TEXTO_BANCARIO}
            value={valores.banco}
            onChange={(e) => onCambiar("banco", e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={id("titular")} className={labelClass}>
            Titular de la cuenta
          </label>
          <input
            id={id("titular")}
            type="text"
            autoComplete="off"
            maxLength={MAX_TEXTO_BANCARIO}
            value={valores.titular}
            onChange={(e) => onCambiar("titular", e.target.value)}
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("cbu")} className={labelClass}>
            CBU
          </label>
          <input
            id={id("cbu")}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={22}
            placeholder="22 dígitos"
            value={valores.cbu}
            onChange={(e) =>
              onCambiar("cbu", e.target.value.replace(/\D/g, "").slice(0, 22))
            }
            disabled={disabled}
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label htmlFor={id("alias")} className={labelClass}>
            Alias
          </label>
          <input
            id={id("alias")}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={20}
            placeholder="mi.consorcio.expensas"
            value={valores.alias}
            onChange={(e) =>
              onCambiar("alias", e.target.value.replace(/\s/g, ""))
            }
            disabled={disabled}
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>
    </fieldset>
  );
}
