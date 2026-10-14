import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import {
  Alerta,
  BotonPrincipal,
  CampoContrasena,
  CampoTexto,
} from "../components/CamposAuth";
import { useAuth } from "../contexts/auth-context/use-auth";
import supabase from "../supabase-client";
import { guardarNuevaContrasena } from "../services/cuenta";
import { fetchMisAsignaciones } from "../services/vecino";
import {
  NOMBRE_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  validarContrasena,
} from "../utils/cuenta";
import { mensajeDeError } from "../utils/supabase-errors";
import { TELEFONO_MAX, validarTelefono } from "../utils/telefono";

function Tarjeta({ titulo, descripcion, children }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
      {descripcion && (
        <p className="mt-0.5 text-sm text-stone-500">{descripcion}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DatosPersonales() {
  const { session, perfil, recargarPerfil } = useAuth();
  const [nombre, setNombre] = useState(perfil?.nombre ?? "");
  const [apellido, setApellido] = useState(perfil?.apellido ?? "");
  const [telefono, setTelefono] = useState(perfil?.telefono ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  async function handleGuardar(e) {
    e.preventDefault();
    if (guardando) return;
    setGuardado(false);

    const nombreLimpio = nombre.trim();
    const apellidoLimpio = apellido.trim();
    if (!nombreLimpio || !apellidoLimpio) {
      setError("El nombre y el apellido no pueden quedar vacíos.");
      return;
    }
    const numero = validarTelefono(telefono, { obligatorio: false });
    if (numero.error) {
      setError(numero.error);
      return;
    }

    setGuardando(true);
    setError(null);
    const { error: errorBase } = await supabase
      .from("perfiles")
      .update({
        nombre: nombreLimpio,
        apellido: apellidoLimpio,
        telefono: numero.valor,
      })
      .eq("id", session.user.id);

    if (errorBase) {
      setGuardando(false);
      setError(
        mensajeDeError(errorBase, "No se pudieron guardar los cambios."),
      );
      return;
    }
    // Se vuelve a pedir el perfil para que la cabecera y el resto de la app
    // muestren los datos nuevos.
    await recargarPerfil();
    setNombre(nombreLimpio);
    setApellido(apellidoLimpio);
    setTelefono(numero.valor ?? "");
    setGuardando(false);
    setGuardado(true);
  }

  return (
    <form onSubmit={handleGuardar} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          id="perfil-nombre"
          label="Nombre"
          type="text"
          autoComplete="given-name"
          required
          maxLength={NOMBRE_MAX}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={guardando}
        />
        <CampoTexto
          id="perfil-apellido"
          label="Apellido"
          type="text"
          autoComplete="family-name"
          required
          maxLength={NOMBRE_MAX}
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          disabled={guardando}
        />
      </div>

      <CampoTexto
        id="perfil-telefono"
        label="Teléfono"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        maxLength={TELEFONO_MAX}
        placeholder="Ej.: 11 5555-1234"
        ayuda="Opcional. Lo ve la administración."
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        disabled={guardando}
      />

      <div>
        <p className="mb-1 text-sm font-medium text-stone-700">
          Correo electrónico
        </p>
        <p className="rounded-lg bg-stone-50 px-3 py-2.5 text-base break-all text-stone-700">
          {session?.user?.email}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Es con el que iniciás sesión. Para cambiarlo, comunicate con la
          administración.
        </p>
      </div>

      {error && <Alerta>{error}</Alerta>}
      {guardado && <Alerta tipo="exito">Tus datos se guardaron.</Alerta>}

      <BotonPrincipal
        cargando={guardando}
        etiqueta="Guardar cambios"
        etiquetaCargando="Guardando..."
      />
    </form>
  );
}

function CambiarContrasena() {
  const [contrasena, setContrasena] = useState("");
  const [repeticion, setRepeticion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  async function handleGuardar(e) {
    e.preventDefault();
    if (guardando) return;
    setGuardado(false);

    const problema = validarContrasena(contrasena, repeticion);
    if (problema) {
      setError(problema);
      return;
    }

    setGuardando(true);
    setError(null);
    const resultado = await guardarNuevaContrasena(contrasena);
    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setContrasena("");
    setRepeticion("");
    setGuardado(true);
  }

  return (
    <form onSubmit={handleGuardar} noValidate className="space-y-4">
      <CampoContrasena
        id="perfil-contrasena"
        label="Contraseña nueva"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        ayuda={`Al menos ${PASSWORD_MIN} caracteres.`}
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
        disabled={guardando}
      />
      <CampoContrasena
        id="perfil-repeticion"
        label="Repetí la contraseña nueva"
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        value={repeticion}
        onChange={(e) => setRepeticion(e.target.value)}
        disabled={guardando}
        invalido={repeticion !== "" && repeticion !== contrasena}
      />

      {error && <Alerta>{error}</Alerta>}
      {guardado && (
        <Alerta tipo="exito">
          Cambiaste tu contraseña. Por seguridad, cerramos las sesiones que
          tuvieras abiertas en otros dispositivos.
        </Alerta>
      )}

      <BotonPrincipal
        cargando={guardando}
        etiqueta="Cambiar contraseña"
        etiquetaCargando="Guardando..."
      />
    </form>
  );
}

function MisUnidades() {
  const { session } = useAuth();
  const idUsuario = session?.user?.id;
  const [unidades, setUnidades] = useState(null);

  useEffect(() => {
    if (!idUsuario) return;
    let vigente = true;
    fetchMisAsignaciones(idUsuario)
      .then((filas) => {
        if (vigente) setUnidades(filas);
      })
      .catch(() => {
        if (vigente) setUnidades([]);
      });
    return () => {
      vigente = false;
    };
  }, [idUsuario]);

  if (unidades === null) {
    return <p className="text-sm text-stone-500">Cargando...</p>;
  }
  if (unidades.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Todavía no tenés una unidad asignada. La asigna la administración.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
      {unidades.map((fila) => (
        <li
          key={fila.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-stone-900">
              {fila.unidad_funcional.edificio?.nombre ?? "Edificio"}
            </p>
            <p className="text-sm text-stone-500">
              Unidad {fila.unidad_funcional.identificador}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 capitalize">
            {fila.vinculo}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Perfil() {
  const { perfil } = useAuth();

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/home" />

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Mi perfil</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {perfil?.rol === "admin" ? "Administrador" : "Vecino"}
          </p>
        </div>

        <Tarjeta
          titulo="Mis datos"
          descripcion="Podés corregir tu nombre y tu teléfono cuando quieras."
        >
          <DatosPersonales />
        </Tarjeta>

        {perfil?.rol !== "admin" && (
          <Tarjeta
            titulo="Mis unidades"
            descripcion="Solo lectura. Si algo no coincide, avisale a la administración."
          >
            <MisUnidades />
          </Tarjeta>
        )}

        <Tarjeta titulo="Contraseña">
          <CambiarContrasena />
        </Tarjeta>
      </main>
    </div>
  );
}
