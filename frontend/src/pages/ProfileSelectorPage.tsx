import { LoaderCircle, LockKeyhole, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type PinVerificationResponse = {
  status: string;
  authenticated: boolean;
};

const PARENT_PROFILE_ID = "parent";
const SELECTED_PROFILE_STORAGE_KEY = "earnit:selected-profile";

const profiles = [
  {
    id: "leo",
    name: "Leo",
    image: "/profile-selector/leo.jpg",
    alt: "Profile picture of Leo",
  },
  {
    id: "maya",
    name: "Maya",
    image: "/profile-selector/maya.jpg",
    alt: "Profile picture of Maya",
  },
  {
    id: PARENT_PROFILE_ID,
    name: "Mom/Dad",
    image: "/profile-selector/parent.jpg",
    alt: "Profile picture of Mom or Dad",
    protected: true,
  },
];

type ParentPinDialogProps = {
  error: string;
  isVerifying: boolean;
  onClose: () => void;
  onPinChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pin: string;
};

const ParentPinDialog = ({
  error,
  isVerifying,
  onClose,
  onPinChange,
  onSubmit,
  pin,
}: ParentPinDialogProps) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-[#003514]/60 px-4 py-6"
    role="dialog"
    aria-modal="true"
    aria-labelledby="parent-pin-title"
  >
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[380px] rounded-xl bg-white p-5 shadow-[0px_20px_40px_-12px_rgba(0,0,0,0.35)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="parent-pin-title"
            className="font-montserrat text-xl font-bold text-[#003514]"
          >
            Parent PIN
          </h2>
          <p className="mt-1 text-sm leading-5 text-[#404940]">
            Enter the PIN created during onboarding.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isVerifying}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#404940] transition-colors hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Close parent PIN dialog"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 space-y-1.5">
        <label
          htmlFor="profile-parent-pin"
          className="pl-1 text-sm font-semibold text-[#404940]"
        >
          4-digit PIN
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#404940]" />
          <Input
            id="profile-parent-pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(event) => onPinChange(event.target.value)}
            placeholder="Enter PIN"
            className="h-14 rounded-xl border-2 border-transparent bg-[#f3f4f6] pl-11 pr-4 text-base text-[#191c1e] placeholder:text-[#6b7280] focus-visible:border-[#003514] focus-visible:ring-0"
            autoFocus
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isVerifying}
          className="h-12 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isVerifying}
          className="h-12 rounded-full bg-[#d4e251] text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
        >
          {isVerifying ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" />
          ) : null}
          Unlock
        </Button>
      </div>
    </form>
  </div>
);

export const ProfileSelectorPage = () => {
  const navigate = useNavigate();
  const [pinModalIsOpen, setPinModalIsOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const selectProfile = (profileId: string) => {
    if (profileId === PARENT_PROFILE_ID) {
      setPin("");
      setPinError("");
      setPinModalIsOpen(true);
      return;
    }

    window.localStorage.setItem(SELECTED_PROFILE_STORAGE_KEY, profileId);
    navigate("/dashboard");
  };

  const closePinModal = () => {
    if (isVerifyingPin) {
      return;
    }

    setPinModalIsOpen(false);
    setPin("");
    setPinError("");
  };

  const updatePin = (value: string) => {
    setPin(value.replace(/\D/g, "").slice(0, 4));
    setPinError("");
  };

  const verifyParentPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{4}$/.test(pin)) {
      setPinError("Enter your 4-digit parent PIN.");
      return;
    }

    setIsVerifyingPin(true);
    setPinError("");

    try {
      const response = await apiFetch<PinVerificationResponse>("/auth/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });

      if (!response.authenticated) {
        setPinError("Incorrect PIN.");
        return;
      }

      window.localStorage.setItem(
        SELECTED_PROFILE_STORAGE_KEY,
        PARENT_PROFILE_ID,
      );
      navigate("/dashboard");
    } catch (caughtError) {
      setPinError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to verify your PIN.",
      );
    } finally {
      setIsVerifyingPin(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edeef0] px-5 py-10 text-[#191c1e] sm:px-8">
      <section className="flex w-full max-w-[760px] flex-col items-center">
        <Logo />
        <h1 className="mt-8 text-center text-base font-semibold leading-7 text-black sm:mt-9 sm:text-lg">
          Who is playing?
        </h1>

        <div className="mt-10 grid w-full max-w-[640px] grid-cols-1 justify-items-center gap-8 sm:grid-cols-3 sm:gap-6 lg:mt-12 lg:gap-10">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => selectProfile(profile.id)}
              className="group flex w-[150px] flex-col items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#034e22]/30 sm:w-[145px] lg:w-40"
              aria-label={`Select ${profile.name} profile`}
            >
              <span className="relative w-full overflow-hidden rounded-xl border border-white/40 bg-white/30 p-px shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0px_14px_22px_-8px_rgba(0,0,0,0.18)]">
                <img
                  src={profile.image}
                  alt={profile.alt}
                  className="aspect-square w-full rounded-[11px] object-cover"
                />
                {profile.protected && (
                  <span className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-[#003514] text-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                    <LockKeyhole className="size-4" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="text-center text-base font-semibold leading-7 text-[#191c1e] sm:text-lg lg:text-xl">
                {profile.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {pinModalIsOpen ? (
        <ParentPinDialog
          error={pinError}
          isVerifying={isVerifyingPin}
          onClose={closePinModal}
          onPinChange={updatePin}
          onSubmit={verifyParentPin}
          pin={pin}
        />
      ) : null}
    </main>
  );
};

export default ProfileSelectorPage;
