import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ToastContext } from "@/context/toast-context";
import type { Toast, ToastVariant } from "@/context/toast-context";

const TOAST_DURATION_MS = 4000;

const variantClass: Record<ToastVariant, string> = {
  success: "bg-[#eef7d1] text-[#5f6800]",
  error: "bg-red-50 text-red-700",
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, variant }]);
      const timer = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, TOAST_DURATION_MS);
      timers.current.push(timer);
    },
    [],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <p
            key={toast.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-3 text-sm font-semibold shadow-[0px_4px_20px_rgba(3,78,34,0.15)] animate-in fade-in slide-in-from-top-2 ${variantClass[toast.variant]}`}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
