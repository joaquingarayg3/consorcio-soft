import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import AuthLayout from "../components/AuthLayout";
import { Alerta, BotonPrincipal, IconoEstado } from "../components/CamposAuth";
import { confirmarCorreo } from "../services/cuenta";
import {
  leerTokenDelEnlace,
  limpiarTokenDeLaDireccion,
} from "../utils/enlaces";

const enlaceClase =
  "font-semibold text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50";

// Destino del enlace "Verificar mi correo". El token viaja en la dirección; se
// canjea recién cuando la persona toca el botón (ver confirmarCorreo).
export default function ConfirmarCuenta() {
  const [, navigate] = useLocation();
  // Se lee una sola vez: después se borra de la barra de direcciones.
  const [token] = useState(() => leerTokenDelEnlace(["email", "signup"]));
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    limpiarTokenDeLaDireccion();
  }, []);

  async function handleConfirmar() {
    if (verificando || !token) return;
    setVerificando(true);
    setError(null);
    const resultado = await confirmarCorreo(token);
    setVerificando(false);
    if (resultado.ok) {
      setListo(true);
    } else {
      setError(resultado.error);
    }
  }

  if (listo) {
    return (
      <AuthLayout>
        <div className="space-y-5 text-center">
          <IconoEstado tipo="ok" />
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              ¡Correo verificado!
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Tu cuenta quedó creada. Ahora la administración tiene que
              activarla: mientras tanto vas a ver una pantalla de espera.
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
              Parece que el enlace está incompleto. Abrilo de nuevo desde el
              correo, o iniciá sesión para pedir otro.
            </p>
          </div>
          <Link href="/" className={enlaceClase}>
            Ir al inicio de sesión
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-5 text-center">
        <IconoEstado tipo="correo" />
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Verificá tu correo
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Tocá el botón para confirmar que este correo es tuyo y terminar de
            crear tu cuenta.
          </p>
        </div>

        {error && (
          <div className="space-y-3 text-left">
            <Alerta id="confirmar-error">{error}</Alerta>
            <p className="text-center text-sm text-stone-600">
              Si ya verificaste tu correo,{" "}
              <Link href="/" className={enlaceClase}>
                iniciá sesión
              </Link>
              . Si el enlace venció, ingresá igual para pedir uno nuevo.
            </p>
          </div>
        )}

        <BotonPrincipal
          type="button"
          onClick={handleConfirmar}
          cargando={verificando}
          etiqueta={error ? "Probar de nuevo" : "Verificar mi correo"}
          etiquetaCargando="Verificando..."
        />
      </div>
    </AuthLayout>
  );
}
