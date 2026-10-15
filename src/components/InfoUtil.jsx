import { useEffect, useState } from "react";
import { useAuth } from "../contexts/auth-context/use-auth";
import { fetchInfoUtil } from "../services/contactos";
import { fetchMisAsignaciones } from "../services/vecino";
import {
  formatearCbu,
  formatearCuit,
  tieneDatosFiscales,
} from "../utils/edificio";
import { mensajeDeError } from "../utils/supabase-errors";
import { enlaceTelefono } from "../utils/telefono";

const iconoTelefono = (
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
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </svg>
);

// Copia un texto. Primero con la API moderna del portapapeles; si el navegador no
// la permite (por ejemplo en una conexión sin https), con el método antiguo.
async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      campo.remove();
    }
  }
}

// Botón para copiar un dato (CBU, alias, CUIT) con un toque.
function BotonCopiar({ valor, etiqueta }) {
  const [estado, setEstado] = useState(null); // null | "copiado" | "fallo"

  async function copiar() {
    const copiado = await copiarTexto(valor);
    setEstado(copiado ? "copiado" : "fallo");
    setTimeout(() => setEstado(null), 2200);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${etiqueta}`}
      className="shrink-0 rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
    >
      {estado === "copiado"
        ? "¡Copiado!"
        : estado === "fallo"
          ? "Copialo a mano"
          : "Copiar"}
    </button>
  );
}

function Dato({ etiqueta, children, copiar }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <dt className="text-xs text-stone-500">{etiqueta}</dt>
        <dd className="font-medium break-words text-stone-900">{children}</dd>
      </div>
      {copiar && <BotonCopiar valor={copiar} etiqueta={etiqueta} />}
    </div>
  );
}

function SeccionEdificio({ edificio, mostrarNombre }) {
  return (
    <section className="px-4 py-3">
      {mostrarNombre && (
        <div className="mb-2">
          <h3 className="font-semibold text-stone-900">{edificio.nombre}</h3>
          {edificio.direccion && (
            <p className="text-xs text-stone-500">{edificio.direccion}</p>
          )}
        </div>
      )}

      <h4 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
        Contactos
      </h4>
      {edificio.contactos.length === 0 ? (
        <p className="mt-1 text-sm text-stone-500">
          La administración todavía no cargó contactos.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {edificio.contactos.map((contacto) => (
            <li key={contacto.id}>
              <a
                href={enlaceTelefono(contacto.telefono)}
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 transition-colors hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"
                >
                  {iconoTelefono}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-stone-900">
                    {contacto.nombre}
                  </span>
                  <span className="block text-sm text-brand-700">
                    {contacto.telefono}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {tieneDatosFiscales(edificio) && (
        <>
          <h4 className="mt-4 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Datos del consorcio
          </h4>
          <dl className="mt-1 divide-y divide-stone-100 text-sm">
            {edificio.cuit && (
              <Dato etiqueta="CUIT" copiar={edificio.cuit}>
                {formatearCuit(edificio.cuit)}
              </Dato>
            )}
            {edificio.banco && <Dato etiqueta="Banco">{edificio.banco}</Dato>}
            {edificio.titular_cuenta && (
              <Dato etiqueta="Titular de la cuenta">
                {edificio.titular_cuenta}
              </Dato>
            )}
            {edificio.cbu && (
              <Dato etiqueta="CBU" copiar={edificio.cbu}>
                <span className="font-mono text-[13px]">
                  {formatearCbu(edificio.cbu)}
                </span>
              </Dato>
            )}
            {edificio.alias_cbu && (
              <Dato etiqueta="Alias" copiar={edificio.alias_cbu}>
                <span className="font-mono">{edificio.alias_cbu}</span>
              </Dato>
            )}
          </dl>
        </>
      )}
    </section>
  );
}

// Botón del teléfono de la cabecera y su ventana: contactos útiles y datos del
// consorcio de cada edificio de la persona. Si no tiene ningún edificio no se
// dibuja nada. La apertura la maneja la cabecera (`abierto`, `onAlternar`) para
// que se cierre al tocar afuera y no convivan dos ventanas abiertas.
export default function InfoUtil({ abierto, onAlternar, contenedorRef }) {
  const { session } = useAuth();
  const idUsuario = session?.user?.id;
  const [edificioIds, setEdificioIds] = useState(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  // Edificios en los que la persona tiene una unidad hoy (se piden una vez).
  useEffect(() => {
    if (!idUsuario) return;
    let vigente = true;
    fetchMisAsignaciones(idUsuario)
      .then((asignaciones) => {
        if (!vigente) return;
        const ids = [
          ...new Set(asignaciones.map((a) => a.unidad_funcional.edificio_id)),
        ];
        setEdificioIds(ids);
      })
      .catch(() => {
        if (vigente) setEdificioIds([]);
      });
    return () => {
      vigente = false;
    };
  }, [idUsuario]);

  // Cada vez que se abre se vuelve a pedir, para ver lo último que cargó la
  // administración; mientras tanto se muestra lo que ya había.
  useEffect(() => {
    if (!abierto || !edificioIds?.length) return;
    let vigente = true;
    fetchInfoUtil(edificioIds)
      .then((filas) => {
        if (!vigente) return;
        setInfo(filas);
        setError(null);
      })
      .catch((falla) => {
        if (vigente) setError(mensajeDeError(falla));
      });
    return () => {
      vigente = false;
    };
  }, [abierto, edificioIds]);

  if (!edificioIds?.length) return null;

  return (
    <div ref={contenedorRef} className="sm:relative">
      <button
        type="button"
        aria-label="Contactos e información útil"
        aria-expanded={abierto}
        title="Contactos e información útil"
        onClick={onAlternar}
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 sm:h-10 sm:w-10 ${
          abierto
            ? "bg-amber-500 text-white"
            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
        }`}
      >
        {iconoTelefono}
      </button>

      {abierto && (
        <div className="absolute inset-x-3 top-full z-50 mt-1 max-h-[min(34rem,calc(100dvh-5rem))] overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl sm:inset-x-auto sm:top-12 sm:right-0 sm:mt-0 sm:w-[24rem]">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="font-semibold text-stone-900">
              Contactos e información útil
            </p>
            <p className="text-xs text-stone-500">
              Tocá un número para llamar.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {info === null && !error && (
            <p className="px-4 py-6 text-center text-sm text-stone-500">
              Cargando...
            </p>
          )}
          {info?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-stone-500">
              No hay información para mostrar.
            </p>
          )}
          <div className="divide-y divide-stone-100">
            {info?.map((edificio) => (
              <SeccionEdificio
                key={edificio.id}
                edificio={edificio}
                mostrarNombre
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
