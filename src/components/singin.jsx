import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../contexts/auth-context/use-auth";
import { useEnfriamiento } from "../hooks/useEnfriamiento";
import { reenviarVerificacion } from "../services/cuenta";
import { CAPTCHA_ACTIVO, MENSAJE_CAPTCHA_FALTA } from "../utils/captcha";
import AuthLayout from "./AuthLayout";
import Captcha from "./Captcha";
import {
  Alerta,
  BotonPrincipal,
  BotonSecundario,
  CampoContrasena,
  CampoTexto,
} from "./CamposAuth";

export default function Singin() {
  const { singInUser } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // Cuenta creada pero con el correo sin verificar: se ofrece reenviar el mail.
  const [sinVerificar, setSinVerificar] = useState(false);
  const [reenvio, setReenvio] = useState(null);
  const [reenviando, setReenviando] = useState(false);
  const [restante, iniciarEnfriamiento] = useEnfriamiento(60);
  const [captchaToken, setCaptchaToken] = useState(null);
  const captcha = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    if (CAPTCHA_ACTIVO && !captchaToken) {
      setError(MENSAJE_CAPTCHA_FALTA);
      return;
    }
    setEnviando(true);
    setError(null);
    setReenvio(null);
    setSinVerificar(false);

    const {
      success,
      data,
      error: singInError,
      codigo,
    } = await singInUser(email, password, captchaToken);
    setEnviando(false);
    // Cada token sirve para un solo intento.
    captcha.current?.reiniciar();

    if (singInError) {
      setError(singInError);
      setSinVerificar(codigo === "email_not_confirmed");
      // La contraseña mal escrita se borra; el correo queda para corregirla.
      setPassword("");
      return;
    }
    if (success && data?.session) navigate("/home");
  }

  async function handleReenviar() {
    if (CAPTCHA_ACTIVO && !captchaToken) {
      setReenvio({ tipo: "error", texto: MENSAJE_CAPTCHA_FALTA });
      return;
    }
    setReenviando(true);
    setReenvio(null);
    const resultado = await reenviarVerificacion(email, captchaToken);
    setReenviando(false);
    captcha.current?.reiniciar();
    if (resultado.ok) {
      iniciarEnfriamiento();
      setReenvio({
        tipo: "exito",
        texto:
          "Te mandamos otro correo de verificación. Revisá también la carpeta de spam.",
      });
    } else {
      setReenvio({ tipo: "error", texto: resultado.error });
    }
  }

  return (
    <AuthLayout>
      <form
        onSubmit={handleSubmit}
        aria-label="Formulario de inicio de sesión"
        aria-describedby="form-description"
        className="space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Inicio de sesión
          </h2>
          <p id="form-description" className="mt-1 text-sm text-stone-500">
            Ingresá tu correo electrónico y tu contraseña para continuar.
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

        <div>
          <CampoContrasena
            id="password"
            label="Contraseña"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={enviando}
            invalido={!!error}
          />
          <p className="mt-1.5 text-right text-sm">
            <Link
              href="/olvide-contrasena"
              className="font-medium text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </div>

        <Captcha ref={captcha} onToken={setCaptchaToken} />

        <BotonPrincipal
          cargando={enviando}
          etiqueta="Iniciar sesión"
          etiquetaCargando="Iniciando sesión..."
        />

        {error && <Alerta id="singin-error">{error}</Alerta>}

        {sinVerificar && (
          <div className="space-y-2">
            <BotonSecundario
              onClick={handleReenviar}
              disabled={reenviando || restante > 0 || !email.trim()}
            >
              {reenviando
                ? "Enviando..."
                : restante > 0
                  ? `Reenviar correo (${restante} s)`
                  : "Reenviar correo de verificación"}
            </BotonSecundario>
            {reenvio && <Alerta tipo={reenvio.tipo}>{reenvio.texto}</Alerta>}
          </div>
        )}
      </form>

      <div className="mt-6 border-t border-stone-200 pt-5 text-center text-sm text-stone-600">
        ¿Primera vez en la plataforma?{" "}
        <Link
          href="/crear-cuenta"
          className="font-semibold text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
        >
          Creá tu cuenta
        </Link>
      </div>
    </AuthLayout>
  );
}
