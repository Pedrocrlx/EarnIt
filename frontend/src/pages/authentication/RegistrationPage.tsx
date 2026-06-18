import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  type FieldErrors,
  getPasswordRequirements,
  validateEmail,
  validatePassword,
} from "@/lib/validation";
import { EmailField, PasswordField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";

type RegisterCredentials = {
  email: string;
  password: string;
};

type RegisterField = "email" | "password" | "confirmPassword";

const RegistrationPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterField>>({});
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);

  const passwordRequirements = getPasswordRequirements(password);
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
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
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
      setFormError(
        error instanceof Error ? error.message : "Unable to create account.",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
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
    <AuthFormLayout subtitle="Create your account. Join the crew!">
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
          describedBy="password-requirements"
          error={fieldErrors.password}
          isVisible={showPassword}
          label="Password"
          onBlur={() => setPasswordFocused(false)}
          onChange={(value) => {
            setPassword(value);
            clearFieldError("password");
            clearFieldError("confirmPassword");
            setFormError("");
          }}
          onFocus={() => setPasswordFocused(true)}
          onVisibilityChange={setShowPassword}
          value={password}
        >
          <div
            id="password-requirements"
            className={cn(
              "grid overflow-hidden rounded-lg bg-[#f8f9fb] transition-all duration-300 ease-out",
              showPasswordHint
                ? "max-h-44 translate-y-0 opacity-100"
                : "max-h-0 -translate-y-1 opacity-0",
            )}
          >
            <ul className="grid gap-2 p-3" aria-label="Password requirements">
              {passwordRequirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className={cn(
                    "flex items-center gap-2 text-sm font-semibold leading-5 transition-colors duration-200",
                    requirement.met ? "text-[#2c5b22]" : "text-[#70796f]",
                  )}
                >
                  {requirement.met ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {requirement.label}
                </li>
              ))}
            </ul>
          </div>
        </PasswordField>
        <PasswordField
          id="confirm-password"
          error={fieldErrors.confirmPassword}
          isVisible={showConfirmPassword}
          label="Confirm Password"
          onChange={(value) => {
            setConfirmPassword(value);
            clearFieldError("confirmPassword");
            setFormError("");
          }}
          onVisibilityChange={setShowConfirmPassword}
          value={confirmPassword}
        />

        {formError ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] text-sm font-semibold tracking-[0.70px] text-[#5f6800] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f]"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? "CREATING..." : "CREATE ACCOUNT"}
        </Button>

        <div className="space-y-2 pt-3">
          <Separator className="bg-[#e1e2e4]" />
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 pt-0.5 text-center">
            <span className="text-sm font-normal leading-6 text-[#404940] sm:text-base">
              Already have an account?
            </span>
            <Button
              type="button"
              variant="link"
              onClick={() => navigate("/login")}
              className="h-auto p-0 text-sm font-semibold leading-5 text-[#003514] no-underline hover:no-underline"
            >
              Log In
            </Button>
          </div>
        </div>
      </form>
    </AuthFormLayout>
  );
};

export default RegistrationPage;
