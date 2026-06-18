import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputClassName =
  "h-[51px] rounded-lg border-2 border-[#e1e2e4] bg-[#f8f9fb] text-base font-normal leading-normal text-[#6b7280]";

type EmailFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export const EmailField = ({ value, onChange }: EmailFieldProps) => (
  <div className="space-y-1">
    <Label
      htmlFor="email"
      className="text-sm font-semibold leading-5 text-[#191c1e]"
    >
      Email address
    </Label>
    <div className="relative">
      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404940]" />
      <Input
        id="email"
        type="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClassName} pl-10 pr-3`}
      />
    </div>
  </div>
);

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  isVisible: boolean;
  onChange: (value: string) => void;
  onVisibilityChange: (isVisible: boolean) => void;
};

export const PasswordField = ({
  id,
  isVisible,
  label,
  onChange,
  onVisibilityChange,
  value,
}: PasswordFieldProps) => (
  <div className="space-y-1">
    <Label
      htmlFor={id}
      className="text-sm font-semibold leading-5 text-[#191c1e]"
    >
      {label}
    </Label>
    <div className="relative">
      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404940]" />
      <Input
        id={id}
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClassName} pl-10 pr-10`}
      />
      <button
        type="button"
        onClick={() => onVisibilityChange(!isVisible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#404940]"
        aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
      >
        {isVisible ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  </div>
);
