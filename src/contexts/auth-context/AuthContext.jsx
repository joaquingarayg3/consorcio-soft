import { useState, useEffect, useCallback, useRef } from "react";
import AuthContext from "./auth";
import supabase from "../../supabase-client";

const PERFIL_REINTENTOS = [500, 1500, 3000];

function traducirErrorSingIn(mensaje) {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Correo electrónico o contraseña incorrectos.";
  }
  if (m.includes("banned") || m.includes("suspended")) {
    return "Esta cuenta fue dada de baja. Contactá al administrador.";
  }
  if (m.includes("email not confirmed")) {
    return "Tu cuenta todavía no fue confirmada. Contactá al administrador.";
  }
  return mensaje;
}

export function AuthContextProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);

  const perfilUserId = useRef(null);

  const loadPerfil = useCallback(async (userId) => {
    if (!userId) {
      perfilUserId.current = null;
      setPerfil(null);
      return;
    }
    // onAuthStateChange avisa también al refrescar el token: no volver a
    // pedir el perfil del mismo usuario.
    if (perfilUserId.current === userId) return;
    perfilUserId.current = userId;
    // undefined = cargando: las rutas de admin esperan en vez de redirigir.
    setPerfil(undefined);

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
        setPerfil(data);
        return;
      }
      if (intento === PERFIL_REINTENTOS.length) {
        console.error("Error getting perfil: ", error.message);
        perfilUserId.current = null;
        setPerfil(null);
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, PERFIL_REINTENTOS[intento]),
      );
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
      setTimeout(() => loadPerfil(session?.user?.id), 0);
    });
    return () => subscription.unsubscribe();
  }, [loadPerfil]);

  const singInUser = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });
      if (error) {
        console.error("Supabase sing in error: ", error.message);
        return { success: false, error: traducirErrorSingIn(error.message) };
      }
      return { success: true, data };
    } catch (error) {
      console.error("Unexpedted error during sing in: ", error.message);
      return {
        success: false,
        error: "Ocurrió un error inesperado. Intentá de nuevo.",
      };
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
    <AuthContext.Provider value={{ session, perfil, singInUser, singOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}
