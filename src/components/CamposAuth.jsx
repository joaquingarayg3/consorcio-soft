import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50 disabled:text-stone-400";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";

// Campo de texto con su etiqueta y, si hace falta, una línea de ayuda.
export function CampoTexto({ id, label, ayuda, invalido, ...resto }) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={invalido ? "true" : undefined}
        aria-describedby={idAyuda}
        className={inputClass}
        {...resto}
      />
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-xs text-stone-500">
          {ayuda}
        </p>
      )}
    </div>
  );
}

// Contraseña con botón para mostrarla u ocultarla: en el celular se escribe
// mal y sin poder ver lo que se tipea se cometen errores.
export function CampoContrasena({ id, label, ayuda, invalido, ...resto }) {
  const [visible, setVisible] = useState(false);
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={invalido ? "true" : undefined}
          aria-describedby={idAyuda}
          className={`${inputClass} pr-12`}
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 4.5 10 6-.4.6-1.2 1.6-2.4 2.6M6.6 6.7C4 8.3 2.4 10.6 2 12c1 1.5 5 6 10 6 1.5 0 2.9-.4 4.1-1" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </>
            ) : (
              <>
                <path d="M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-xs text-stone-500">
          {ayuda}
        </p>
      )}
    </div>
  );
}

const TIPOS_ALERTA = {
  error: "border-red-200 bg-red-50 text-red-700",
  exito: "border-green-200 bg-green-50 text-green-800",
  aviso: "border-amber-200 bg-amber-50 text-amber-900",
};

// Mensaje dentro del formulario. Los errores se anuncian al instante a los
// lectores de pantalla (role="alert"); lo demás, sin interrumpir.
export function Alerta({ tipo = "error", id, children }) {
  return (
    <div
      id={id}
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${TIPOS_ALERTA[tipo]}`}
    >
      {children}
    </div>
  );
}

export function BotonPrincipal({
  cargando = false,
  etiqueta,
  etiquetaCargando,
  ...resto
}) {
  return (
    <button
      type="submit"
      aria-busy={cargando}
      disabled={cargando}
      className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
      {...resto}
    >
      {cargando ? etiquetaCargando : etiqueta}
    </button>
  );
}

// Botón secundario (por ejemplo "Reenviar correo").
export function BotonSecundario({ children, ...resto }) {
  return (
    <button
      type="button"
      className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-base font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
      {...resto}
    >
      {children}
    </button>
  );
}

// Ícono redondo que encabeza las pantallas de estado ("revisá tu correo").
export function IconoEstado({ tipo = "correo" }) {
  const trazos = {
    correo: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    ok: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    reloj: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    alerta: (
      <>
        <path d="M12 8v5M12 16.5h.01" />
        <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </>
    ),
  };
  const colores =
    tipo === "ok"
      ? "bg-green-100 text-green-700"
      : tipo === "alerta"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return (
    <div
      aria-hidden="true"
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${colores}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
      >
        {trazos[tipo]}
      </svg>
    </div>
  );
}
