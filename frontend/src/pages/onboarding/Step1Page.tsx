import { ArrowRightIcon, PersonIcon } from "@radix-ui/react-icons";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import {
  ONBOARDING_MAX_CHILDREN,
  readDraft,
  writeDraft,
} from "@/lib/onboarding-draft";
import { cn } from "@/lib/utils";
import OnboardingLayout from "./OnboardingLayout";
import {
  type FieldErrors,
  MAX_FAMILY_NAME_LENGTH,
  validateMaxLength,
  validateRequired,
} from "@/lib/validation";

// The picker offers 1–4 or "5+"; "5+" seeds 5 child forms on step 2, where more
// can still be added up to the per-account limit.
const childCountOptions = [1, 2, 3, 4, 5];

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
      parsedChildCount > ONBOARDING_MAX_CHILDREN
    ) {
      nextErrors.childCount = `Escolha entre 1 e ${ONBOARDING_MAX_CHILDREN} crianças.`;
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
    <OnboardingLayout step={1}>
      <div className="max-w-[600px] space-y-2 text-center">
        <h1 className="font-montserrat text-2xl font-bold leading-8 text-[#003514]">
          Bem-vindo à família!
        </h1>
        <p className="text-base leading-6 text-[#404940]">
          Vamos começar por configurar o perfil da sua família.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full rounded-[32px] bg-white p-5 shadow-[0px_10px_40px_-10px_rgba(3,78,34,0.08)] sm:p-6"
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
                <PersonIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#404940]" />
                <Input
                  id="family-name"
                  value={familyName}
                  onChange={(event) => {
                    setFamilyName(event.target.value);
                    clearFieldError("familyName");
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
              <span className="pl-1 text-sm font-semibold text-[#404940]">
                Número de crianças
              </span>
              <div
                className="grid grid-cols-5 gap-2"
                role="group"
                aria-label="Número de crianças"
                aria-describedby={
                  fieldErrors.childCount ? "children-count-error" : undefined
                }
              >
                {childCountOptions.map((option) => {
                  const selected = childCount === String(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setChildCount(String(option));
                        clearFieldError("childCount");
                      }}
                      aria-pressed={selected}
                      className={cn(
                        "h-14 rounded-xl border-2 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#003514]/20",
                        selected
                          ? "border-[#003514] bg-[#003514] text-white"
                          : "border-transparent bg-[#f3f4f6] text-[#404940] hover:border-[#003514]/30 hover:text-[#003514]",
                      )}
                    >
                      {option === 5 ? "5+" : option}
                    </button>
                  );
                })}
              </div>
              <FieldError id="children-count-error" message={fieldErrors.childCount} />
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Button
              type="submit"
              className="h-auto rounded-full bg-[#d4e251] px-7 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08),0px_4px_6px_-4px_rgba(0,0,0,0.08)] hover:bg-[#cfdc42] disabled:opacity-60"
            >
              Continuar
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
    </OnboardingLayout>
  );
};

export default OnboardingStep1Page;
