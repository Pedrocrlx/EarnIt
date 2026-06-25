import { LockClosedIcon, PersonIcon } from "@radix-ui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { ParentPinDialog } from "@/components/ParentPinDialog";
import { useAuth } from "@/context/useAuth";
import {
  PARENT_PROFILE_ID,
  SELECTED_PROFILE_STORAGE_KEY,
} from "@/lib/profile-selection";

type SelectableProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  protected?: boolean;
};

const parentProfile: SelectableProfile = {
  id: PARENT_PROFILE_ID,
  name: "Perfil Parental",
  avatarUrl: null,
  protected: true,
};

const staticFallbackProfiles: SelectableProfile[] = [
  { id: "demo-child-1", name: "Criança", avatarUrl: null },
  parentProfile,
];

export const ProfileSelectorPage = () => {
  const navigate = useNavigate();
  const { familyProfile, refreshSession } = useAuth();
  const [pinModalIsOpen, setPinModalIsOpen] = useState(false);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const familyName = familyProfile?.family_name?.trim();

  const profiles = useMemo<SelectableProfile[]>(() => {
    if (!familyProfile) {
      return staticFallbackProfiles;
    }

    const childProfiles = familyProfile.children
      .filter((child) => child.is_active)
      .map<SelectableProfile>((child) => ({
        id: child.id,
        name: child.name,
        avatarUrl: child.avatar_url,
      }));

    return [...childProfiles, parentProfile];
  }, [familyProfile]);

  const selectProfile = (profileId: string) => {
    if (profileId === PARENT_PROFILE_ID) {
      setPinModalIsOpen(true);
      return;
    }

    window.localStorage.setItem(SELECTED_PROFILE_STORAGE_KEY, profileId);
    navigate("/dashboard");
  };

  const enterParent = () => {
    window.localStorage.setItem(SELECTED_PROFILE_STORAGE_KEY, PARENT_PROFILE_ID);
    navigate("/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1f5e6] to-[#f8f9fb] px-5 py-10 text-[#191c1e] sm:px-8">
      <section className="flex w-full max-w-3xl flex-col items-center">
        <Logo className="h-12" />

        <div className="mt-8 text-center">
          {familyName ? (
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#5f6800]">
              {familyName}
            </p>
          ) : null}
          <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
            Quem está a usar?
          </h1>
          <p className="mt-2 text-sm text-[#404940]">
            Escolhe o teu perfil para continuar.
          </p>
        </div>

        <div className="mt-10 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
          {profiles.map((profile) => {
            const isParent = profile.id === PARENT_PROFILE_ID;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => selectProfile(profile.id)}
                aria-label={`Selecionar perfil de ${profile.name}`}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-[#e1e2e4] bg-white p-5 text-center shadow-[0px_4px_20px_rgba(3,78,34,0.05)] transition-all hover:-translate-y-1 hover:border-[#d4e251] hover:shadow-[0px_16px_28px_-12px_rgba(3,78,34,0.28)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#003514]/25"
              >
                <span className="relative">
                  {isParent ? (
                    <span className="flex size-20 items-center justify-center rounded-full bg-[#d4e251] text-[#003514] ring-4 ring-[#eef7d1] sm:size-24">
                      <PersonIcon className="size-9 sm:size-10" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-[#003514] text-2xl font-bold uppercase text-white ring-4 ring-[#eef7d1] sm:size-24 sm:text-3xl">
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt={`Foto de perfil de ${profile.name}`}
                          className="size-full object-cover"
                        />
                      ) : (
                        profile.name.slice(0, 1)
                      )}
                    </span>
                  )}
                  {profile.protected ? (
                    <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-[#003514] text-white ring-2 ring-white">
                      <LockClosedIcon className="size-4" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-base font-bold text-[#003514]">
                    {profile.name}
                  </span>
                  {profile.protected ? (
                    <span className="mt-0.5 block text-xs font-semibold text-[#7a8278]">
                      Protegido por PIN
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {pinModalIsOpen ? (
        <ParentPinDialog
          onClose={() => setPinModalIsOpen(false)}
          onUnlocked={enterParent}
        />
      ) : null}
    </main>
  );
};

export default ProfileSelectorPage;
