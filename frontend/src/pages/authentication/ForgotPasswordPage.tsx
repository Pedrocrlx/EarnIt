import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { validateEmail } from "@/lib/validation";
import { requestPasswordReset } from "@/services/authService";
import { EmailField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";

const successMessage = "If that email is registered, a password reset code has been sent.";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const mutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => {
      setFormSuccess(successMessage);
      setFormError("");
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : "Não foi possível enviar o código.");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    const nextEmailError = validateEmail(email);
    if (nextEmailError) {
      setEmailError(nextEmailError);
      return;
    }

    setEmailError("");
    mutation.mutate({ email: email.trim() });
  };

  return (
    <AuthFormLayout subtitle="Receba um código para redefinir a sua palavra-passe.">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <EmailField
          error={emailError}
          value={email}
          onChange={(value) => {
            setEmail(value);
            setEmailError("");
            setFormError("");
            setFormSuccess("");
          }}
        />

        {formError ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {formError}
          </p>
        ) : null}

        {formSuccess ? (
          <p className="rounded-lg bg-[#eef7d1] px-4 py-3 text-sm font-semibold text-[#5f6800]">
            {formSuccess}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={mutation.isPending}
          className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] text-sm font-semibold tracking-[0.70px] text-[#5f6800] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f]"
        >
          {mutation.isPending ? "A ENVIAR..." : "ENVIAR CÓDIGO"}
        </Button>

        <div className="space-y-2 pt-3">
          <Separator className="bg-[#e1e2e4]" />
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-0.5 text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => navigate("/forgot-password/verify", { state: { email } })}
              className="h-auto p-0 text-sm font-semibold leading-5 text-[#003514] no-underline hover:no-underline"
            >
              Já tenho um código
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => navigate("/login")}
              className="h-auto p-0 text-sm font-semibold leading-5 text-[#003514] no-underline hover:no-underline"
            >
              Voltar ao login
            </Button>
          </div>
        </div>
      </form>
    </AuthFormLayout>
  );
};

export default ForgotPasswordPage;
