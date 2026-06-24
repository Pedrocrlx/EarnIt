import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

// Smartphone-style PIN keypad. Controlled: the parent owns the entry string and
// decides what completion means (set-and-confirm, verify, etc.). This component
// only renders the dots + keypad and reports digit presses.
type PinPadProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  tone?: "default" | "success";
};

// 3-column layout: digits, an empty cell, then backspace (bottom-left blank).
const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export const PinPad = ({
  value,
  onChange,
  onComplete,
  length = 4,
  disabled = false,
  tone = "default",
}: PinPadProps) => {
  const pressDigit = (digit: string) => {
    if (disabled || value.length >= length) {
      return;
    }
    const next = value + digit;
    onChange(next);
    if (next.length === length) {
      onComplete?.(next);
    }
  };

  const pressBackspace = () => {
    if (disabled || value.length === 0) {
      return;
    }
    onChange(value.slice(0, -1));
  };

  return (
    <div>
      <div
        className="flex justify-center gap-3"
        role="status"
        aria-label={`${value.length} de ${length} dígitos introduzidos`}
      >
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-4 rounded-full transition-colors",
              index < value.length
                ? tone === "success"
                  ? "bg-[#3f8f4f]"
                  : "bg-[#003514]"
                : "bg-[#d8dcdf]",
            )}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="mx-auto mt-6 grid max-w-[320px] grid-cols-3 gap-3">
        {keypadKeys.map((key, index) => {
          if (key === "") {
            return <span key={`empty-${index}`} aria-hidden="true" />;
          }
          if (key === "back") {
            return (
              <button
                key="back"
                type="button"
                onClick={pressBackspace}
                disabled={disabled || value.length === 0}
                aria-label="Apagar"
                className="flex h-16 items-center justify-center rounded-2xl text-[#003514] transition active:scale-95 disabled:opacity-30 hover:bg-[#f3f4f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003514]/30"
              >
                <Delete className="size-6" aria-hidden="true" />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => pressDigit(key)}
              disabled={disabled}
              className="flex h-16 items-center justify-center rounded-2xl bg-[#f3f4f6] text-2xl font-bold text-[#003514] transition active:scale-95 active:bg-[#e4e7ea] disabled:opacity-40 hover:bg-[#eceef0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003514]/30"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PinPad;
