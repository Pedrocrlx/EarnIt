import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import { EmailField, PasswordField } from "./AuthFields";
import { AuthFormLayout } from "./AuthFormLayout";

type RegisterCredentials = {
  email: string;
  password: string;
};

const RegistrationPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");

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

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    registerMutation.mutate({ email, password });
  };

  return (
    <AuthFormLayout subtitle="Create your account. Join the crew!">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <EmailField value={email} onChange={setEmail} />
        <PasswordField
          id="password"
          isVisible={showPassword}
          label="Password"
          onChange={setPassword}
          onVisibilityChange={setShowPassword}
          value={password}
        />
        <PasswordField
          id="confirm-password"
          isVisible={showConfirmPassword}
          label="Confirm Password"
          onChange={setConfirmPassword}
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
