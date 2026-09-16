import { useAuth } from "../contexts/auth-context/use-auth";
import { useLocation } from "wouter";
import { useActionState } from "react";
import AuthLayout from "./AuthLayout";

export default function Singin() {
  const { singInUser } = useAuth();
  const [, navigate] = useLocation();
  const [error, submitAction, isPending] = useActionState(
    async (previusState, formData) => {
      const email = formData.get("email");
      const password = formData.get("password");
      const {
        success,
        data,
        error: singInError,
      } = await singInUser(email, password);

      if (singInError) return new Error(singInError);
      if (success && data?.session) {
        navigate("/home");
        return null;
      }
      return null;
    },
    null,
  );

  return (
    <AuthLayout>
      <form
        action={submitAction}
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

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Correo electrónico
          </label>
          <input
            type="email"
            name="email"
            id="email"
            autoComplete="email"
            required
            aria-required="true"
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "singin-error" : undefined}
            disabled={isPending}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Contraseña
          </label>
          <input
            type="password"
            name="password"
            id="password"
            autoComplete="current-password"
            required
            aria-required="true"
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "singin-error" : undefined}
            disabled={isPending}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400"
          />
        </div>

        <button
          type="submit"
          aria-busy={isPending}
          disabled={isPending}
          className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900 disabled:cursor-not-allowed disabled:bg-amber-300"
        >
          {isPending ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>

        {error && (
          <div
            id="singin-error"
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error.message}
          </div>
        )}
      </form>
    </AuthLayout>
  );
}
