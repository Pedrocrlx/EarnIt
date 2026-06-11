import { BrowserRouter, Routes, Route } from "react-router-dom";
import RegistrationPage from "@/pages/authentication/RegistrationPage.tsx";
import LoginPage from "@/pages/authentication/LoginPage";
import VerificationCode from "@/pages/authentication/VerificationCodePage.tsx";
import DashboardPage from "@/pages/DashboardPage";
import LandingPage from "@/pages/LandingPage";
import Layout from "./components/Layout.tsx";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verification" element={<VerificationCode />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
