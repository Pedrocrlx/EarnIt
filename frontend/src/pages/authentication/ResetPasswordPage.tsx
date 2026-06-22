import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { validatePassword, validateRequired } from "@/lib/validation";
import { resetPassword } from "@/services/authService";
import { PasswordField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      navigate("/login", {
        replace: true,
        state: { passwordResetMessage: "Password has been reset." },
      });
    },
    onError: (error: unknown) => {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível redefinir a palavra-passe.",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const nextPasswordError = validatePassword(newPassword);
    const nextConfirmError =
      validateRequired(confirmPassword, "Confirme a nova palavra-passe.") ||
      (newPassword === confirmPassword ? "" : "As palavras-passe não correspondem.");

    setNewPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmError);

    if (nextPasswordError || nextConfirmError) {
      return;
    }

    mutation.mutate({ new_password: newPassword });
  };

  return (
    <AuthFormLayout subtitle="Defina uma nova palavra-passe para a conta parental.">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <PasswordField
          id="new-password"
          error={newPasswordError}
          isVisible={showNewPassword}
          label="Nova palavra-passe"
          onChange={(value) => {
            setNewPassword(value);
            setNewPasswordError("");
            setFormError("");
          }}
          onVisibilityChange={setShowNewPassword}
          value={newPassword}
        />
        <PasswordField
          id="confirm-new-password"
          error={confirmPasswordError}
          isVisible={showConfirmPassword}
          label="Confirmar palavra-passe"
          onChange={(value) => {
            setConfirmPassword(value);
            setConfirmPasswordError("");
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
          disabled={mutation.isPending}
          className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] text-sm font-semibold tracking-[0.70px] text-[#5f6800] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f]"
        >
          {mutation.isPending ? "A GUARDAR..." : "GUARDAR PALAVRA-PASSE"}
        </Button>
      </form>
    </AuthFormLayout>
  );
};

export default ResetPasswordPage;
