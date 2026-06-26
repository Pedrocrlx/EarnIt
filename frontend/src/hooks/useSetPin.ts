import { useEffect, useState } from "react";

// The "set a PIN" two-phase flow, shared by onboarding step 3 and the parent-PIN
// reset. The caller renders <PinPad value={entry} onChange={onChange} .../> and
// reads `isConfirmed` / `confirmedPin` to drive its own submit button. Like a
// phone: enter once -> re-enter to confirm; mismatch shows an error and restarts.

type Phase = "create" | "confirm";

const PIN_LENGTH = 4;

export const useSetPin = () => {
  const [phase, setPhase] = useState<Phase>("create");
  const [firstPin, setFirstPin] = useState("");
  const [entry, setEntry] = useState("");
  const [confirmedPin, setConfirmedPin] = useState("");
  const [error, setError] = useState("");

  const isConfirmed = confirmedPin.length === PIN_LENGTH;

  // Process a completed entry after the 4th dot has painted, so it feels like a
  // phone unlocking: create -> confirm, then match (done) or mismatch (restart).
  useEffect(() => {
    if (entry.length !== PIN_LENGTH) {
      return;
    }
    const timer = setTimeout(() => {
      if (phase === "create") {
        setFirstPin(entry);
        setEntry("");
        setPhase("confirm");
        return;
      }
      if (entry === firstPin) {
        setConfirmedPin(entry);
      } else {
        setError("Os PINs não coincidem. Tente novamente.");
        setFirstPin("");
        setEntry("");
        setPhase("create");
      }
    }, 140);
    return () => clearTimeout(timer);
  }, [entry, phase, firstPin]);

  const onChange = (value: string) => {
    setError("");
    setEntry(value);
  };

  const reset = () => {
    setPhase("create");
    setFirstPin("");
    setEntry("");
    setConfirmedPin("");
    setError("");
  };

  return { entry, phase, isConfirmed, confirmedPin, error, onChange, reset } as const;
};
