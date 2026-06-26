import { CheckCircledIcon, CircleIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { getPasswordRequirements } from "@/lib/validation";

type PasswordRequirementsHintProps = {
  id: string;
  password: string;
  visible: boolean;
};

export const PasswordRequirementsHint = ({
  id,
  password,
  visible,
}: PasswordRequirementsHintProps) => {
  const requirements = getPasswordRequirements(password);

  return (
    <div
      id={id}
      className={cn(
        "grid overflow-hidden rounded-lg bg-[#f8f9fb] transition-all duration-300 ease-out",
        visible
          ? "max-h-44 translate-y-0 opacity-100"
          : "max-h-0 -translate-y-1 opacity-0",
      )}
    >
      <ul className="grid gap-2 p-3" aria-label="Requisitos da palavra-passe">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={cn(
              "flex items-center gap-2 text-sm font-semibold leading-5 transition-colors duration-200",
              requirement.met ? "text-[#2c5b22]" : "text-[#70796f]",
            )}
          >
            {requirement.met ? (
              <CheckCircledIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
