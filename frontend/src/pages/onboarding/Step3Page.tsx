import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import { apiFetch } from "@/lib/api";

type PinResponse = {
  status: string;
  message: string;
};

const OnboardingStep3Page = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const pinIsComplete = /^\d{4}$/.test(pin);
  const pinsMatch = pin === confirmPin;
  const canSubmit = useMemo(
    () => pinIsComplete && pinsMatch && !isSubmitting,
    [isSubmitting, pinIsComplete, pinsMatch],
  );

  const updatePin = (value: string, setter: (value: string) => void) => {
    setter(value.replace(/\D/g, "").slice(0, 4));
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pinIsComplete) {
      setError("Enter a 4-digit PIN.");
      return;
    }

    if (!pinsMatch) {
      setError("PINs do not match.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await apiFetch<PinResponse>("/auth/pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      const profile = await refreshSession();
      window.sessionStorage.removeItem("earnit:onboarding:child-count");
      window.sessionStorage.removeItem("earnit:onboarding:children-created");
      navigate(profile?.onboarding_completed ? "/profile" : "/onboarding/step2", {
        replace: true,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save your PIN. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[640px] flex-col items-center justify-center gap-10">
        <header className="flex w-full flex-col items-center gap-8">
          <img
            src="/earnit_logo_black.webp"
            alt="EarnIt"
            className="h-16 w-auto object-contain"
          />

          <div className="w-full max-w-[640px] space-y-2">
            <div className="flex items-center justify-between text-[14px] font-semibold text-[#003514]/60">
              <span className="uppercase tracking-[0.05em]">Step 3 of 3</span>
              <span className="text-[#003514]">Parent Security</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#edeef0]"
              aria-hidden="true"
            >
              <div className="h-full w-full rounded-full bg-[#d4e251]" />
            </div>
          </div>
        </header>

        <div className="max-w-[600px] space-y-2 text-center">
          <h1 className="font-montserrat text-[32px] font-bold leading-10 text-[#003514]">
            Secure the parent zone
          </h1>
          <p className="mx-auto max-w-[520px] text-[16px] leading-6 text-[#404940] sm:text-[18px] sm:leading-[26px]">
            Create a simple PIN so kids can explore EarnIt while grown-up
            settings stay protected.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <section className="grid gap-6 rounded-[32px] bg-white p-6 shadow-[0px_10px_40px_-10px_rgba(3,78,34,0.08)] sm:p-8">
            <div className="flex items-start gap-4 rounded-[24px] bg-[#f3f7da] p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#003514] text-[#d4e251]">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-[18px] font-bold leading-6 text-[#003514]">
                  Parent-only access
                </h2>
                <p className="text-sm leading-5 text-[#404940]">
                  This PIN unlocks parent controls and can be changed later from
                  settings.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="parent-pin"
                  className="pl-1 text-sm font-semibold text-[#404940]"
                >
                  Create PIN
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#404940]" />
                  <Input
                    id="parent-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={pin}
                    onChange={(event) => updatePin(event.target.value, setPin)}
                    placeholder="4 digits"
                    className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] pl-11 pr-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-parent-pin"
                  className="pl-1 text-sm font-semibold text-[#404940]"
                >
                  Confirm PIN
                </label>
                <div className="relative">
                  <CheckCircle2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#404940]" />
                  <Input
                    id="confirm-parent-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={confirmPin}
                    onChange={(event) =>
                      updatePin(event.target.value, setConfirmPin)
                    }
                    placeholder="Repeat PIN"
                    className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] pl-11 pr-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </section>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/onboarding/step2")}
              className="h-auto rounded-full bg-white px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.06),0px_4px_6px_-4px_rgba(0,0,0,0.06)] hover:bg-white hover:text-[#003514]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-auto rounded-full bg-[#d4e251] px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08),0px_4px_6px_-4px_rgba(0,0,0,0.08)] hover:bg-[#cfdc42] disabled:opacity-60"
            >
              {isSubmitting ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Finish Setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default OnboardingStep3Page;
