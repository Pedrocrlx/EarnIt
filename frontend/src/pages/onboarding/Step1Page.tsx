import { ArrowRight, ChevronDown, UsersRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import { apiFetch } from "@/lib/api";

const childCountOptions = Array.from({ length: 10 }, (_, index) => index + 1);

const OnboardingStep1Page = () => {
  const navigate = useNavigate();
  const { familyProfile, refreshSession } = useAuth();
  const [familyName, setFamilyName] = useState(familyProfile?.family_name ?? "");
  const [childCount, setChildCount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedFamilyName = familyName.trim();

    if (!trimmedFamilyName || !childCount) {
      setError("Enter your family name and number of children.");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiFetch("/profiles/family-name", {
        method: "PATCH",
        body: JSON.stringify({ family_name: trimmedFamilyName }),
      });
      window.sessionStorage.setItem("earnit:onboarding:child-count", childCount);
      await refreshSession();
      navigate("/onboarding/step2");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save family setup.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[640px] flex-col items-center justify-center gap-10">
        <header className="flex flex-col items-center gap-8">
          <img
            src="/earnit_logo_black.webp"
            alt="EarnIt"
            className="h-16 w-auto object-contain"
          />

          <div className="w-full max-w-[640px] space-y-2">
            <div className="flex items-center justify-between text-[14px] font-semibold text-[#003514]/60">
              <span className="uppercase tracking-[0.05em]">Step 1 of 3</span>
              <span className="text-[#003514]">Family Setup</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#edeef0]"
              aria-hidden="true"
            >
              <div className="h-full w-1/3 rounded-full bg-[#d4e251]" />
            </div>
          </div>
        </header>

        <div className="max-w-[600px] space-y-2 text-center">
          <h1 className="font-montserrat text-[32px] font-bold leading-10 text-[#003514]">
            Welcome to the Family!
          </h1>
          <p className="text-[18px] leading-[26px] text-[#404940]">
            Let&apos;s get started by setting up your family profile.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full rounded-[32px] bg-white p-6 shadow-[0px_10px_40px_-10px_rgba(3,78,34,0.08)] sm:p-8"
        >
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="family-name"
                className="pl-1 text-sm font-semibold text-[#404940]"
              >
                Family Name
              </label>
              <div className="relative">
                <UsersRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#404940]" />
                <Input
                  id="family-name"
                  value={familyName}
                  onChange={(event) => {
                    setFamilyName(event.target.value);
                    setError("");
                  }}
                  placeholder="e.g. The Robinsons"
                  className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] pl-11 pr-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="children-count"
                className="pl-1 text-sm font-semibold text-[#404940]"
              >
                Number of Children
              </label>
              <div className="relative">
                <select
                  id="children-count"
                  value={childCount}
                  onChange={(event) => {
                    setChildCount(event.target.value);
                    setError("");
                  }}
                  className="h-14 w-full appearance-none rounded-xl border-2 border-transparent bg-[#f3f4f6] px-4 text-base text-[#191c1e] outline-none transition-colors placeholder:text-[#6b7280] focus:border-[#003514] focus:ring-0"
                >
                  <option value="">Select number</option>
                  {childCountOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>

          <div className="mt-10 flex justify-center">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-auto rounded-full bg-[#d4e251] px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08),0px_4px_6px_-4px_rgba(0,0,0,0.08)] hover:bg-[#cfdc42] disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default OnboardingStep1Page;
