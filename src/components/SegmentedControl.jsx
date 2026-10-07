import { useId } from "react";

// Elegir una opción entre pocas, siempre a la vista (en lugar de un desplegable).
// Son radios nativos escondidos detrás de botones: se usan con teclado (flechas),
// lectores de pantalla y toque, y la opción elegida lleva su propio color.
// `options`: [{ value, label, activa, punto }] con las clases de Tailwind
// completas (activa: fondo/texto/anillo de la elegida; punto: color del punto).
export default function SegmentedControl({
  legend,
  value,
  onChange,
  options,
  disabled = false,
  className = "",
}) {
  const name = useId();

  return (
    <fieldset disabled={disabled} className={className}>
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-stone-500 uppercase">
        {legend}
      </legend>
      <div
        className="grid gap-1 rounded-xl bg-stone-200/60 p-1"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => {
          const elegida = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-1 text-[13px] font-semibold whitespace-nowrap sm:px-2 sm:text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-600/50 ${
                elegida
                  ? `${option.activa} shadow-sm`
                  : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={elegida}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`hidden h-2 w-2 shrink-0 rounded-full sm:block ${option.punto} ${
                  elegida ? "" : "opacity-50"
                }`}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
