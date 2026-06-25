import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/context/useToast";
import { apiFetch } from "@/lib/api";
import {
  type FieldErrors,
  validateEmail,
  validatePassword,
} from "@/lib/validation";
import { EmailField, PasswordField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";
import { PasswordRequirementsHint } from "./PasswordRequirementsHint";

type RegisterCredentials = {
  email: string;
  password: string;
};

type RegisterField = "email" | "password" | "confirmPassword";

const RegistrationPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterField>>({});
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);

  const showPasswordHint = passwordFocused || password.length > 0 || submittedOnce;

  const validateForm = () => {
    const nextErrors: FieldErrors<RegisterField> = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError) {
      nextErrors.email = emailError;
    }

    if (passwordError) {
      nextErrors.password = passwordError;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirme a sua palavra-passe.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "As palavras-passe não coincidem.";
    }

    return nextErrors;
  };

  const clearFieldError = (field: RegisterField) => {
    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const registerMutation = useMutation({
    mutationFn: (data: RegisterCredentials) =>
      apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      navigate("/verification");
    },
    onError: (error: unknown) => {
      showToast(
        error instanceof Error ? error.message : "Não foi possível criar a conta.",
        "error",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedOnce(true);
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    registerMutation.mutate({ email, password });
  };

  return (
    <AuthFormLayout subtitle="Crie a sua conta. Junte-se à equipa!">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <EmailField
          error={fieldErrors.email}
          value={email}
          onChange={(value) => {
            setEmail(value);
            clearFieldError("email");
          }}
        />
        <PasswordField
          id="password"
          describedBy="password-requirements"
          error={fieldErrors.password}
          isVisible={showPassword}
          label="Palavra-passe"
          onBlur={() => setPasswordFocused(false)}
          onChange={(value) => {
            setPassword(value);
            clearFieldError("password");
            clearFieldError("confirmPassword");
          }}
          onFocus={() => setPasswordFocused(true)}
          onVisibilityChange={setShowPassword}
          value={password}
        >
          <PasswordRequirementsHint
            id="password-requirements"
            password={password}
            visible={showPasswordHint}
          />
        </PasswordField>
        <PasswordField
          id="confirm-password"
          error={fieldErrors.confirmPassword}
          isVisible={showConfirmPassword}
          label="Confirmar palavra-passe"
          onChange={(value) => {
            setConfirmPassword(value);
            clearFieldError("confirmPassword");
          }}
          onVisibilityChange={setShowConfirmPassword}
          value={confirmPassword}
        />

        <Button
          type="submit"
          className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] text-sm font-semibold tracking-[0.70px] text-[#5f6800] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f]"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? "A CRIAR..." : "CRIAR CONTA"}
        </Button>

        <div className="space-y-2 pt-3">
          <Separator className="bg-[#e1e2e4]" />
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 pt-0.5 text-center">
            <span className="text-sm font-normal leading-6 text-[#404940] sm:text-base">
              Já tem conta?
            </span>
            <Button
              type="button"
              variant="link"
              onClick={() => navigate("/login")}
              className="h-auto p-0 text-sm font-semibold leading-5 text-[#003514] no-underline hover:no-underline"
            >
              Entrar
            </Button>
          </div>
        </div>
      </form>
    </AuthFormLayout>
  );
};

export default RegistrationPage;
