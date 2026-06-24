import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PinPad } from "@/components/PinPad";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { useSetPin } from "@/hooks/useSetPin";
import { apiFetch } from "@/lib/api";
import { clearDraft, readDraft } from "@/lib/onboarding-draft";
import { cn } from "@/lib/utils";

type PinResponse = {
  status: string;
  message: string;
};

const OnboardingStep3Page = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { entry, phase, isConfirmed, confirmedPin, error, onChange, reset } =
    useSetPin();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // The draft holds the family name + children from steps 1-2; without them there
  // is nothing to submit, so send the user back to the start.
  useEffect(() => {
    const draft = readDraft();
    if (!draft.familyName || !draft.children || draft.children.length === 0) {
      navigate("/onboarding/step1", { replace: true });
    }
  }, [navigate]);

  const handlePinChange = (value: string) => {
    setSubmitError("");
    onChange(value);
  };

  // Concluir sends everything in one burst: family name, then children, then the
  // PIN last (the PIN is what trips onboarding completion on the backend). Nothing
  // was written during steps 1-2, so abandoning before this point leaves no data.
  const handleSubmit = async () => {
    if (!isConfirmed || isSubmitting) {
      return;
    }
    const draft = readDraft();
    const familyName = draft.familyName?.trim();
    const draftChildren = draft.children ?? [];
    if (!familyName || draftChildren.length === 0) {
      navigate("/onboarding/step1", { replace: true });
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await apiFetch("/profiles/family-name", {
        method: "PATCH",
        body: JSON.stringify({ family_name: familyName }),
      });

      // Skip creation if a previous attempt already created them (retry safety).
      const current = await refreshSession();
      if ((current?.children.length ?? 0) === 0) {
        await Promise.all(
          draftChildren.map((child) =>
            apiFetch("/profiles/children", {
              method: "POST",
              body: JSON.stringify({
                name: child.firstName.trim(),
                birth_date: child.birthDate || null,
              }),
            }),
          ),
        );
      }

      await apiFetch<PinResponse>("/auth/pin", {
        method: "POST",
        body: JSON.stringify({ pin: confirmedPin }),
      });

      const profile = await refreshSession();
      clearDraft();
      navigate(profile?.onboarding_completed ? "/profile" : "/onboarding/step2", {
        replace: true,
      });
    } catch (caughtError) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível concluir a configuração. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const phaseTitle = isConfirmed
    ? "PIN confirmado"
    : phase === "create"
      ? "Criar PIN"
      : "Confirmar PIN";
  const phaseHint = isConfirmed
    ? "Tudo certo — pode concluir a configuração."
    : phase === "create"
      ? "Introduza 4 dígitos. Pode alterá-lo depois nas definições."
      : "Repita o PIN para confirmar.";

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 py-6 text-[#191c1e] sm:px-6 sm:py-10 lg:py-14">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[520px] flex-col">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <img
              src="/earnit_logo_black.webp"
              alt="EarnIt"
              className="h-12 w-auto object-contain sm:h-14"
            />
            <span className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] text-[#003514] shadow-[0px_8px_18px_-14px_rgba(3,78,34,0.45)]">
              Passo 3 de 3
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.06em] text-[#003514]/55">
              <span>Segurança parental</span>
              <span className="text-[#003514]">Concluir configuração</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#edeef0]"
              aria-hidden="true"
            >
              <div className="h-full w-full rounded-full bg-[#d4e251]" />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-7 py-8 sm:gap-8">
          <section className="space-y-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#003514] text-[#d4e251] shadow-[0px_14px_30px_-18px_rgba(3,78,34,0.6)]">
              <ShieldCheck className="size-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="font-montserrat text-[30px] font-bold leading-[38px] text-[#003514] sm:text-[34px] sm:leading-[42px]">
                Defina o PIN parental
              </h1>
              <p className="mx-auto max-w-[430px] text-base leading-6 text-[#404940]">
                Este PIN protege os controlos dos adultos quando alguém muda
                para o perfil Mãe/Pai.
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-[0px_18px_35px_-24px_rgba(3,78,34,0.55)] sm:p-6">
            <div className="flex flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full bg-[#f3f7da] text-[#003514] transition-colors",
                  isConfirmed && "bg-[#003514] text-[#d4e251]",
                )}
              >
                {isConfirmed ? (
                  <Check className="size-5" aria-hidden="true" />
                ) : (
                  <LockKeyhole className="size-5" aria-hidden="true" />
                )}
              </span>
              <h2 className="mt-2 font-bold leading-6 text-[#003514]">
                {phaseTitle}
              </h2>
              <p className="text-sm leading-5 text-[#404940]">{phaseHint}</p>
            </div>

            <div className="mt-6">
              <PinPad
                value={entry}
                onChange={handlePinChange}
                disabled={isSubmitting || isConfirmed}
                tone={isConfirmed ? "success" : "default"}
              />
            </div>

            {error || submitError ? (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                {error || submitError}
              </p>
            ) : null}

            {entry.length > 0 || phase === "confirm" ? (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={reset}
                  disabled={isSubmitting}
                  className="text-sm font-semibold text-[#003514]/70 underline-offset-4 transition hover:text-[#003514] hover:underline disabled:opacity-50"
                >
                  Recomeçar
                </button>
              </div>
            ) : null}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/onboarding/step2")}
              className="h-13 rounded-full bg-white px-6 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_18px_-16px_rgba(3,78,34,0.5)] hover:bg-white hover:text-[#003514] sm:order-1"
            >
              <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
              Voltar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isConfirmed || isSubmitting}
              className="h-13 rounded-full bg-[#d4e251] px-6 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_18px_-16px_rgba(3,78,34,0.5)] hover:bg-[#cfdc42] disabled:opacity-60 sm:order-2"
            >
              {isSubmitting ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : null}
              Concluir configuração
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default OnboardingStep3Page;
