import { ArrowLeftIcon, ArrowRightIcon, PersonIcon, PlusIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/useToast";
import {
  ONBOARDING_MAX_CHILDREN,
  readDraft,
  writeDraft,
} from "@/lib/onboarding-draft";
import { cn } from "@/lib/utils";
import OnboardingLayout from "./OnboardingLayout";
import {
  MAX_CHILD_NAME_LENGTH,
  isFutureDate,
  validateMaxLength,
  validateRequired,
} from "@/lib/validation";

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

const invalidInputClass =
  "border-red-300 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/15";

const getInitialChildren = (): ChildProfile[] => {
  const draft = readDraft();

  if (draft.children && draft.children.length > 0) {
    return draft.children.map((child, index) => ({
      id: index + 1,
      firstName: child.firstName ?? "",
      birthDate: child.birthDate ?? "",
    }));
  }

  const count = draft.childCount
    ? Math.min(Math.max(draft.childCount, 1), ONBOARDING_MAX_CHILDREN)
    : 1;

  return Array.from({ length: count }, (_, index) => createChild(index + 1));
};

const OnboardingStep2Page = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [children, setChildren] = useState<ChildProfile[]>(getInitialChildren);
  const [nextChildId, setNextChildId] = useState(children.length + 1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const getFieldKey = (
    id: number,
    field: keyof Omit<ChildProfile, "id">,
  ) => `${id}.${field}`;

  const getChildError = (
    id: number,
    field: keyof Omit<ChildProfile, "id">,
  ) => fieldErrors[getFieldKey(id, field)];

  const clearChildError = (
    id: number,
    field: keyof Omit<ChildProfile, "id">,
  ) => {
    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[getFieldKey(id, field)];
      return nextErrors;
    });
  };

  const validateChildren = () => {
    const nextErrors: Record<string, string> = {};

    children.forEach((child) => {
      const firstNameRequiredError = validateRequired(
        child.firstName,
        "Introduza o primeiro nome desta criança.",
      );
      const firstNameLengthError = validateMaxLength(
        child.firstName,
        MAX_CHILD_NAME_LENGTH,
        `O primeiro nome deve ter ${MAX_CHILD_NAME_LENGTH} caracteres ou menos.`,
      );

      if (firstNameRequiredError) {
        nextErrors[getFieldKey(child.id, "firstName")] = firstNameRequiredError;
      } else if (firstNameLengthError) {
        nextErrors[getFieldKey(child.id, "firstName")] = firstNameLengthError;
      }

      if (isFutureDate(child.birthDate)) {
        nextErrors[getFieldKey(child.id, "birthDate")] =
          "A data de nascimento não pode ser no futuro.";
      }
    });

    return nextErrors;
  };

  const addChild = () => {
    if (children.length >= ONBOARDING_MAX_CHILDREN) {
      showToast(
        `Pode adicionar até ${ONBOARDING_MAX_CHILDREN} crianças aqui. Pode adicionar mais tarde em Perfis.`,
        "error",
      );
      return;
    }

    setChildren((currentChildren) => [
      ...currentChildren,
      createChild(nextChildId),
    ]);
    setNextChildId((currentId) => currentId + 1);
  };

  const removeChild = (id: number) => {
    setFieldErrors((currentErrors) =>
      Object.fromEntries(
        Object.entries(currentErrors).filter(([key]) => !key.startsWith(`${id}.`)),
      ),
    );

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
    clearChildError(id, field);
    setChildren((currentChildren) =>
      currentChildren.map((child) =>
        child.id === id ? { ...child, [field]: value } : child,
      ),
    );
  };

  const saveChildren = () => {
    const nextErrors = validateChildren();

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    // No network here — the children are created in one go on step 3's Concluir.
    writeDraft({
      children: children.map((child) => ({
        firstName: child.firstName.trim(),
        birthDate: child.birthDate,
      })),
    });
    navigate("/onboarding/step3");
  };

  return (
    <OnboardingLayout step={2}>
      <div className="max-w-[600px] space-y-2 text-center">
          <h1 className="font-montserrat text-[32px] font-bold leading-10 text-[#003514]">
            Quem vai juntar-se à equipa?
          </h1>
          <p className="mx-auto max-w-[500px] text-[16px] leading-6 text-[#404940] sm:text-[18px] sm:leading-[26px]">
            Adicione as crianças para começar a configurar tarefas e recompensas.
            Pode sempre adicionar mais tarde.
          </p>
        </div>

        <form className="w-full space-y-6">
          <div className="space-y-4">
            {children.map((child, index) => (
              <section
                key={child.id}
                className="grid gap-5 rounded-[32px] bg-white p-5 shadow-[0px_10px_40px_-10px_rgba(3,78,34,0.08)] sm:grid-cols-[64px_1fr] sm:p-6"
                aria-label={`Criança ${index + 1}`}
              >
                <div className="flex items-start justify-between sm:block">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2c5b22] text-[#d4e251]">
                    <PersonIcon className="h-7 w-7" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChild(child.id)}
                    disabled={children.length === 1}
                    className="cursor-pointer text-sm font-semibold text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 sm:hidden"
                  >
                    Remover
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-[18px] font-bold leading-6 text-[#003514]">
                      Criança {index + 1}
                    </h2>
                    <button
                      type="button"
                      onClick={() => removeChild(child.id)}
                      disabled={children.length === 1}
                      className="hidden cursor-pointer text-sm font-semibold text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`child-${child.id}-first-name`}
                        className="pl-1 text-sm font-semibold text-[#404940]"
                      >
                        Primeiro nome
                      </label>
                      <Input
                        id={`child-${child.id}-first-name`}
                        value={child.firstName}
                        onChange={(event) =>
                          updateChild(child.id, "firstName", event.target.value)
                        }
                        placeholder="ex.: Emma"
                        aria-invalid={Boolean(getChildError(child.id, "firstName"))}
                        aria-describedby={
                          getChildError(child.id, "firstName")
                            ? `child-${child.id}-first-name-error`
                            : undefined
                        }
                        className={cn(
                          "h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] px-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0",
                          getChildError(child.id, "firstName") && invalidInputClass,
                        )}
                      />
                      <FieldError
                        id={`child-${child.id}-first-name-error`}
                        message={getChildError(child.id, "firstName")}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor={`child-${child.id}-birth-date`}
                        className="pl-1 text-sm font-semibold text-[#404940]"
                      >
                        Data de nascimento <span className="font-medium">(opcional)</span>
                      </label>
                      <Input
                        id={`child-${child.id}-birth-date`}
                        type="date"
                        value={child.birthDate}
                        onChange={(event) =>
                          updateChild(child.id, "birthDate", event.target.value)
                        }
                        aria-invalid={Boolean(getChildError(child.id, "birthDate"))}
                        aria-describedby={
                          getChildError(child.id, "birthDate")
                            ? `child-${child.id}-birth-date-error`
                            : `child-${child.id}-birth-date-hint`
                        }
                        className={cn(
                          "h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] px-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0",
                          getChildError(child.id, "birthDate") && invalidInputClass,
                        )}
                      />
                      <p
                        id={`child-${child.id}-birth-date-hint`}
                        className="pl-1 text-xs font-medium leading-5 text-[#404940]/70"
                      >
                        Pode adicionar isto mais tarde no perfil da criança.
                      </p>
                      <FieldError
                        id={`child-${child.id}-birth-date-error`}
                        message={getChildError(child.id, "birthDate")}
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
            disabled={children.length >= ONBOARDING_MAX_CHILDREN}
            className="flex min-h-20 w-full cursor-pointer items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-[#c8d0c1] text-[18px] font-semibold text-[#404940] transition-colors hover:border-[#003514] hover:text-[#003514] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edeef0]">
              <PlusIcon className="h-5 w-5" />
            </span>
            Adicionar outra criança
          </button>
        </form>

        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/onboarding/step1")}
            className="h-auto rounded-full bg-white px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.06),0px_4px_6px_-4px_rgba(0,0,0,0.06)] hover:bg-white hover:text-[#003514]"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button
            type="button"
            onClick={saveChildren}
            className="h-auto rounded-full bg-[#d4e251] px-10 py-4 text-sm font-semibold text-[#003514] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08),0px_4px_6px_-4px_rgba(0,0,0,0.08)] hover:bg-[#cfdc42] disabled:opacity-60"
          >
            Continuar
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Button>
        </div>
    </OnboardingLayout>
  );
};

export default OnboardingStep2Page;
