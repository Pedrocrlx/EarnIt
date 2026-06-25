import { Cross2Icon } from "@radix-ui/react-icons";
import { type ReactNode, useId } from "react";

type ModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  // Disable the close button while an action is running (e.g. submitting).
  closeDisabled?: boolean;
  // Override the panel width (default max-w-[440px]).
  widthClassName?: string;
};

// Shared dialog chrome: a blurred, dimmed backdrop with a centered white panel,
// a title (+ optional subtitle) and a close button. Reused by every app modal.
export const Modal = ({
  title,
  subtitle,
  onClose,
  children,
  closeDisabled = false,
  widthClassName = "max-w-[440px]",
}: ModalProps) => {
  const titleId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#003514]/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`max-h-[90vh] w-full ${widthClassName} overflow-y-auto rounded-xl bg-white p-5 shadow-[0px_20px_40px_-12px_rgba(0,0,0,0.35)] sm:p-6`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-[#003514]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm leading-5 text-[#404940]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Fechar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#404940] transition-colors hover:bg-[#f3f4f6] disabled:opacity-60"
          >
            <Cross2Icon className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
