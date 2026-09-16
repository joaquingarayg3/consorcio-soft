import { useState, useEffect, useCallback } from "react";
import AuthContext from "./auth";
import supabase from "../../supabase-client";

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

  const loadPerfil = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null);
      return;
    }
    const { data, error } = await supabase
      .from("perfiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("Error getting perfil: ", error.message);
      setPerfil(null);
      return;
    }
    setPerfil(data);
  }, []);

  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        setSession(data.session);
        await loadPerfil(data.session?.user?.id);
      } catch (error) {
        console.error("Error getting session: ", error.message);
      }
    }
    getInitialSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadPerfil(session?.user?.id);
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
    <AuthContext.Provider
      value={{ session, perfil, singInUser, singOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
