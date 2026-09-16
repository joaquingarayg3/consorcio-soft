import { useAuth } from "../contexts/auth-context/use-auth";
import { Link, useLocation } from "wouter";
import { useActionState } from "react";
import AuthLayout from "./AuthLayout";

export default function Singup() {
  const { singUpUser } = useAuth();
  const [, navigate] = useLocation();
  const [state, submitAction, isPending] = useActionState(
    async (previusState, formData) => {
      const email = formData.get("email");
      const password = formData.get("password");
      const confirmPassword = formData.get("confirmPassword");

      if (password !== confirmPassword) {
        return { error: new Error("Las contraseñas no coinciden") };
      }

      const {
        success,
        data,
        error: singUpError,
      } = await singUpUser(email, password);

      if (singUpError) return { error: new Error(singUpError) };
      if (success && data?.session) {
        navigate("/home");
        return null;
      }
      if (success) {
        return {
          message:
            "Te enviamos un correo para confirmar tu cuenta. Confirmalo antes de iniciar sesión.",
        };
      }
      return null;
    },
    null,
  );

  const error = state?.error;
  const message = state?.message;

  return (
    <AuthLayout>
      <form
        action={submitAction}
        aria-label="Sing up form"
        aria-describedby="form-description"
        className="space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Crear cuenta
          </h2>
          <p id="form-description" className="mt-1 text-sm text-stone-500">
            Ingresá tu correo electrónico y una contraseña para registrarte.
          </p>
        </div>

        <p className="text-sm text-stone-500">
          ¿Ya tenés una cuenta?{" "}
          <Link
            href="/"
            className="font-medium text-amber-700 hover:text-amber-800 hover:underline"
          >
            Iniciá sesión.
          </Link>
        </p>

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
            aria-describedby={error ? "singup-error" : undefined}
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
            autoComplete="new-password"
            required
            minLength={6}
            aria-required="true"
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "singup-error" : undefined}
            disabled={isPending}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/20 disabled:bg-stone-50 disabled:text-stone-400"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            Confirmar contraseña
          </label>
          <input
            type="password"
            name="confirmPassword"
            id="confirmPassword"
            autoComplete="new-password"
            required
            minLength={6}
            aria-required="true"
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "singup-error" : undefined}
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
          {isPending ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        {error && (
          <div
            id="singup-error"
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error.message}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            {message}
          </div>
        )}
      </form>
    </AuthLayout>
  );
}
