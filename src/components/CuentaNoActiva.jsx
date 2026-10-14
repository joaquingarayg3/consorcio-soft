import { useState } from "react";
import { useAuth } from "../contexts/auth-context/use-auth";
import { BotonSecundario, IconoEstado } from "./CamposAuth";
import { FranjaMarca, PieMarca } from "./Marca";

function Marco({ children }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-stone-50 px-4 py-10">
      <FranjaMarca className="absolute inset-x-0 top-0" />
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-8">
        {children}
      </div>
      <PieMarca className="mt-8" />
    </div>
  );
}

function CerrarSesion() {
  const { singOutUser } = useAuth();
  const [cerrando, setCerrando] = useState(false);
  return (
    <BotonSecundario
      disabled={cerrando}
      onClick={async () => {
        setCerrando(true);
        await singOutUser();
        setCerrando(false);
      }}
    >
      {cerrando ? "Cerrando sesión..." : "Cerrar sesión"}
    </BotonSecundario>
  );
}

// Cuenta ya verificada que la administración todavía no activó. No ve nada más
// que esto: ni la app ni la base le muestran datos del consorcio.
function ActivacionPendiente({ perfil, correo }) {
  const { recargarPerfil } = useAuth();
  const [revisando, setRevisando] = useState(false);
  const [sinNovedades, setSinNovedades] = useState(false);

  // Si la administración la activa mientras la pantalla está abierta, se pasa
  // sola a la app: el contexto de sesión revisa el perfil cada minuto y al
  // volver a la pestaña. Este botón es para no esperar.
  async function handleRevisar() {
    setRevisando(true);
    setSinNovedades(false);
    await recargarPerfil();
    setRevisando(false);
    // Si la cuenta se activó, esta pantalla ya no se muestra: llegar acá
    // significa que sigue pendiente.
    setSinNovedades(true);
  }

  const nombre = perfil?.nombre?.trim();

  return (
    <Marco>
      <div className="space-y-5">
        <IconoEstado tipo="reloj" />
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            Activación pendiente
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {nombre ? `¡Gracias, ${nombre}! ` : "¡Gracias! "}
            Tu correo ya está verificado. Ahora la administración tiene que
            revisar tu solicitud y activar tu cuenta.
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Cuando lo haga, vas a poder ingresar. Podés cerrar esta pantalla y
            volver más tarde.
          </p>
        </div>

        <dl className="space-y-2 rounded-xl bg-stone-50 p-4 text-left text-sm">
          <div>
            <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">
              Cuenta
            </dt>
            <dd className="break-all text-stone-800">{correo}</dd>
          </div>
          {perfil?.unidad_declarada && (
            <div>
              <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                Indicaste que vivís en
              </dt>
              <dd className="text-stone-800">{perfil.unidad_declarada}</dd>
            </div>
          )}
        </dl>

        <div className="space-y-2">
          <BotonSecundario onClick={handleRevisar} disabled={revisando}>
            {revisando ? "Revisando..." : "Revisar si ya me activaron"}
          </BotonSecundario>
          {sinNovedades && !revisando && (
            <p role="status" className="text-sm text-stone-500">
              Todavía no está activada. Te va a aparecer acá apenas lo esté.
            </p>
          )}
          <CerrarSesion />
        </div>
      </div>
    </Marco>
  );
}

// Cuenta que la administración dio de baja y todavía tiene una sesión abierta.
function CuentaDeBaja({ correo }) {
  return (
    <Marco>
      <div className="space-y-5">
        <IconoEstado tipo="alerta" />
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            Tu cuenta está dada de baja
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            No podés usar la plataforma con <strong>{correo}</strong>. Si creés
            que es un error, comunicate con la administración.
          </p>
        </div>
        <CerrarSesion />
      </div>
    </Marco>
  );
}

// La sesión es válida pero no se pudo traer el perfil (sin conexión, o la
// cuenta no tiene perfil). No se muestra la app a ciegas: se ofrece reintentar.
export function PerfilNoDisponible() {
  const { recargarPerfil } = useAuth();
  const [reintentando, setReintentando] = useState(false);
  return (
    <Marco>
      <div className="space-y-5">
        <IconoEstado tipo="alerta" />
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            No pudimos cargar tu cuenta
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Revisá tu conexión e intentá de nuevo. Si el problema sigue,
            comunicate con la administración.
          </p>
        </div>
        <div className="space-y-2">
          <BotonSecundario
            disabled={reintentando}
            onClick={async () => {
              setReintentando(true);
              await recargarPerfil();
              setReintentando(false);
            }}
          >
            {reintentando ? "Reintentando..." : "Reintentar"}
          </BotonSecundario>
          <CerrarSesion />
        </div>
      </div>
    </Marco>
  );
}

// Se muestra en lugar de la app cuando la cuenta no está activa.
export default function CuentaNoActiva() {
  const { perfil, session } = useAuth();
  const correo = perfil?.email ?? session?.user?.email ?? "";
  // Pendiente: todavía nadie de la administración la aprobó.
  const pendiente = !perfil?.aprobado_en;

  return pendiente ? (
    <ActivacionPendiente perfil={perfil} correo={correo} />
  ) : (
    <CuentaDeBaja correo={correo} />
  );
}
