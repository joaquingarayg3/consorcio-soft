import { useState, useEffect, useCallback, useRef } from "react";
import AuthContext from "./auth";
import supabase from "../../supabase-client";
import { codigoDeErrorAuth, traducirErrorAuth } from "../../utils/auth-errors";

const PERFIL_REINTENTOS = [500, 1500, 3000];
// Cada cuánto se vuelve a revisar el perfil mientras hay una sesión abierta,
// para enterarse si la administración dio de baja (o activó) la cuenta.
const REVISION_PERFIL_MS = 60_000;
// Entre dos revisiones por volver a la pestaña tiene que pasar al menos esto.
const REVISION_MINIMA_MS = 10_000;

const mismoPerfil = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function AuthContextProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);

  const perfilUserId = useRef(null);
  const revisandoPerfil = useRef(false);
  const ultimaRevision = useRef(0);

  const loadPerfil = useCallback(async (userId, { forzar = false } = {}) => {
    if (!userId) {
      perfilUserId.current = null;
      setPerfil(null);
      return;
    }
    // onAuthStateChange avisa también al refrescar el token: no volver a
    // pedir el perfil del mismo usuario (salvo que se pida a propósito, por
    // ejemplo para saber si la administración ya activó la cuenta).
    if (perfilUserId.current === userId && !forzar) return;
    perfilUserId.current = userId;
    // undefined = cargando: las rutas de admin esperan en vez de redirigir. Al
    // recargar a propósito se deja el perfil que hay hasta tener el nuevo.
    if (!forzar) setPerfil(undefined);
    // Una sola recarga a propósito a la vez: si la anterior sigue reintentando
    // (por ejemplo, sin internet) no se apilan más.
    if (forzar) {
      if (revisandoPerfil.current) return;
      revisandoPerfil.current = true;
    }

    try {
      // Justo después de iniciar sesión Supabase puede rechazar el token unos
      // segundos ("JWT issued at future"); reintentamos antes de rendirnos.
      for (let intento = 0; intento < PERFIL_REINTENTOS.length + 1; intento++) {
        const { data, error } = await supabase
          .from("perfiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (perfilUserId.current !== userId) return;
        if (!error) {
          // Si no cambió nada se conserva el objeto de antes: así las revisiones
          // periódicas no vuelven a dibujar la pantalla.
          setPerfil((anterior) =>
            mismoPerfil(anterior, data) ? anterior : data,
          );
          return;
        }
        if (intento === PERFIL_REINTENTOS.length) {
          console.error("Error getting perfil: ", error.message);
          // Al recargar a propósito se conserva el perfil que ya había: un corte
          // de internet no tiene que tirar abajo la pantalla en la que se está.
          if (!forzar) {
            perfilUserId.current = null;
            setPerfil(null);
          }
          return;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, PERFIL_REINTENTOS[intento]),
        );
      }
    } finally {
      if (forzar) revisandoPerfil.current = false;
    }
  }, []);

  useEffect(() => {
    // INITIAL_SESSION llega apenas se suscribe, así que no hace falta
    // llamar además a getSession(). La consulta va fuera del callback:
    // Supabase puede trabarse si se consulta mientras notifica el cambio.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Si cambió la persona, el perfil anterior ya no vale: queda "cargando"
      // desde este mismo momento, así ninguna pantalla se arma con el perfil de
      // otro (o sin perfil) mientras llega el nuevo.
      const idNuevo = session?.user?.id ?? null;
      if (idNuevo !== perfilUserId.current) {
        setPerfil(idNuevo ? undefined : null);
      }
      setTimeout(() => loadPerfil(idNuevo), 0);
    });
    return () => subscription.unsubscribe();
  }, [loadPerfil]);

  // Vuelve a pedir el perfil de la sesión actual.
  const recargarPerfil = useCallback(
    () => loadPerfil(session?.user?.id, { forzar: true }),
    [loadPerfil, session],
  );

  // Mientras hay una sesión abierta se revisa el perfil cada tanto y al volver
  // a la pestaña. Así, si la administración da de baja (o activa) la cuenta, la
  // pantalla lo refleja en menos de un minuto sin que la persona tenga que
  // refrescar. La base ya le cierra el acceso a los datos en el acto: esto es
  // solo para que la pantalla no quede mostrando una app vacía.
  const idSesion = session?.user?.id;
  useEffect(() => {
    if (!idSesion) return;

    function revisar(porVolver) {
      if (document.visibilityState !== "visible") return;
      const ahora = Date.now();
      if (porVolver && ahora - ultimaRevision.current < REVISION_MINIMA_MS) {
        return;
      }
      ultimaRevision.current = ahora;
      loadPerfil(idSesion, { forzar: true });
    }
    const alVolver = () => revisar(true);
    const alPasarElTiempo = () => revisar(false);

    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    const intervalo = setInterval(alPasarElTiempo, REVISION_PERFIL_MS);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      clearInterval(intervalo);
    };
  }, [idSesion, loadPerfil]);

  const singInUser = async (email, password, captchaToken) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
        options: { captchaToken },
      });
      // Credenciales incorrectas o cuenta dada de baja: el mensaje ya se
      // muestra en el formulario, no es un error de la aplicación.
      if (error) {
        return {
          success: false,
          error: traducirErrorAuth(error),
          codigo: codigoDeErrorAuth(error),
        };
      }
      return { success: true, data };
    } catch (error) {
      console.error("Unexpedted error during sing in: ", error.message);
      return { success: false, error: traducirErrorAuth(error) };
    }
  };
  const singOutUser = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Supabase sing out error: ", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  };
  return (
    <AuthContext.Provider
      value={{ session, perfil, singInUser, singOutUser, recargarPerfil }}
    >
      {children}
    </AuthContext.Provider>
  );
}
