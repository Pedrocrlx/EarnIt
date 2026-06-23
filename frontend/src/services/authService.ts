import { apiFetch } from "@/lib/api";

export type ForgotPasswordRequest = {
  email: string;
};

export type VerifyResetCodeRequest = {
  code: string;
  email: string;
};

export type ResetPasswordRequest = {
  new_password: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type PinResetCodeResponse = {
  expires_at?: string;
  message: string;
  retry_after_seconds?: number;
  status: string;
};

export type ResetPinRequest = {
  code: string;
  new_pin: string;
};

export type PinVerificationResponse = {
  authenticated: boolean;
  status: string;
};

export const login = (data: LoginCredentials) =>
  apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const requestPasswordReset = (data: ForgotPasswordRequest) =>
  apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const verifyPasswordResetCode = (data: VerifyResetCodeRequest) =>
  apiFetch("/auth/forgot-password/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const resetPassword = (data: ResetPasswordRequest) =>
  apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const requestPinResetCode = () =>
  apiFetch<PinResetCodeResponse>("/auth/forgot-pin", {
    method: "POST",
  });

export const verifyPinResetCode = (code: string) =>
  apiFetch("/auth/reset-pin/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const resetPin = (data: ResetPinRequest) =>
  apiFetch("/auth/reset-pin", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const verifyParentPin = (pin: string) =>
  apiFetch<PinVerificationResponse>("/auth/verify-pin", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
