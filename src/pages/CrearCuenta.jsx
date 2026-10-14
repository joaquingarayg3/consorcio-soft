import { useState } from "react";
import { Link } from "wouter";
import AuthLayout from "../components/AuthLayout";
import {
  Alerta,
  BotonPrincipal,
  BotonSecundario,
  CampoContrasena,
  CampoTexto,
  IconoEstado,
} from "../components/CamposAuth";
import { useEnfriamiento } from "../hooks/useEnfriamiento";
import { registrarCuenta, reenviarVerificacion } from "../services/cuenta";
import {
  NOMBRE_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  UNIDAD_MAX,
  normalizarCorreo,
  validarRegistro,
} from "../utils/cuenta";

const enlaceClase =
  "font-semibold text-brand-700 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50";

// Pantalla que sigue al registro. Dice lo mismo exista o no el correo en el
// sistema, para no revelar quién tiene cuenta.
function RevisaTuCorreo({ email }) {
  const [reenviando, setReenviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [restante, iniciarEnfriamiento] = useEnfriamiento(60);

  async function handleReenviar() {
    setReenviando(true);
    setResultado(null);
    const respuesta = await reenviarVerificacion(email);
    setReenviando(false);
    if (respuesta.ok) {
      iniciarEnfriamiento();
      setResultado({ tipo: "exito", texto: "Listo, te lo mandamos de nuevo." });
    } else {
      setResultado({ tipo: "error", texto: respuesta.error });
    }
  }

  return (
    <div className="space-y-5 text-center">
      <IconoEstado tipo="correo" />
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Revisá tu correo
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Te enviamos un enlace de verificación a{" "}
          <span className="font-medium break-all text-stone-900">{email}</span>.
          Tocalo para confirmar que el correo es tuyo.
        </p>
      </div>

      <ol className="space-y-2 rounded-xl bg-stone-50 p-4 text-left text-sm text-stone-600">
        <li>
          <span className="font-semibold text-stone-800">1.</span> Abrí el
          correo y tocá <em>Verificar mi correo</em>.
        </li>
        <li>
          <span className="font-semibold text-stone-800">2.</span> La
          administración revisa tu solicitud y activa tu cuenta.
        </li>
        <li>
          <span className="font-semibold text-stone-800">3.</span> Ya podés
          ingresar y usar la plataforma.
        </li>
      </ol>

      <p className="text-xs text-stone-500">
        Si no lo ves en unos minutos, mirá la carpeta de spam. Si ya tenías una
        cuenta con este correo, usá{" "}
        <Link href="/olvide-contrasena" className={enlaceClase}>
          ¿Olvidaste tu contraseña?
        </Link>
        .
      </p>

      <div className="space-y-2">
        <BotonSecundario
          onClick={handleReenviar}
          disabled={reenviando || restante > 0}
        >
          {reenviando
            ? "Enviando..."
            : restante > 0
              ? `Reenviar correo (${restante} s)`
              : "Reenviar correo"}
        </BotonSecundario>
        {resultado && <Alerta tipo={resultado.tipo}>{resultado.texto}</Alerta>}
      </div>

      <p className="text-sm">
        <Link href="/" className={enlaceClase}>
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}

export default function CrearCuenta() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [unidad, setUnidad] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repeticion, setRepeticion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [enviadoA, setEnviadoA] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;

    const problema = validarRegistro({
      nombre,
      apellido,
      email,
      unidad,
      contrasena,
      repeticion,
    });
    if (problema) {
      setError(problema);
      return;
    }

    setEnviando(true);
    setError(null);
    const resultado = await registrarCuenta({
      nombre,
      apellido,
      email,
      unidad,
      contrasena,
    });
    setEnviando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    // La contraseña no se guarda en pantalla más de lo necesario.
    setContrasena("");
    setRepeticion("");
    setEnviadoA(normalizarCorreo(email));
  }

  return (
    <AuthLayout>
      {enviadoA ? (
        <RevisaTuCorreo email={enviadoA} />
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label="Formulario para crear una cuenta"
            className="space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                Crear cuenta
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Completá tus datos. Te vamos a mandar un correo para verificar
                tu cuenta y después la administración la activa.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                id="nombre"
                label="Nombre"
                type="text"
                autoComplete="given-name"
                required
                maxLength={NOMBRE_MAX}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={enviando}
              />
              <CampoTexto
                id="apellido"
                label="Apellido"
                type="text"
                autoComplete="family-name"
                required
                maxLength={NOMBRE_MAX}
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                disabled={enviando}
              />
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
            />

            <CampoTexto
              id="unidad"
              label="¿Dónde vivís?"
              type="text"
              autoComplete="off"
              required
              maxLength={UNIDAD_MAX}
              placeholder="Ej.: Av. Corrientes 1234, 5° B"
              ayuda="Dirección del edificio y tu unidad. Le sirve a la administración para identificarte."
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              disabled={enviando}
            />

            <CampoContrasena
              id="contrasena"
              label="Contraseña"
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

            {error && <Alerta id="registro-error">{error}</Alerta>}

            <BotonPrincipal
              cargando={enviando}
              etiqueta="Crear cuenta"
              etiquetaCargando="Creando cuenta..."
            />
          </form>

          <div className="mt-6 border-t border-stone-200 pt-5 text-center text-sm text-stone-600">
            ¿Ya tenés cuenta?{" "}
            <Link href="/" className={enlaceClase}>
              Iniciá sesión
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
