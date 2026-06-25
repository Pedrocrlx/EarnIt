import type { ReactNode } from "react";
import { ListBulletIcon, LoopIcon, MagicWandIcon, TargetIcon } from "@radix-ui/react-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { formatPoints } from "@/lib/points";
import { getSelectedProfileId } from "@/lib/profile-selection";
import { cn } from "@/lib/utils";

type ChildShellProps = {
  points: number;
  loading?: boolean;
  children: ReactNode;
};

const tabs = [
  { name: "Tarefas", path: "/dashboard", icon: ListBulletIcon },
  { name: "Objetivos", path: "/dashboard/goals", icon: TargetIcon },
];

export const ChildShell = ({ points, loading = false, children }: ChildShellProps) => {
  const { familyProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedProfileId = getSelectedProfileId();
  const child = familyProfile?.children.find(
    (item) => item.id === selectedProfileId && item.is_active,
  );

  const isTabActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#191c1e]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#003514] text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#d4e251] text-base font-bold uppercase text-[#003514]">
              {child?.avatar_url ? (
                <img
                  src={child.avatar_url}
                  alt={`Perfil de ${child.name}`}
                  className="size-full object-cover"
                />
              ) : (
                (child?.name ?? "?").slice(0, 1)
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.06em] text-[#d4e251]">
                Olá
              </p>
              <p className="truncate text-base font-bold leading-tight">
                {child?.name ?? "Perfil"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">
              <MagicWandIcon className="size-4 text-[#d4e251]" aria-hidden="true" />
              {loading ? "–" : formatPoints(points)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              aria-label="Trocar perfil"
              className="size-10 rounded-full text-white hover:bg-white/10 hover:text-white"
            >
              <LoopIcon className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav
        aria-label="Navegação"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e1e2e4] bg-white"
      >
        <div className="mx-auto flex w-full max-w-md items-stretch gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
          {tabs.map((tab) => {
            const active = isTabActive(tab.path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-xs font-semibold transition-colors",
                  active
                    ? "bg-[#eef7d1] text-[#003514]"
                    : "text-[#7a8278] hover:text-[#003514]",
                )}
              >
                <Icon className="size-6" aria-hidden="true" />
                {tab.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default ChildShell;
