import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import AuthLayout from "../components/AuthLayout";
import {
  Alerta,
  BotonPrincipal,
  CampoContrasena,
  IconoEstado,
} from "../components/CamposAuth";
import {
  guardarNuevaContrasena,
  verificarRecuperacion,
} from "../services/cuenta";
import { PASSWORD_MAX, PASSWORD_MIN, validarContrasena } from "../utils/cuenta";
import {
  leerTokenDelEnlace,
  limpiarTokenDeLaDireccion,
} from "../utils/enlaces";

const enlaceClase =
  "font-semibold text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50";

// Destino del enlace "Elegir nueva contraseña". El token se canjea recién al
// guardar la contraseña nueva, no al abrir la página.
export default function RestablecerContrasena() {
  const [, navigate] = useLocation();
  const [token] = useState(() => leerTokenDelEnlace(["recovery"]));
  const [contrasena, setContrasena] = useState("");
  const [repeticion, setRepeticion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // El enlace ya se canjeó y hay sesión: si falla guardar la contraseña (por
  // ejemplo, por débil) se reintenta sin volver a gastar el enlace.
  const [sesionAbierta, setSesionAbierta] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    limpiarTokenDeLaDireccion();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando || !token) return;

    const problema = validarContrasena(contrasena, repeticion);
    if (problema) {
      setError(problema);
      return;
    }

    setEnviando(true);
    setError(null);

    if (!sesionAbierta) {
      const verificacion = await verificarRecuperacion(token);
      if (!verificacion.ok) {
        setEnviando(false);
        setError(verificacion.error);
        return;
      }
      setSesionAbierta(true);
    }

    const guardado = await guardarNuevaContrasena(contrasena);
    setEnviando(false);
    if (!guardado.ok) {
      setError(guardado.error);
      return;
    }
    setContrasena("");
    setRepeticion("");
    setListo(true);
  }

  if (listo) {
    return (
      <AuthLayout>
        <div className="space-y-5 text-center">
          <IconoEstado tipo="ok" />
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Contraseña actualizada
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Ya podés usar tu contraseña nueva. Por seguridad, cerramos las
              sesiones que tuvieras abiertas en otros dispositivos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900"
          >
            Continuar
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="space-y-5 text-center">
          <IconoEstado tipo="alerta" />
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              El enlace no es válido
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Parece que el enlace está incompleto o ya venció. Pedí uno nuevo
              para elegir tu contraseña.
            </p>
          </div>
          <Link href="/olvide-contrasena" className={enlaceClase}>
            Pedir un enlace nuevo
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Formulario para elegir una contraseña nueva"
        className="space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Elegí tu nueva contraseña
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Escribila dos veces para asegurarte de que no haya errores.
          </p>
        </div>

        <CampoContrasena
          id="contrasena"
          label="Contraseña nueva"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          ayuda={`Al menos ${PASSWORD_MIN} caracteres.`}
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          disabled={enviando}
        />

        <CampoContrasena
          id="repeticion"
          label="Repetí la contraseña"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX}
          value={repeticion}
          onChange={(e) => setRepeticion(e.target.value)}
          disabled={enviando}
          invalido={repeticion !== "" && repeticion !== contrasena}
        />

        {error && <Alerta id="restablecer-error">{error}</Alerta>}

        <BotonPrincipal
          cargando={enviando}
          etiqueta="Guardar contraseña"
          etiquetaCargando="Guardando..."
        />

        {error && !sesionAbierta && (
          <p className="text-center text-sm text-stone-600">
            Si el enlace venció,{" "}
            <Link href="/olvide-contrasena" className={enlaceClase}>
              pedí uno nuevo
            </Link>
            .
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
