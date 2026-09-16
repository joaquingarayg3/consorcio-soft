import { Component } from "react";

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
          <div
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-stone-900">
            Ocurrió un error inesperado
          </p>
          <p className="max-w-sm text-sm text-stone-500">
            Algo falló al mostrar esta pantalla. Probá recargar la página; si
            el problema persiste, avisale al equipo técnico.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 active:bg-amber-900"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
