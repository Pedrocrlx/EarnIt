import { ArrowRight, ChevronDown, UsersRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import { readDraft, writeDraft } from "@/lib/onboarding-draft";
import { cn } from "@/lib/utils";
import {
  type FieldErrors,
  MAX_CHILDREN_PER_USER,
  MAX_FAMILY_NAME_LENGTH,
  validateMaxLength,
  validateRequired,
} from "@/lib/validation";

const childCountOptions = Array.from({ length: 10 }, (_, index) => index + 1);

type Step1Field = "familyName" | "childCount";

const invalidInputClass =
  "border-red-300 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/15";

const OnboardingStep1Page = () => {
  const navigate = useNavigate();
  const { familyProfile } = useAuth();
  const draft = readDraft();
  const [familyName, setFamilyName] = useState(
    draft.familyName ?? familyProfile?.family_name ?? "",
  );
  const [childCount, setChildCount] = useState(
    draft.childCount ? String(draft.childCount) : "",
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Step1Field>>({});

  const validateForm = () => {
    const nextErrors: FieldErrors<Step1Field> = {};
    const familyNameRequiredError = validateRequired(
      familyName,
      "Introduza o nome da sua família.",
    );
    const familyNameLengthError = validateMaxLength(
      familyName,
      MAX_FAMILY_NAME_LENGTH,
      `O nome da família deve ter ${MAX_FAMILY_NAME_LENGTH} caracteres ou menos.`,
    );
    const parsedChildCount = Number(childCount);

    if (familyNameRequiredError) {
      nextErrors.familyName = familyNameRequiredError;
    } else if (familyNameLengthError) {
      nextErrors.familyName = familyNameLengthError;
    }

    if (!childCount) {
      nextErrors.childCount = "Selecione o número de crianças.";
    } else if (
      !Number.isInteger(parsedChildCount) ||
      parsedChildCount < 1 ||
      parsedChildCount > MAX_CHILDREN_PER_USER
    ) {
      nextErrors.childCount = `Escolha entre 1 e ${MAX_CHILDREN_PER_USER} crianças.`;
    }

    return nextErrors;
  };

  const clearFieldError = (field: Step1Field) => {
    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedFamilyName = familyName.trim();

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    // No network here — onboarding is sent in one go on step 3's Concluir.
    writeDraft({ familyName: trimmedFamilyName, childCount: Number(childCount) });
    navigate("/onboarding/step2");
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
              <span className="uppercase tracking-[0.05em]">Passo 1 de 3</span>
              <span className="text-[#003514]">Configuração da família</span>
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
            Bem-vindo à família!
          </h1>
          <p className="text-[18px] leading-[26px] text-[#404940]">
            Vamos começar por configurar o perfil da sua família.
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
                Nome da família
              </label>
              <div className="relative">
                <UsersRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#404940]" />
                <Input
                  id="family-name"
                  value={familyName}
                  onChange={(event) => {
                    setFamilyName(event.target.value);
                    clearFieldError("familyName");
                    setError("");
                  }}
                  placeholder="ex.: Os Silvas"
                  aria-invalid={Boolean(fieldErrors.familyName)}
                  aria-describedby={
                    fieldErrors.familyName ? "family-name-error" : undefined
                  }
                  className={cn(
                    "h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] pl-11 pr-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0",
                    fieldErrors.familyName && invalidInputClass,
                  )}
                />
              </div>
              <FieldError id="family-name-error" message={fieldErrors.familyName} />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="children-count"
                className="pl-1 text-sm font-semibold text-[#404940]"
              >
                Número de crianças
              </label>
              <div className="relative">
                <select
                  id="children-count"
                  value={childCount}
                  onChange={(event) => {
                    setChildCount(event.target.value);
                    clearFieldError("childCount");
                    setError("");
                  }}
                  aria-invalid={Boolean(fieldErrors.childCount)}
                  aria-describedby={
                    fieldErrors.childCount ? "children-count-error" : undefined
                  }
                  className={cn(
                    "h-14 w-full appearance-none rounded-xl border-2 border-transparent bg-[#f3f4f6] px-4 text-base text-[#191c1e] outline-none transition-colors placeholder:text-[#6b7280] focus:border-[#003514] focus:ring-0",
                    fieldErrors.childCount && invalidInputClass,
                  )}
                >
                  <option value="">Selecione um número</option>
                  {childCountOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
              </div>
              <FieldError id="children-count-error" message={fieldErrors.childCount} />
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
              className="h-auto rounded-full bg-[#d4e251] px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08),0px_4px_6px_-4px_rgba(0,0,0,0.08)] hover:bg-[#cfdc42] disabled:opacity-60"
            >
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default OnboardingStep1Page;
