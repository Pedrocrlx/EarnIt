import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { PinPad } from "@/components/PinPad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSetPin } from "@/hooks/useSetPin";
import { ApiError } from "@/lib/api";
import { retryWaitMessage } from "@/lib/rate-limit";
import {
  requestPinResetCode,
  resetPin as resetPinRequest,
  verifyParentPin,
  verifyPinResetCode,
} from "@/services/authService";

// The parent-profile gate, with a self-contained forgot/reset flow. Steps:
//   pin    -> enter the 4-digit PIN (auto-verifies); link out to `forgot`
//   forgot -> confirm + email a reset code
//   code   -> enter the emailed 6-char code (validated later, at reset)
//   reset  -> set a new PIN (two-phase) -> reset-pin -> back to `pin` to sign in
type Step = "pin" | "forgot" | "code" | "reset";

type ParentPinDialogProps = {
  onClose: () => void;
  onUnlocked?: () => void;
  // Start at "forgot" (settings reset, parent already unlocked) vs the default
  // "pin" verify gate (profile selector).
  initialStep?: Step;
  // When set, called instead of returning to the verify step after a reset.
  onResetSuccess?: () => void;
};

const headings: Record<Step, { title: string; subtitle: string }> = {
  pin: {
    title: "PIN parental",
    subtitle: "Introduza o PIN para abrir o perfil de adulto.",
  },
  forgot: { title: "Redefinir PIN", subtitle: "Recuperação por email." },
  code: { title: "Redefinir PIN", subtitle: "Confirme o código do email." },
  reset: { title: "Redefinir PIN", subtitle: "Defina o novo PIN." },
};

