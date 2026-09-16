import { Router, Switch, Route, Redirect } from "wouter";
import Singin from "./components/singin";
import Singup from "./components/singup";
import Home from "./pages/home";
import { AuthContextProvider } from "./contexts/auth-context/AuthContext";
import { useAuth } from "./contexts/auth-context/use-auth";

function PublicRoute({ component: Component }) {
  const { session } = useAuth();
  if (session === undefined) return null;
  if (session) return <Redirect to="/home" />;
  return <Component />;
}

function ProtectedRoute({ component: Component }) {
  const { session } = useAuth();
  if (session === undefined) return null;
  if (!session) return <Redirect to="/" />;
  return <Component />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/">
        <PublicRoute component={Singin} />
      </Route>
      <Route path="/registro">
        <PublicRoute component={Singup} />
      </Route>
      <Route path="/home">
        <ProtectedRoute component={Home} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <AuthContextProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthContextProvider>
  );
}

export default App;
