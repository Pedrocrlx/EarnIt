import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LockClosedIcon, UpdateIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PinPad } from "@/components/PinPad";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import { useSetPin } from "@/hooks/useSetPin";
import { apiFetch } from "@/lib/api";
import { clearDraft, readDraft } from "@/lib/onboarding-draft";
import { cn } from "@/lib/utils";
import OnboardingLayout from "./OnboardingLayout";

type PinResponse = {
  status: string;
  message: string;
};

const OnboardingStep3Page = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { showToast } = useToast();
  const { entry, phase, isConfirmed, confirmedPin, error, onChange, reset } =
    useSetPin();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The draft holds the family name + children from steps 1-2; without them there
  // is nothing to submit, so send the user back to the start.
  useEffect(() => {
    const draft = readDraft();
    if (!draft.familyName || !draft.children || draft.children.length === 0) {
      navigate("/onboarding/step1", { replace: true });
    }
  }, [navigate]);

  const handlePinChange = (value: string) => {
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
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível concluir a configuração. Tente novamente.",
        "error",
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
    <OnboardingLayout step={3}>
      <div className="max-w-[600px] space-y-2 text-center">
        <h1 className="font-montserrat text-[32px] font-bold leading-10 text-[#003514]">
          Defina o PIN parental
        </h1>
        <p className="text-[18px] leading-[26px] text-[#404940]">
          Este PIN protege os controlos dos adultos quando alguém muda para o
          Perfil Parental.
        </p>
      </div>

      <section className="w-full rounded-[32px] bg-white p-6 shadow-[0px_10px_40px_-10px_rgba(3,78,34,0.08)] sm:p-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-full bg-[#f3f7da] text-[#003514] transition-colors",
              isConfirmed && "bg-[#003514] text-[#d4e251]",
            )}
          >
            {isConfirmed ? (
              <CheckIcon className="size-5" aria-hidden="true" />
            ) : (
              <LockClosedIcon className="size-5" aria-hidden="true" />
            )}
          </span>
          <h2 className="mt-2 font-bold leading-6 text-[#003514]">{phaseTitle}</h2>
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

        {error ? (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
            {error}
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

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/onboarding/step2")}
          className="h-auto rounded-full bg-white px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.06),0px_4px_6px_-4px_rgba(0,0,0,0.06)] hover:bg-white hover:text-[#003514]"
        >
          <ArrowLeftIcon className="mr-2 size-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!isConfirmed || isSubmitting}
          className="h-auto rounded-full bg-[#d4e251] px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08),0px_4px_6px_-4px_rgba(0,0,0,0.08)] hover:bg-[#cfdc42] disabled:opacity-60"
        >
          {isSubmitting ? <UpdateIcon className="mr-2 size-4 animate-spin" /> : null}
          Concluir configuração
          <ArrowRightIcon className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingStep3Page;
