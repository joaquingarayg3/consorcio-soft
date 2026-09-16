import { Router, Switch, Route, Redirect } from "wouter";
import Singin from "./components/singin";
import Home from "./pages/home";
import AdminUsuarios from "./pages/AdminUsuarios";
import AdminUsuarioDetalle from "./pages/AdminUsuarioDetalle";
import AdminEdificios from "./pages/AdminEdificios";
import AdminEdificioDetalle from "./pages/AdminEdificioDetalle";
import { AuthContextProvider } from "./contexts/auth-context/AuthContext";
import { useAuth } from "./contexts/auth-context/use-auth";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";

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
  if (session === undefined || perfil === undefined)
    return <LoadingScreen />;
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
      <AuthContextProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthContextProvider>
    </ErrorBoundary>
  );
}

export default App;
