import { ClipboardList, Gift, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const howItWorksSteps = [
  {
    title: "Assign Chores",
    description: "Parents set tasks, point values, and deadlines in seconds.",
    icon: ClipboardList,
    iconColor: "text-white",
    iconBg: "bg-[#034e22]",
  },
  {
    title: "Kids Earn",
    description: "Kids complete tasks, checking them off to earn points and level up.",
    icon: ShieldCheck,
    iconColor: "text-[#1a1d00]",
    iconBg: "bg-[#deec5a]",
  },
  {
    title: "Redeem Rewards",
    description: "Points translate to real-world rewards, screen time, or allowance.",
    icon: Gift,
    iconColor: "text-white",
    iconBg: "bg-[#034e22]",
  },
];

const footerLinks = ["Privacy Policy", "Terms of Service", "Contact Us", "Help Center"];

const ctaButtonClass =
  "h-auto rounded-full bg-[#deec5a] px-8 py-3 text-xs font-bold leading-5 text-[#1a1d00] shadow-[0px_4px_0px_rgba(91,99,0,0.5)] hover:bg-[#d7e652] sm:px-10";

export const LandingPage = () => {
  const navigate = useNavigate();

  const handleRegister = () => navigate("/register");

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#003514]">
      <main>
        <section className="overflow-hidden bg-[#f8f9fb] px-5 py-12 sm:px-8 sm:py-14 lg:px-16 lg:py-20 xl:py-24">
          <div className="mx-auto grid max-w-[1180px] items-center gap-10 md:grid-cols-[minmax(0,1fr)_300px] md:gap-12 lg:min-h-[430px] lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-[72px] xl:gap-20">
            <div className="max-w-[560px]">
              <h1 className="text-4xl font-normal leading-[1.12] tracking-normal text-[#003514] sm:text-5xl md:text-[52px] md:leading-[62px] lg:text-[56px] lg:leading-[66px]">
                Turn Chores into
                <br />
                <span className="text-[#c2cf40]">Achievements.</span>
              </h1>
              <p className="mt-5 max-w-[520px] text-base font-normal leading-7 text-[#404940] sm:text-lg sm:leading-8 lg:text-[22px] lg:leading-9">
                Make responsibility fun. Earnit helps parents organize tasks while rewarding kids
                for building great habits through a playful, gamified experience.
              </p>
              <Button onClick={handleRegister} className={cn(ctaButtonClass, "mt-8")}>
                Get Started Free
              </Button>
            </div>

            <div className="relative mx-auto flex w-full max-w-[220px] justify-center sm:max-w-[260px] md:max-w-[280px] lg:max-w-[300px]">
              <img
                src="/mascot/avocado.webp"
                alt="EarnIt avocado mascot"
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="relative overflow-hidden bg-[#f3f4f6] px-5 py-16 sm:px-8 sm:py-[72px] lg:px-16 lg:py-24"
        >
          <div className="mx-auto max-w-[1180px]">
            <div className="text-center">
              <h2 className="text-3xl font-normal leading-tight text-[#003514] sm:text-4xl lg:text-[40px] lg:leading-[56px]">
                How it Works
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#404940] sm:text-base">
                Three simple steps to building better habits.
              </p>
            </div>

            <div className="relative mt-10 sm:mt-12">
              <img
                src="/mascot/kiwi.webp"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -top-28 left-0 hidden w-[200px] select-none lg:block"
              />
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:gap-8">
                {howItWorksSteps.map((step) => {
                  const Icon = step.icon;

                  return (
                    <article
                      key={step.title}
                      className="relative z-10 flex min-h-[220px] flex-col items-center justify-center rounded-[24px] bg-white px-6 py-10 text-center shadow-[0px_8px_12px_rgba(3,78,34,0.08)] lg:min-h-[280px] lg:rounded-[32px] lg:px-8"
                    >
                      <div
                        className={cn(
                          "mb-6 flex size-14 sm:size-16 items-center justify-center rounded-full",
                          step.iconBg,
                        )}
                      >
                        <Icon className={cn("size-5 sm:size-6", step.iconColor)} aria-hidden="true" />
                      </div>
                      <h3 className="text-xl font-normal leading-7 text-[#003514]">
                        {step.title}
                      </h3>
                      <p className="mt-2 max-w-[240px] text-sm leading-6 text-[#404940]">
                        {step.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f8f9fb] px-5 py-16 sm:px-8 sm:py-[72px] lg:px-16 lg:py-24">
          <div className="mx-auto max-w-[1180px]">
            <div className="relative overflow-hidden rounded-[28px] bg-[#034e22] px-6 py-12 text-center shadow-[0px_8px_24px_rgba(3,78,34,0.08)] sm:px-10 lg:rounded-[40px] lg:px-14 lg:py-16">
              <div className="absolute -right-48 -top-48 size-72 rounded-full bg-[#003514] opacity-50 blur-[32px]" />
              <div className="absolute -bottom-40 -left-40 size-64 rounded-full bg-[#dbe957] opacity-20 blur-[20px]" />
              <div className="relative z-10 mx-auto max-w-[680px]">
                <h2 className="text-3xl font-normal leading-tight text-white sm:text-4xl lg:text-[44px] lg:leading-[60px]">
                  Join the Family
                </h2>
                <p className="mx-auto mt-4 max-w-[620px] text-sm leading-6 text-[#92d69c] sm:text-base">
                  Start making chores less of a chore. Sign up today and get your first month free
                  and join thousands of happy families.
                </p>
                <Button onClick={handleRegister} className={cn(ctaButtonClass, "mt-8")}>
                  Start Earning
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#f3f4f6] px-5 py-10 sm:px-8 lg:px-16 lg:py-12">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-8 lg:flex-row">
          <Logo className="h-10 w-auto sm:h-12" />
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:gap-x-10"
          >
            {footerLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-xs font-semibold leading-5 text-[#404940] transition-colors hover:text-[#003514]"
              >
                {link}
              </a>
            ))}
          </nav>
          <p className="text-center text-xs font-semibold leading-5 text-[#404940]">
            © 2024 Earnit Family. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
