import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import {
  getSelectedProfileId,
  parentPinIsUnlocked,
  selectedProfileIsParent,
} from "@/lib/profile-selection";

const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const ManageProfilesPage = lazy(() => import("@/pages/profiles/ManageProfilesPage"));
const LoginPage = lazy(() => import("@/pages/authentication/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/authentication/ForgotPasswordPage"));
const OnboardingStep1Page = lazy(() => import("@/pages/onboarding/Step1Page"));
const OnboardingStep2Page = lazy(() => import("@/pages/onboarding/Step2Page"));
const OnboardingStep3Page = lazy(() => import("@/pages/onboarding/Step3Page"));
const ProfileSelectorPage = lazy(() => import("@/pages/ProfileSelectorPage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const TasksPage = lazy(() => import("@/pages/tasks/TasksPage"));
const SubmissionsPage = lazy(() => import("@/pages/submissions/SubmissionsPage"));
const GoalsPage = lazy(() => import("@/pages/goals/GoalsPage"));
const RegistrationPage = lazy(
  () => import("@/pages/authentication/RegistrationPage"),
);
const VerificationCode = lazy(
  () => import("@/pages/authentication/VerificationCodePage"),
);
const VerifyResetCodePage = lazy(
  () => import("@/pages/authentication/VerifyResetCodePage"),
);
const ResetPasswordPage = lazy(
  () => import("@/pages/authentication/ResetPasswordPage"),
);
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

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

const DashboardRoute = ({ children }: { children: ReactNode }) => {
  const selectedProfileId = getSelectedProfileId();

  if (!selectedProfileId) {
    return <Navigate to="/profile" replace />;
  }

  if (selectedProfileIsParent() && !parentPinIsUnlocked()) {
    return <Navigate to="/profile" replace />;
  }

  return <CompletedOnboardingRoute>{children}</CompletedOnboardingRoute>;
};

const ParentDashboardRoute = ({ children }: { children: ReactNode }) => {
  if (!selectedProfileIsParent() || !parentPinIsUnlocked()) {
    return <Navigate to="/profile" replace />;
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
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/forgot-password/verify" element={<VerifyResetCodePage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                <DashboardRoute>
                  <DashboardPage />
                </DashboardRoute>
              }
            />
            <Route
              path="/dashboard/goals"
              element={
                <DashboardRoute>
                  <GoalsPage />
                </DashboardRoute>
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
              path="/dashboard/submissions"
              element={
                <ParentDashboardRoute>
                  <SubmissionsPage />
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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
