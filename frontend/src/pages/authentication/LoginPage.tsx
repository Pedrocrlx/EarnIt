import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/useAuth";
import { ApiError, apiFetch } from "@/lib/api";
import {
  type FieldErrors,
  validateEmail,
  validateRequired,
} from "@/lib/validation";
import { EmailField, PasswordField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";

type LoginCredentials = {
  email: string;
  password: string;
};

type LoginField = keyof LoginCredentials;

const isAccountUnverifiedError = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 403) {
    return false;
  }

  const data = error.data;

  if (!data || typeof data !== "object" || !("detail" in data)) {
    return false;
  }

  const { detail } = data;

  return (
    !!detail &&
    typeof detail === "object" &&
    "error" in detail &&
    detail.error === "account_unverified"
  );
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginField>>({});

  const validateForm = () => {
    const nextErrors: FieldErrors<LoginField> = {};
    const emailError = validateEmail(email);
    const passwordError = validateRequired(password, "Introduza a sua palavra-passe.");

    if (emailError) {
      nextErrors.email = emailError;
    }

    if (passwordError) {
      nextErrors.password = passwordError;
    }

    return nextErrors;
  };

  const clearFieldError = (field: LoginField) => {
    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const loginMutation = useMutation({
    mutationFn: (data: LoginCredentials) =>
      apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      const profile = await login();
      navigate(
        profile?.onboarding_completed ? "/dashboard" : "/onboarding/step1",
        { replace: true },
      );
    },
    onError: (error: unknown) => {
      if (isAccountUnverifiedError(error)) {
        navigate("/verification", { replace: true });
        return;
      }

      setFormError(
        error instanceof Error ? error.message : "Não foi possível iniciar sessão.",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    loginMutation.mutate({ email, password });
  };

  return (
    <AuthFormLayout subtitle="Bem-vindo de volta! Pronto para ver o progresso?">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <EmailField
          error={fieldErrors.email}
          value={email}
          onChange={(value) => {
            setEmail(value);
            clearFieldError("email");
            setFormError("");
          }}
        />
        <PasswordField
          id="password"
          error={fieldErrors.password}
          isVisible={showPassword}
          label="Palavra-passe"
          onChange={(value) => {
            setPassword(value);
            clearFieldError("password");
            setFormError("");
          }}
          onVisibilityChange={setShowPassword}
          value={password}
        />

        {formError ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] text-sm font-semibold tracking-[0.70px] text-[#5f6800] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f]"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "A ENTRAR..." : "ENTRAR"}
        </Button>

        <div className="space-y-2 pt-3">
          <Separator className="bg-[#e1e2e4]" />
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 pt-0.5 text-center">
            <span className="text-sm font-normal leading-6 text-[#404940] sm:text-base">
              Ainda não tem conta?
            </span>
            <Button
              type="button"
              variant="link"
              onClick={() => navigate("/register")}
              className="h-auto p-0 text-sm font-semibold leading-5 text-[#003514] no-underline hover:no-underline"
            >
              Criar conta
            </Button>
          </div>
        </div>
      </form>
    </AuthFormLayout>
  );
};

export default LoginPage;
