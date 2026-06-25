import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/useToast";
import { validateEmail, validateRequired } from "@/lib/validation";
import { verifyPasswordResetCode } from "@/services/authService";
import { EmailField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";

type LocationState = {
  email?: string;
};

const VerifyResetCodePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const { showToast } = useToast();
  const [email, setEmail] = useState(locationState?.email ?? "");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState("");
  const [codeError, setCodeError] = useState("");

  const mutation = useMutation({
    mutationFn: verifyPasswordResetCode,
    onSuccess: () => {
      navigate("/reset-password", { replace: true });
    },
    onError: (error: unknown) => {
      showToast(
        error instanceof Error ? error.message : "Não foi possível validar o código.",
        "error",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextEmailError = validateEmail(email);
    const nextCodeError = validateRequired(code, "Introduza o código recebido por email.");
    setEmailError(nextEmailError);
    setCodeError(nextCodeError);

    if (nextEmailError || nextCodeError) {
      return;
    }

    mutation.mutate({ email: email.trim(), code: code.trim() });
  };

  return (
    <AuthFormLayout subtitle="Confirme o código enviado para o seu email.">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <EmailField
          error={emailError}
          value={email}
          onChange={(value) => {
            setEmail(value);
            setEmailError("");
          }}
        />

        <div className="space-y-2">
          <Label htmlFor="reset-code" className="text-sm font-semibold text-[#191c1e]">
            Código
          </Label>
          <Input
            id="reset-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.trim());
              setCodeError("");
            }}
            aria-invalid={Boolean(codeError)}
            aria-describedby={codeError ? "reset-code-error" : undefined}
            className="h-[51px] rounded-lg border-2 border-[#e1e2e4] bg-[#f8f9fb] text-base font-normal text-[#191c1e]"
          />
          <FieldError id="reset-code-error" message={codeError} />
        </div>

        <Button
          type="submit"
          disabled={mutation.isPending}
          className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] text-sm font-semibold tracking-[0.70px] text-[#5f6800] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f]"
        >
          {mutation.isPending ? "A VALIDAR..." : "VALIDAR CÓDIGO"}
        </Button>
      </form>
    </AuthFormLayout>
  );
};

export default VerifyResetCodePage;
