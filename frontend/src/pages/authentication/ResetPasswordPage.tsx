import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useToast } from "@/context/useToast";
import { validatePassword, validateRequired } from "@/lib/validation";
import { resetPassword } from "@/services/authService";
import { PasswordField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";
import { PasswordRequirementsHint } from "./PasswordRequirementsHint";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);

  const showPasswordHint =
    passwordFocused || newPassword.length > 0 || submittedOnce;

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      navigate("/login", {
        replace: true,
        state: { passwordResetMessage: "Password has been reset." },
      });
    },
    onError: (error: unknown) => {
      showToast(
        error instanceof Error ? error.message : "Não foi possível redefinir a palavra-passe.",
        "error",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedOnce(true);

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
          describedBy="new-password-requirements"
          error={newPasswordError}
          isVisible={showNewPassword}
          label="Nova palavra-passe"
          onBlur={() => setPasswordFocused(false)}
          onChange={(value) => {
            setNewPassword(value);
            setNewPasswordError("");
            setConfirmPasswordError("");
          }}
          onFocus={() => setPasswordFocused(true)}
          onVisibilityChange={setShowNewPassword}
          value={newPassword}
        >
          <PasswordRequirementsHint
            id="new-password-requirements"
            password={newPassword}
            visible={showPasswordHint}
          />
        </PasswordField>
        <PasswordField
          id="confirm-new-password"
          error={confirmPasswordError}
          isVisible={showConfirmPassword}
          label="Confirmar palavra-passe"
          onChange={(value) => {
            setConfirmPassword(value);
            setConfirmPasswordError("");
          }}
          onVisibilityChange={setShowConfirmPassword}
          value={confirmPassword}
        />

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
