import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/useAuth";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-4">
        <div className="text-sm font-semibold text-[#003514]">
          Loading your session...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