export const ParentPinDialog = ({
  onClose,
  onUnlocked,
  initialStep = "pin",
  onResetSuccess,
}: ParentPinDialogProps) => {
  const [step, setStep] = useState<Step>(initialStep);
  const resetOnly = initialStep === "forgot";

  // Verify
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Forgot / code
  const [code, setCode] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [isCheckingCode, setIsCheckingCode] = useState(false);

  // New PIN (reset)
  const newPin = useSetPin();
  const [isResetting, setIsResetting] = useState(false);

  const busy = isVerifying || isSending || isCheckingCode || isResetting;
  const { title, subtitle } = headings[step];

  const verify = async (pinValue: string) => {
    if (!/^\d{4}$/.test(pinValue)) {
      setPinError("Introduza o seu PIN parental de 4 dígitos.");
      return;
    }
    setIsVerifying(true);
    setPinError("");
    try {
      const response = await verifyParentPin(pinValue);
      if (!response.authenticated) {
        setPin("");
        setPinError("PIN incorreto.");
        return;
      }
      onUnlocked?.();
    } catch (error) {
      setPin("");
      setPinError(
        error instanceof Error ? error.message : "Não foi possível verificar o seu PIN.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const goForgot = () => {
    setStep("forgot");
    setActionError("");
    setNotice("");
  };

  const sendCode = async () => {
    setIsSending(true);
    setActionError("");
    setNotice("");
    try {
      await requestPinResetCode();
      setStep("code");
    } catch (error) {
      // 429: a code is already active — let them enter the one they already have.
      if (error instanceof ApiError && error.status === 429) {
        setNotice(
          `Já enviámos um código recentemente. Aguarde ${retryWaitMessage(error)} antes de pedir outro.`,
        );
        setStep("code");
        return;
      }
      setActionError(
        error instanceof Error ? error.message : "Não foi possível enviar o código.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const continueToReset = async () => {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setActionError("Introduza o código recebido por email.");
      return;
    }
    setIsCheckingCode(true);
    setActionError("");
    try {
      // Confirm the code up front so a wrong code is caught here, not only after
      // the parent has set a new PIN. The code is not consumed by this check.
      await verifyPinResetCode(trimmed);
      newPin.reset();
      setStep("reset");
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        setActionError("O código expirou. Peça um novo.");
        setStep("forgot");
        return;
      }
      if (error instanceof ApiError && error.status === 400) {
        setActionError("Código inválido. Verifique e tente novamente.");
        return;
      }
      setActionError(
        error instanceof Error ? error.message : "Não foi possível validar o código.",
      );
    } finally {
      setIsCheckingCode(false);
    }
  };

  const submitReset = async () => {
    if (!newPin.isConfirmed || isResetting) {
      return;
    }
    setIsResetting(true);
    setActionError("");
    try {
      await resetPinRequest({ code: code.trim(), new_pin: newPin.confirmedPin });
      // Settings context: parent is already unlocked — hand back to the page to
      // close + confirm, instead of returning to the PIN verify step.
      if (onResetSuccess) {
        onResetSuccess();
        return;
      }
      // Default (unlock context): back to the PIN step to sign in with the new PIN.
      setResetDone(true);
      setPin("");
      setPinError("");
      setCode("");
      newPin.reset();
      setStep("pin");
    } catch (error) {
      newPin.reset();
      if (error instanceof ApiError && error.status === 410) {
        setActionError("O código expirou. Peça um novo.");
        setStep("forgot");
        return;
      }
      setActionError(
        error instanceof Error ? error.message : "Não foi possível redefinir o PIN.",
      );
      setStep("code");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      closeDisabled={busy}
      widthClassName="max-w-[380px]"
    >
        {step === "pin" ? (
          <>
            {resetDone ? (
              <p className="mt-4 rounded-lg bg-[#f3f7da] px-4 py-3 text-center text-sm font-semibold text-[#003514]">
                PIN atualizado — introduza o novo PIN.
              </p>
            ) : null}

            <div className="mt-6">
              <PinPad
                value={pin}
                onChange={(value) => {
                  setPinError("");
                  setPin(value);
                }}
                onComplete={verify}
                disabled={isVerifying}
              />
            </div>

            {isVerifying ? (
              <p className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-[#003514]">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                A verificar...
              </p>
            ) : pinError ? (
              <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                {pinError}
              </p>
            ) : null}

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={goForgot}
                className="text-sm font-semibold text-[#003514]/70 underline-offset-4 transition hover:text-[#003514] hover:underline"
              >
                Esqueci-me do PIN
              </button>
            </div>
          </>
        ) : null}

        {step === "forgot" ? (
          <>
            <p className="mt-5 text-sm leading-5 text-[#404940]">
              Vamos enviar um código de redefinição para o email da conta. Use-o
              para definir um novo PIN.
            </p>

            {actionError ? (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {actionError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="ghost"
                onClick={resetOnly ? onClose : () => setStep("pin")}
                disabled={isSending}
                className="h-12 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                {resetOnly ? "Cancelar" : "Voltar"}
              </Button>
              <Button
                type="button"
                onClick={sendCode}
                disabled={isSending}
                className="h-12 rounded-full bg-[#d4e251] text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {isSending ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : null}
                Enviar código
              </Button>
            </div>
          </>
        ) : null}

        {step === "code" ? (
          <>
            {notice ? (
              <p className="mt-4 rounded-lg bg-[#f3f7da] px-4 py-3 text-sm font-semibold text-[#003514]">
                {notice}
              </p>
            ) : null}

            <div className="mt-5 space-y-1.5">
              <label
                htmlFor="pin-reset-code"
                className="pl-1 text-sm font-semibold text-[#404940]"
              >
                Código de 6 caracteres
              </label>
              <Input
                id="pin-reset-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase().replace(/\s/g, "").slice(0, 6));
                  setActionError("");
                }}
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="Ex.: 748291"
                className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] px-4 text-center text-lg font-semibold tracking-[0.4em] text-[#191c1e] placeholder:tracking-normal placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                autoFocus
              />
            </div>

            {actionError ? (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {actionError}
              </p>
            ) : null}

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={sendCode}
                disabled={busy}
                className="text-sm font-semibold text-[#003514]/70 underline-offset-4 transition hover:text-[#003514] hover:underline disabled:opacity-50"
              >
                Reenviar código
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("forgot")}
                disabled={busy}
                className="h-12 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={continueToReset}
                disabled={isCheckingCode}
                className="h-12 rounded-full bg-[#d4e251] text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {isCheckingCode ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : null}
                Continuar
              </Button>
            </div>
          </>
        ) : null}

        {step === "reset" ? (
          <>
            <p className="mt-5 text-center text-sm font-semibold text-[#003514]">
              {newPin.isConfirmed
                ? "Novo PIN confirmado."
                : newPin.phase === "create"
                  ? "Introduza o novo PIN."
                  : "Repita o novo PIN."}
            </p>

            <div className="mt-5">
              <PinPad
                value={newPin.entry}
                onChange={(value) => {
                  setActionError("");
                  newPin.onChange(value);
                }}
                disabled={isResetting || newPin.isConfirmed}
                tone={newPin.isConfirmed ? "success" : "default"}
              />
            </div>

            {newPin.error || actionError ? (
              <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                {newPin.error || actionError}
              </p>
            ) : null}

            {newPin.entry.length > 0 || newPin.phase === "confirm" ? (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={newPin.reset}
                  disabled={isResetting}
                  className="text-sm font-semibold text-[#003514]/70 underline-offset-4 transition hover:text-[#003514] hover:underline disabled:opacity-50"
                >
                  Recomeçar
                </button>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("code")}
                disabled={isResetting}
                className="h-12 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={submitReset}
                disabled={!newPin.isConfirmed || isResetting}
                className="h-12 rounded-full bg-[#d4e251] text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {isResetting ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : null}
                Redefinir PIN
              </Button>
            </div>
          </>
        ) : null}
    </Modal>
  );
};

export default ParentPinDialog;
