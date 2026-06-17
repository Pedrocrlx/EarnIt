import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import RegistrationPage from "@/pages/authentication/RegistrationPage.tsx";
import LoginPage from "@/pages/authentication/LoginPage";
import VerificationCode from "@/pages/authentication/VerificationCodePage.tsx";
import DashboardPage from "@/pages/DashboardPage";
import ProfileSelectorPage from "@/pages/ProfileSelectorPage";
import LandingPage from "@/pages/LandingPage";
import OnboardingStep1Page from "@/pages/onboarding/Step1Page";
import OnboardingStep2Page from "@/pages/onboarding/Step2Page";
import Layout from "./components/Layout.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verification" element={<VerificationCode />} />
          <Route path="/onboarding" element={<Navigate to="/onboarding/step1" replace />} />
          <Route path="/profile" element={<ProfileSelectorPage />} />
          <Route
            path="/onboarding/step1"
            element={
              <ProtectedRoute>
                <OnboardingStep1Page />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/step2"
            element={
              <ProtectedRoute>
                <OnboardingStep2Page />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
