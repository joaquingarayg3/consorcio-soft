import { Component } from "react";
import { Isotipo } from "./Marca";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error no controlado:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center">
          <Isotipo className="h-16 w-16" />
          <p className="text-lg font-semibold text-stone-900">
            Ocurrió un error inesperado
          </p>
          <p className="max-w-sm text-sm text-stone-500">
            Algo falló al mostrar esta pantalla. Probá recargar la página; si el
            problema persiste, avisale al equipo técnico.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:bg-brand-900"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
