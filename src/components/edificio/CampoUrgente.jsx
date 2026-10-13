import { DURACIONES_URGENTE, aValorLocal } from "../../utils/anuncios";
import { formatearFechaHora } from "../../utils/fechas";
import SegmentedControl from "../SegmentedControl";

const OPCIONES = DURACIONES_URGENTE.map((duracion) => ({
  value: duracion.value,
  label: duracion.label,
  activa: "bg-brand-100 text-brand-800 ring-1 ring-brand-300",
  punto: "bg-brand-600",
}));

// "Marcar como urgente" y, solo si se marca, por cuánto tiempo. Vencido ese
// plazo, el anuncio deja de destacarse y queda en el tablón como los demás.
export default function CampoUrgente({
  idPrefijo,
  value,
  onChange,
  ahora,
  otrosUrgentes = [],
  disabled = false,
}) {
  const cambiar = (parcial) => onChange({ ...value, ...parcial });

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        value.activa
          ? "border-brand-200 bg-brand-50/50"
          : "border-stone-200 bg-stone-50"
      }`}
    >
      <label
        htmlFor={`${idPrefijo}-urgente`}
        className="flex cursor-pointer items-start gap-3"
      >
        <input
          id={`${idPrefijo}-urgente`}
          type="checkbox"
          checked={value.activa}
          disabled={disabled}
          onChange={(e) => cambiar({ activa: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 accent-brand-700"
        />
        <span>
          <span className="block text-sm font-semibold text-stone-900">
            Marcar como urgente
          </span>
          <span className="block text-xs text-stone-500">
            Se destaca arriba de todo en el inicio de los vecinos hasta que
            venza.
          </span>
        </span>
      </label>

      {value.activa && otrosUrgentes.length > 0 && (
        <div
          role="status"
          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p className="font-semibold">
            {otrosUrgentes.length === 1
              ? "Este edificio ya tiene un aviso urgente vigente."
              : `Este edificio ya tiene ${otrosUrgentes.length} avisos urgentes vigentes.`}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {otrosUrgentes.slice(0, 3).map((anuncio) => (
              <li key={anuncio.id}>
                «{anuncio.titulo}», hasta el{" "}
                {formatearFechaHora(anuncio.urgente_hasta)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            Si todo es urgente, nada se destaca: usalo solo para lo que los
            vecinos tienen que ver hoy.
          </p>
        </div>
      )}

      {value.activa && (
        <div className="mt-3 space-y-3">
          <SegmentedControl
            legend="Urgente durante"
            value={value.duracion}
            onChange={(duracion) => cambiar({ duracion })}
            options={OPCIONES}
            disabled={disabled}
          />
          {value.duracion === "fecha" && (
            <div>
              <label
                htmlFor={`${idPrefijo}-urgente-fecha`}
                className="mb-1 block text-sm font-medium text-stone-700"
              >
                Urgente hasta
              </label>
              <input
                id={`${idPrefijo}-urgente-fecha`}
                type="datetime-local"
                required
                min={aValorLocal(ahora)}
                value={value.fecha}
                onChange={(e) => cambiar({ fecha: e.target.value })}
                disabled={disabled}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-stone-50"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
