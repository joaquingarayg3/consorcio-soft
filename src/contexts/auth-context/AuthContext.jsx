import { useState, useEffect } from "react";
import AuthContext from "./auth";
import supabase from "../../supabase-client";

export function AuthContextProvider({ children }) {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        setSession(data.session);
      } catch (error) {
        console.error("Error getting session: ", error.message);
      }
    }
    getInitialSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);
  const singInUser = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password,
      });
      if (error) {
        console.error("Supabase sing in error: ", error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (error) {
      console.error("Unexpedted error during sing in: ", error.message);
      return { success: false, error: "Unexpedted error ocurred. Tray again" };
    }
  };
  const singUpUser = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
      });
      if (error) {
        console.error("Supabase sing up error: ", error.message);
        if (error.message.toLowerCase().includes("already registered")) {
          return {
            success: false,
            error: "Ya existe una cuenta registrada con ese correo electrónico.",
          };
        }
        return { success: false, error: error.message };
      }
      if (data?.user?.identities?.length === 0) {
        return {
          success: false,
          error: "Ya existe una cuenta registrada con ese correo electrónico.",
        };
      }
      return { success: true, data };
    } catch (error) {
      console.error("Unexpedted error during sing up: ", error.message);
      return { success: false, error: "Unexpedted error ocurred. Tray again" };
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
      value={{ session, singInUser, singUpUser, singOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
