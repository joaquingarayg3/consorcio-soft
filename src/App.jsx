import { lazy, Suspense } from "react";
import { Router, Switch, Route, Redirect } from "wouter";
import { MotionConfig } from "motion/react";
import Singin from "./components/singin";
import Home from "./pages/home";
import { AuthContextProvider } from "./contexts/auth-context/AuthContext";
import { useAuth } from "./contexts/auth-context/use-auth";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";

const RECARGA_KEY = "consorcio-soft-recarga-por-version";

// Cada pantalla se descarga recién cuando se abre: un usuario común nunca
// baja el código de administración. Si se publicó una versión nueva con la
// página abierta, el archivo viejo ya no existe: se recarga una sola vez.
function pantalla(importar) {
  return lazy(() =>
    importar()
      .then((modulo) => {
        try {
          sessionStorage.removeItem(RECARGA_KEY);
        } catch {
          // Almacenamiento bloqueado: no hay marca que limpiar.
        }
        return modulo;
      })
      .catch((error) => {
        let yaRecargo = true;
        try {
          yaRecargo = sessionStorage.getItem(RECARGA_KEY) === "1";
          if (!yaRecargo) sessionStorage.setItem(RECARGA_KEY, "1");
        } catch {
          // Sin almacenamiento no podemos evitar un bucle: no recargar.
        }
        if (yaRecargo) throw error;
        window.location.reload();
        return new Promise(() => {});
      }),
  );
}

const Reclamos = pantalla(() => import("./pages/Reclamos"));
const ReclamoDetalle = pantalla(() => import("./pages/ReclamoDetalle"));
const AdminUsuarios = pantalla(() => import("./pages/AdminUsuarios"));
const AdminUsuarioDetalle = pantalla(
  () => import("./pages/AdminUsuarioDetalle"),
);
const AdminEdificios = pantalla(() => import("./pages/AdminEdificios"));
const AdminEdificioDetalle = pantalla(
  () => import("./pages/AdminEdificioDetalle"),
);

function PublicRoute({ component: Component }) {
  const { session } = useAuth();
  if (session === undefined) return <LoadingScreen />;
  if (session) return <Redirect to="/home" />;
  return <Component />;
}

function ProtectedRoute({ component: Component }) {
  const { session } = useAuth();
  if (session === undefined) return <LoadingScreen />;
  if (!session) return <Redirect to="/" />;
  return <Component />;
}

function AdminRoute({ component: Component }) {
  const { session, perfil } = useAuth();
  if (session === undefined || perfil === undefined) return <LoadingScreen />;
  if (!session) return <Redirect to="/" />;
  if (perfil?.rol !== "admin") return <Redirect to="/home" />;
  return <Component />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/">
        <PublicRoute component={Singin} />
      </Route>
      <Route path="/home">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/reclamos">
        <ProtectedRoute component={Reclamos} />
      </Route>
      <Route path="/reclamos/:id">
        <ProtectedRoute component={ReclamoDetalle} />
      </Route>
      <Route path="/admin/usuarios">
        <AdminRoute component={AdminUsuarios} />
      </Route>
      <Route path="/admin/usuarios/:id">
        <AdminRoute component={AdminUsuarioDetalle} />
      </Route>
      <Route path="/admin/edificios">
        <AdminRoute component={AdminEdificios} />
      </Route>
      <Route path="/admin/edificios/:id">
        <AdminRoute component={AdminEdificioDetalle} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthContextProvider>
          <Router>
            <Suspense fallback={<LoadingScreen />}>
              <AppRoutes />
            </Suspense>
          </Router>
        </AuthContextProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
