import { ArrowRight, ChevronDown, Smile, UsersRound } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";

const childCountOptions = Array.from({ length: 10 }, (_, index) => String(index + 1));

const OnboardingPage = () => {
  const [familyName, setFamilyName] = useState("");
  const [childCount, setChildCount] = useState("");
  const [saved, setSaved] = useState(false);

  const canContinue = useMemo(
    () => familyName.trim().length > 0 && childCount.length > 0,
    [childCount, familyName],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canContinue) {
      return;
    }

    window.sessionStorage.setItem(
      "earnit:onboarding:family",
      JSON.stringify({
        familyName: familyName.trim(),
        childCount: Number(childCount),
      }),
    );
    setSaved(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fb] text-[#191c1e] sm:px-10">
      <section className="flex w-full max-w-[500px] flex-col items-center gap-6">
        <Logo/>
        <Card className="w-full rounded-2xl border-0 bg-white py-0 shadow-[0px_8px_24px_0px_rgba(3,78,34,0.15)] ring-0">
          <CardContent className="px-6 pb-10 pt-12 sm:px-10 sm:pb-14 sm:pt-20">
            <div className="mb-16 flex w-full items-center justify-center gap-2 px-1 sm:mb-10">
              <span className="h-2 flex-1 rounded-full bg-[#003514]" />
              <span className="h-2 flex-1 rounded-full bg-[#e1e2e4]" />
              <span className="h-2 flex-1 rounded-full bg-[#e1e2e4]" />
            </div>

            <header className="mb-10 flex flex-col items-center gap-3 text-center">
              <h1 className="text-[28px] font-bold leading-9 text-[#003514] sm:text-[32px] sm:leading-10">
                Welcome to the Family!
              </h1>
              <p className="text-base font-normal leading-6 text-[#404940] sm:text-lg sm:leading-[26px]">
                Let's get started by setting up your family profile.
              </p>
            </header>

            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="family-name"
                  className="pl-1 text-sm font-semibold leading-5 text-[#191c1e]"
                >
                  Family Name
                </Label>
                <div className="relative">
                  <UsersRound
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#404940]"
                    aria-hidden="true"
                  />
                  <Input
                    id="family-name"
                    value={familyName}
                    onChange={(event) => {
                      setFamilyName(event.target.value);
                      setSaved(false);
                    }}
                    placeholder="e.g. The Robinsons"
                    className="h-14 rounded-xl border-2 border-[#c0c9bd] bg-white pl-[50px] pr-[18px] text-lg font-normal leading-normal text-[#191c1e] shadow-none placeholder:text-[#d9dadc] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pb-3">
                <Label
                  htmlFor="child-count"
                  className="pl-1 text-sm font-semibold leading-5 text-[#191c1e]"
                >
                  Number of Children
                </Label>
                <div className="relative">
                  <Smile
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#404940]"
                    aria-hidden="true"
                  />
                  <select
                    id="child-count"
                    value={childCount}
                    onChange={(event) => {
                      setChildCount(event.target.value);
                      setSaved(false);
                    }}
                    className="h-14 w-full appearance-none rounded-xl border-2 border-[#c0c9bd] bg-white py-2.5 pl-[50px] pr-11 text-lg font-normal leading-[26px] text-[#191c1e] outline-none transition-colors focus:border-[#003514] focus:ring-[3px] focus:ring-[#003514]/15"
                  >
                    <option value="">Select number</option>
                    {childCountOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#191c1e]"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-16 w-full rounded-xl bg-[#dbe957] text-xl font-semibold leading-7 text-[#003514] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05)] hover:bg-[#d2e24f] disabled:opacity-60"
                disabled={!canContinue}
              >
                Continue
                <ArrowRight className="size-5" aria-hidden="true" />
              </Button>

              {saved && (
                <p className="text-center text-sm font-medium leading-5 text-[#003514]">
                  Family setup saved.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-base font-normal leading-6 text-[#70796f]">
          Step 1 of 3 • You can add or remove members later.
        </p>
      </section>
    </main>
  );
};

export default OnboardingPage;
