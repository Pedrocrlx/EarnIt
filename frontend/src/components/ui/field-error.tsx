import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type FieldErrorProps = {
  id: string;
  message?: string;
  className?: string;
};

const FieldError = ({ id, message, className }: FieldErrorProps) => {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      className={cn(
        "flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold leading-5 text-red-700",
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
};

export { FieldError };
