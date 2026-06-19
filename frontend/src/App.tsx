import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { selectedProfileIsParent } from "@/lib/profile-selection";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const ManageProfilesPage = lazy(() => import("@/pages/ManageProfilesPage"));
const LoginPage = lazy(() => import("@/pages/authentication/LoginPage"));
const OnboardingStep1Page = lazy(() => import("@/pages/onboarding/Step1Page"));
const OnboardingStep2Page = lazy(() => import("@/pages/onboarding/Step2Page"));
const OnboardingStep3Page = lazy(() => import("@/pages/onboarding/Step3Page"));
const ProfileSelectorPage = lazy(() => import("@/pages/ProfileSelectorPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const TasksPage = lazy(() => import("@/pages/TasksPage"));
const RegistrationPage = lazy(
  () => import("@/pages/authentication/RegistrationPage"),
);
const VerificationCode = lazy(
  () => import("@/pages/authentication/VerificationCodePage"),
);

const PageFallback = () => (
  <main className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-4">
    <div className="text-sm font-semibold text-[#003514]">A carregar...</div>
  </main>
);

const OnboardingRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute blockWhenOnboardingComplete>{children}</ProtectedRoute>
);

const CompletedOnboardingRoute = ({
  children,
}: {
  children: ReactNode;
}) => (
  <ProtectedRoute requireOnboardingComplete>{children}</ProtectedRoute>
);

const ParentDashboardRoute = ({ children }: { children: ReactNode }) => {
  if (!selectedProfileIsParent()) {
    return <Navigate to="/dashboard" replace />;
  }

  return <CompletedOnboardingRoute>{children}</CompletedOnboardingRoute>;
};

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verification" element={<VerificationCode />} />
            <Route
              path="/onboarding"
              element={
                <OnboardingRoute>
                  <Navigate to="/onboarding/step1" replace />
                </OnboardingRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfileSelectorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/step1"
              element={
                <OnboardingRoute>
                  <OnboardingStep1Page />
                </OnboardingRoute>
              }
            />
            <Route
              path="/onboarding/step2"
              element={
                <OnboardingRoute>
                  <OnboardingStep2Page />
                </OnboardingRoute>
              }
            />
            <Route
              path="/onboarding/step3"
              element={
                <OnboardingRoute>
                  <OnboardingStep3Page />
                </OnboardingRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <CompletedOnboardingRoute>
                  <DashboardPage />
                </CompletedOnboardingRoute>
              }
            />
            <Route
              path="/dashboard/profiles"
              element={
                <ParentDashboardRoute>
                  <ManageProfilesPage />
                </ParentDashboardRoute>
              }
            />
            <Route
              path="/dashboard/tasks"
              element={
                <ParentDashboardRoute>
                  <TasksPage />
                </ParentDashboardRoute>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <ParentDashboardRoute>
                  <SettingsPage />
                </ParentDashboardRoute>
              }
            />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
