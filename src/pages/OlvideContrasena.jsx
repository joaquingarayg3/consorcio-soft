import { useRef, useState } from "react";
import { Link } from "wouter";
import AuthLayout from "../components/AuthLayout";
import Captcha from "../components/Captcha";
import {
  Alerta,
  BotonPrincipal,
  BotonSecundario,
  CampoTexto,
  IconoEstado,
} from "../components/CamposAuth";
import { useEnfriamiento } from "../hooks/useEnfriamiento";
import { pedirRecuperacion } from "../services/cuenta";
import { CAPTCHA_ACTIVO, MENSAJE_CAPTCHA_FALTA } from "../utils/captcha";
import { FORMATO_CORREO, normalizarCorreo } from "../utils/cuenta";

const enlaceClase =
  "font-semibold text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50";

export default function OlvideContrasena() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [enviadoA, setEnviadoA] = useState(null);
  const [restante, iniciarEnfriamiento] = useEnfriamiento(60);
  const [captchaToken, setCaptchaToken] = useState(null);
  const captcha = useRef(null);

  async function enviar(correo) {
    if (CAPTCHA_ACTIVO && !captchaToken) {
      setError(MENSAJE_CAPTCHA_FALTA);
      return false;
    }
    setEnviando(true);
    setError(null);
    const resultado = await pedirRecuperacion(correo, captchaToken);
    setEnviando(false);
    // Cada token sirve para un solo intento.
    captcha.current?.reiniciar();
    if (!resultado.ok) {
      setError(resultado.error);
      return false;
    }
    iniciarEnfriamiento();
    setEnviadoA(correo);
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    const correo = normalizarCorreo(email);
    if (!FORMATO_CORREO.test(correo)) {
      setError("Ingresá un correo electrónico válido.");
      return;
    }
    await enviar(correo);
  }

  return (
    <AuthLayout>
      {enviadoA ? (
        <div className="space-y-5 text-center">
          <IconoEstado tipo="correo" />
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Revisá tu correo
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Si <span className="font-medium break-all">{enviadoA}</span> tiene
              una cuenta, te enviamos un enlace para elegir una contraseña
              nueva. Puede tardar unos minutos: mirá también la carpeta de spam.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              El enlace vale por tiempo limitado y solo se puede usar una vez.
            </p>
          </div>

          <div className="space-y-2">
            <Captcha ref={captcha} onToken={setCaptchaToken} />
            <BotonSecundario
              onClick={() => enviar(enviadoA)}
              disabled={enviando || restante > 0}
            >
              {enviando
                ? "Enviando..."
                : restante > 0
                  ? `Reenviar correo (${restante} s)`
                  : "Reenviar correo"}
            </BotonSecundario>
            {error && <Alerta>{error}</Alerta>}
          </div>

          <p className="text-sm">
            <button
              type="button"
              onClick={() => {
                setEnviadoA(null);
                setError(null);
              }}
              className={enlaceClase}
            >
              Usar otro correo
            </button>
            <span aria-hidden="true" className="mx-2 text-stone-300">
              ·
            </span>
            <Link href="/" className={enlaceClase}>
              Volver al inicio
            </Link>
          </p>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label="Formulario para recuperar la contraseña"
            className="space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                Recuperar contraseña
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Ingresá el correo con el que te registraste y te mandamos un
                enlace para elegir una contraseña nueva.
              </p>
            </div>

            <CampoTexto
              id="email"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
              invalido={!!error}
            />

            <Captcha ref={captcha} onToken={setCaptchaToken} />

            {error && <Alerta id="recuperar-error">{error}</Alerta>}

            <BotonPrincipal
              cargando={enviando}
              etiqueta="Enviar enlace"
              etiquetaCargando="Enviando..."
            />
          </form>

          <div className="mt-6 border-t border-stone-200 pt-5 text-center text-sm text-stone-600">
            <Link href="/" className={enlaceClase}>
              Volver al inicio de sesión
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
