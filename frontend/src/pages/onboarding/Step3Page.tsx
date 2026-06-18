import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
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

const pinPreviewSlots = Array.from({ length: 4 }, (_, index) => index);

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
      navigate(profile?.onboarding_completed ? "/dashboard" : "/onboarding/step2", {
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
              Step 3 of 3
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.06em] text-[#003514]/55">
              <span>Parent Security</span>
              <span className="text-[#003514]">Complete setup</span>
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
                Set your parent PIN
              </h1>
              <p className="mx-auto max-w-[430px] text-base leading-6 text-[#404940]">
                This PIN protects grown-up controls when someone switches into
                the Mom/Dad profile.
              </p>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-2xl bg-white p-5 shadow-[0px_18px_35px_-24px_rgba(3,78,34,0.55)] sm:p-6">
              <div className="flex items-start gap-3 rounded-xl bg-[#f3f7da] p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#003514] text-[#d4e251]">
                  <LockKeyhole className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold leading-6 text-[#003514]">
                    Parent-only access
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#404940]">
                    Use exactly 4 digits. You can change this PIN later from
                    parent settings.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5">
                <div className="space-y-2">
                  <label
                    htmlFor="parent-pin"
                    className="pl-1 text-sm font-semibold text-[#404940]"
                  >
                    Create PIN
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#404940]" />
                    <Input
                      id="parent-pin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={pin}
                      onChange={(event) => updatePin(event.target.value, setPin)}
                      placeholder="4 digits"
                      className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] pl-11 pr-4 text-base font-semibold tracking-[0.35em] text-[#191c1e] placeholder:tracking-normal placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirm-parent-pin"
                    className="pl-1 text-sm font-semibold text-[#404940]"
                  >
                    Confirm PIN
                  </label>
                  <div className="relative">
                    <CheckCircle2 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#404940]" />
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
                      className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] pl-11 pr-4 text-base font-semibold tracking-[0.35em] text-[#191c1e] placeholder:tracking-normal placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>

              <div
                className="mt-6 flex justify-center gap-2"
                aria-label={`${pin.length} of 4 PIN digits entered`}
              >
                {pinPreviewSlots.map((slot) => (
                  <span
                    key={slot}
                    className={`size-3 rounded-full transition-colors ${
                      slot < pin.length ? "bg-[#003514]" : "bg-[#d8dcdf]"
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>

              {error ? (
                <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
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
                Back
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-13 rounded-full bg-[#d4e251] px-6 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_18px_-16px_rgba(3,78,34,0.5)] hover:bg-[#cfdc42] disabled:opacity-60 sm:order-2"
              >
                {isSubmitting ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : null}
                Finish Setup
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};

export default OnboardingStep3Page;
