import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OnboardingLayoutProps = {
  step: 1 | 2 | 3;
  children: ReactNode;
};

const progressWidth: Record<OnboardingLayoutProps["step"], string> = {
  1: "w-1/3",
  2: "w-2/3",
  3: "w-full",
};

// Shared onboarding chrome: centred frame, logo, and the step progress header.
// Each step provides its own title block + form/content as children.
export const OnboardingLayout = ({ step, children }: OnboardingLayoutProps) => (
  <main className="min-h-screen bg-[#f8f9fb] px-4 py-10 sm:px-6 lg:py-20">
    <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[640px] flex-col items-center justify-center gap-10">
      <header className="flex w-full flex-col items-center gap-8">
        <img
          src="/earnit_logo_black.webp"
          alt="Logótipo EarnIt"
          className="h-16 w-auto object-contain"
        />

        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-[14px] font-semibold text-[#003514]/60">
            <span className="uppercase tracking-[0.05em]">Passo {step} de 3</span>
            <span className="text-[#003514]">Configuração da família</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[#edeef0]"
            aria-hidden="true"
          >
            <div className={cn("h-full rounded-full bg-[#d4e251]", progressWidth[step])} />
          </div>
        </div>
      </header>

      {children}
    </section>
  </main>
);

export default OnboardingLayout;
