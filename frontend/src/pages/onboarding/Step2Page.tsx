import { ArrowLeft, ArrowRight, HandCoins, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import { apiFetch } from "@/lib/api";

type ChildProfile = {
  id: number;
  firstName: string;
  birthDate: string;
};

const createChild = (id: number): ChildProfile => ({
  id,
  firstName: "",
  birthDate: "",
});

const getInitialChildren = () => {
  const savedCount = Number(
    window.sessionStorage.getItem("earnit:onboarding:child-count") ?? "1",
  );
  const childCount = Number.isFinite(savedCount)
    ? Math.min(Math.max(savedCount, 1), 10)
    : 1;

  return Array.from({ length: childCount }, (_, index) => createChild(index + 1));
};

const OnboardingStep2Page = () => {
  const navigate = useNavigate();
  const { familyProfile, refreshSession } = useAuth();
  const [children, setChildren] = useState<ChildProfile[]>(getInitialChildren);
  const [nextChildId, setNextChildId] = useState(children.length + 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addChild = () => {
    setChildren((currentChildren) => [
      ...currentChildren,
      createChild(nextChildId),
    ]);
    setNextChildId((currentId) => currentId + 1);
  };

  const removeChild = (id: number) => {
    setChildren((currentChildren) => {
      if (currentChildren.length === 1) {
        return currentChildren;
      }

      return currentChildren.filter((child) => child.id !== id);
    });
  };

  const updateChild = (
    id: number,
    field: keyof Omit<ChildProfile, "id">,
    value: string,
  ) => {
    setError("");
    setChildren((currentChildren) =>
      currentChildren.map((child) =>
        child.id === id ? { ...child, [field]: value } : child,
      ),
    );
  };

  const saveChildren = async () => {
    setError("");

    const activeChildren = children.map((child) => ({
      name: child.firstName.trim(),
      birth_date: child.birthDate || null,
    }));

    if (activeChildren.some((child) => !child.name)) {
      setError("Enter a first name for each child.");
      return;
    }

    setIsSubmitting(true);

    try {
      const alreadyCreated =
        window.sessionStorage.getItem("earnit:onboarding:children-created") ===
        "true";
      const hasExistingChildren = (familyProfile?.children.length ?? 0) > 0;

      if (!alreadyCreated && !hasExistingChildren) {
        await Promise.all(
          activeChildren.map((child) =>
            apiFetch("/profiles/children", {
              method: "POST",
              body: JSON.stringify(child),
            }),
          ),
        );
        window.sessionStorage.setItem(
          "earnit:onboarding:children-created",
          "true",
        );
      }

      await refreshSession();
      navigate("/onboarding/step3");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save child profiles.",
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
              <span className="uppercase tracking-[0.05em]">Step 2 of 3</span>
              <span className="text-[#003514]">Family Setup</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#edeef0]"
              aria-hidden="true"
            >
              <div className="h-full w-2/3 rounded-full bg-[#d4e251]" />
            </div>
          </div>
        </header>

        <div className="max-w-[600px] space-y-2 text-center">
          <h1 className="font-montserrat text-[32px] font-bold leading-10 text-[#003514]">
            Who&apos;s joining the crew?
          </h1>
          <p className="mx-auto max-w-[500px] text-[16px] leading-6 text-[#404940] sm:text-[18px] sm:leading-[26px]">
            Add your kids to get started setting up chores and rewards. You can
            always add more later.
          </p>
        </div>

        <form className="w-full space-y-6">
          <div className="space-y-4">
            {children.map((child, index) => (
              <section
                key={child.id}
                className="grid gap-5 rounded-[32px] bg-white p-5 shadow-[0px_10px_40px_-10px_rgba(3,78,34,0.08)] sm:grid-cols-[64px_1fr] sm:p-6"
                aria-label={`Child ${index + 1}`}
              >
                <div className="flex items-start justify-between sm:block">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2c5b22] text-[#d4e251]">
                    <HandCoins className="h-7 w-7" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChild(child.id)}
                    disabled={children.length === 1}
                    className="text-sm font-semibold text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 sm:hidden"
                  >
                    Remove
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-[18px] font-bold leading-6 text-[#003514]">
                      Child {index + 1}
                    </h2>
                    <button
                      type="button"
                      onClick={() => removeChild(child.id)}
                      disabled={children.length === 1}
                      className="hidden text-sm font-semibold text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`child-${child.id}-first-name`}
                        className="pl-1 text-sm font-semibold text-[#404940]"
                      >
                        First Name
                      </label>
                      <Input
                        id={`child-${child.id}-first-name`}
                        value={child.firstName}
                        onChange={(event) =>
                          updateChild(child.id, "firstName", event.target.value)
                        }
                        placeholder="e.g. Emma"
                        className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] px-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor={`child-${child.id}-birth-date`}
                        className="pl-1 text-sm font-semibold text-[#404940]"
                      >
                        Date of Birth
                      </label>
                      <Input
                        id={`child-${child.id}-birth-date`}
                        type="date"
                        value={child.birthDate}
                        onChange={(event) =>
                          updateChild(child.id, "birthDate", event.target.value)
                        }
                        className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] px-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <button
            type="button"
            onClick={addChild}
            className="flex min-h-20 w-full items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-[#c8d0c1] text-[18px] font-semibold text-[#404940] transition-colors hover:border-[#003514] hover:text-[#003514]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edeef0]">
              <Plus className="h-5 w-5" />
            </span>
            Add Another Child
          </button>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
        </form>

        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/onboarding/step1")}
            className="h-auto rounded-full bg-white px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.06),0px_4px_6px_-4px_rgba(0,0,0,0.06)] hover:bg-white hover:text-[#003514]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            onClick={saveChildren}
            disabled={isSubmitting}
            className="h-auto rounded-full bg-[#d4e251] px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08),0px_4px_6px_-4px_rgba(0,0,0,0.08)] hover:bg-[#cfdc42] disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
    </main>
  );
};

export default OnboardingStep2Page;
