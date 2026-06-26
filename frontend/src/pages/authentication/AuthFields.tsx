import { EnvelopeClosedIcon, EyeClosedIcon, EyeOpenIcon, LockClosedIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-[51px] rounded-lg border-2 border-[#e1e2e4] bg-[#f8f9fb] text-base font-normal leading-normal text-[#6b7280]";
const invalidInputClass =
  "border-red-300 bg-red-50/40 text-[#191c1e] focus-visible:border-red-500 focus-visible:ring-red-500/15";

type EmailFieldProps = {
  error?: string;
  value: string;
  onChange: (value: string) => void;
};

export const EmailField = ({ error, value, onChange }: EmailFieldProps) => (
  <div className="space-y-2">
    <Label
      htmlFor="email"
      className="text-sm font-semibold leading-5 text-[#191c1e]"
    >
      Email
    </Label>
    <div className="relative">
      <EnvelopeClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404940]" />
      <Input
        id="email"
        type="email"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "email-error" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(inputClassName, "pl-10 pr-3", error && invalidInputClass)}
      />
    </div>
    <FieldError id="email-error" message={error} />
  </div>
);

type PasswordFieldProps = {
  children?: ReactNode;
  describedBy?: string;
  error?: string;
  id: string;
  label: string;
  value: string;
  isVisible: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onVisibilityChange: (isVisible: boolean) => void;
};

export const PasswordField = ({
  children,
  describedBy,
  error,
  id,
  isVisible,
  label,
  onBlur,
  onChange,
  onFocus,
  onVisibilityChange,
  value,
}: PasswordFieldProps) => (
  <div className="space-y-2">
    <Label
      htmlFor={id}
      className="text-sm font-semibold leading-5 text-[#191c1e]"
    >
      {label}
    </Label>
    <div className="relative">
      <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404940]" />
      <Input
        id={id}
        type={isVisible ? "text" : "password"}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [error ? `${id}-error` : undefined, describedBy]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        className={cn(inputClassName, "pl-10 pr-10", error && invalidInputClass)}
      />
      <button
        type="button"
        onClick={() => onVisibilityChange(!isVisible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#404940]"
        aria-label={isVisible ? `Ocultar ${label}` : `Mostrar ${label}`}
      >
        {isVisible ? (
          <EyeClosedIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeOpenIcon className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
    {children}
    <FieldError id={`${id}-error`} message={error} />
  </div>
);
