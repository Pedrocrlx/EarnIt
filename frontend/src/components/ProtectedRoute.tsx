import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
  blockWhenOnboardingComplete?: boolean;
  requireOnboardingComplete?: boolean;
};

export const ProtectedRoute = ({
  children,
  blockWhenOnboardingComplete = false,
  requireOnboardingComplete = false,
}: ProtectedRouteProps) => {
  const { familyProfile, isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-4">
        <div className="text-sm font-semibold text-[#003514]">
          A carregar a sua sessão...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (blockWhenOnboardingComplete && familyProfile?.onboarding_completed) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireOnboardingComplete && !familyProfile?.onboarding_completed) {
    return <Navigate to="/onboarding/step1" replace />;
  }

  return <>{children}</>;
};
