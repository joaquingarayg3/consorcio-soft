import { useEffect } from "react";
import AppHeader from "../components/AppHeader";
import ClaimsPanel from "../components/ClaimsPanel";
import { useAuth } from "../contexts/auth-context/use-auth";
import { markClaimsAsViewed } from "../services/claims";

export default function Reclamos() {
  const { session } = useAuth();

  useEffect(() => {
    markClaimsAsViewed(session?.user?.id);
  }, [session?.user?.id]);

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader backTo="/home" />
      <main className="mx-auto flex max-w-4xl justify-center px-4 py-8 sm:px-6">
        <ClaimsPanel standalone />
      </main>
    </div>
  );
}
