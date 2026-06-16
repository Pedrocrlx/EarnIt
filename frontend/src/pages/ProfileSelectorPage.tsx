import { LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
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
    id: "parent",
    name: "Mom/Dad",
    image: "/profile-selector/parent.jpg",
    alt: "Profile picture of Mom or Dad",
    protected: true,
  },
];

export const ProfileSelectorPage = () => {
  const navigate = useNavigate();

  const selectProfile = (profileId: string) => {
    window.localStorage.setItem("earnit:selected-profile", profileId);
    navigate("/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edeef0] px-5 py-10 text-[#191c1e] sm:px-8">
      <section className="flex w-full max-w-[760px] flex-col items-center">
        <Logo />
        <h1 className="mt-8 text-center text-base font-semibold leading-7 text-black sm:mt-9 sm:text-lg">
          Who is playing ?
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
    </main>
  );
};

export default ProfileSelectorPage;
