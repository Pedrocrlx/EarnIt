import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const OTP_LENGTH = 6;

export const VerificationCode = () => {
  const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const navigate = useNavigate();

  const isComplete = useMemo(() => code.every((digit) => digit !== ""), [code]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const updateDigit = (index: number, value: string) => {
    // Allow alphanumeric, sanitize to uppercase
    const sanitizedValue = value.replace(/[^a-zA-Z0-9]/g, "").slice(-1).toUpperCase();
    const nextCode = [...code];
    nextCode[index] = sanitizedValue;
    setCode(nextCode);

    if (sanitizedValue && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length <= 1) {
      updateDigit(index, value);
      return;
    }

    // Allow alphanumeric, sanitize to uppercase
    const pastedDigits = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, OTP_LENGTH - index)
      .split("")
      .map(char => char.toUpperCase());

    if (pastedDigits.length === 0) {
      return;
    }

    const nextCode = [...code];
    pastedDigits.forEach((digit, offset) => {
      nextCode[index + offset] = digit;
    });
    setCode(nextCode);

    const nextFocusIndex = Math.min(
      index + pastedDigits.length,
      OTP_LENGTH - 1,
    );
    inputRefs.current[nextFocusIndex]?.focus();
    inputRefs.current[nextFocusIndex]?.select();
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace") {
      if (code[index]) {
        const nextCode = [...code];
        nextCode[index] = "";
        setCode(nextCode);
        return;
      }

      if (index > 0) {
        const nextCode = [...code];
        nextCode[index - 1] = "";
        setCode(nextCode);
        inputRefs.current[index - 1]?.focus();
        inputRefs.current[index - 1]?.select();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
      inputRefs.current[index - 1]?.select();
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    }
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text");
    handleChange(index, pastedText);
  };

  const verifyMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/auth/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      navigate("/dashboard");
    },
    onError: (error: any) => {
      alert(error.message || "Verification failed");
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => apiFetch("/auth/verify/resend", {
      method: "POST",
    }),
    onSuccess: () => {
      alert("A new verification code has been sent.");
    },
    onError: (error: any) => {
      alert(error.message || "Failed to resend code");
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isComplete) return;
    verifyMutation.mutate({ code: code.join("") });
  };

  const otpSlots = Array.from({ length: OTP_LENGTH }, (_, index) => index);

  return (
    <main className="bg-[#f8f9fb] pt-24 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[448px] space-y-6">
        <section
          className="bg-white rounded-xl overflow-hidden shadow-[0px_4px_24px_#034e221a] p-10 relative"
          aria-labelledby="email-verification-title"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#deec5a] rounded-full blur-[32px] opacity-20" />
          
          <div className="flex flex-col items-center gap-6 relative z-10">
            <div className="flex w-16 h-16 items-center justify-center bg-[#edeef0] rounded-full shadow-[0px_1px_2px_#0000000d]">
              <Mail className="w-7 h-6 text-[#003514]" />
            </div>
            
            <div className="text-center space-y-2">
              <h1
                id="email-verification-title"
                className="font-montserrat font-bold text-[#003514] text-3xl tracking-tight leading-10"
              >
                Check your email
              </h1>
              <p className="text-[#404940] text-base leading-relaxed">
                We sent a code to your email. Enter it below to continue.
              </p>
            </div>

            <form className="w-full space-y-8" onSubmit={handleSubmit}>
              <fieldset className="flex justify-between gap-2">
                <legend className="sr-only">
                  Enter the 6-digit verification code
                </legend>
                {otpSlots.map((slotIndex) => {
                  const isFilled = code[slotIndex] !== "";
                  const isFirstEmpty = !isFilled && slotIndex === code.indexOf("");
                  const isActive =
                    (slotIndex === 0 && code.every((digit) => digit === "")) ||
                    isFirstEmpty;

                  return (
                    <input
                      key={slotIndex}
                      ref={(element) => {
                        inputRefs.current[slotIndex] = element;
                      }}
                      type="text"
                      inputMode="text"
                      autoComplete={slotIndex === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      aria-label={`Digit ${slotIndex + 1}`}
                      value={code[slotIndex]}
                      onChange={(event) =>
                        handleChange(slotIndex, event.target.value)
                      }
                      onKeyDown={(event) => handleKeyDown(slotIndex, event)}
                      onPaste={(event) => handlePaste(slotIndex, event)}
                      onFocus={(event) => event.target.select()}
                      className={`w-12 sm:w-14 h-16 rounded-lg border-2 border-solid text-center font-semibold text-[#003514] text-2xl transition-all ${
                        isFilled || isActive
                          ? "bg-white border-[#003514] ring-2 ring-[#003514]/10"
                          : "bg-gray-50 border-transparent"
                      } focus:outline-none focus:border-[#003514] focus:ring-4 focus:ring-[#003514]/10`}
                    />
                  );
                })}
              </fieldset>

              <Button
                type="submit"
                disabled={!isComplete}
                className={`w-full h-14 rounded-lg bg-[#deec5a] hover:bg-[#d7e652] text-[#1a1d00] font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  !isComplete && "opacity-50 cursor-not-allowed"
                }`}
              >
                Verify
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <div className="flex flex-col items-center gap-2 pt-4">
              <div className="text-[#404940] text-base">
                Didn't receive it?
              </div>
              <button
                type="button"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
                className="text-[#003514] font-semibold text-sm hover:underline transition-all"
              >
                {resendMutation.isPending ? "Resending..." : "Resend Code"}
              </button>
            </div>
          </div>
        </section>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 px-4 py-2 text-[#404940] font-semibold text-sm hover:text-[#003514] transition-colors rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>
        </div>
      </div>
    </main>
  );
};

export default VerificationCode;
