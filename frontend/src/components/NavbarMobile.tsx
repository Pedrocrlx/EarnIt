import type { ReactNode } from "react";
import { ArchiveIcon, CalendarIcon, ChevronRightIcon, Cross2Icon, GearIcon, HamburgerMenuIcon, HomeIcon, LoopIcon, PersonIcon, TargetIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import {
  lockParentProfile,
  selectedProfileIsParent,
} from "@/lib/profile-selection";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: ReactNode;
};

const dashboardNavItems = [
  { name: "Painel", path: "/dashboard", icon: HomeIcon },
  { name: "Tarefas", path: "/dashboard/tasks", icon: CalendarIcon, parentOnly: true },
  { name: "Submissões", path: "/dashboard/submissions", icon: ArchiveIcon, parentOnly: true },
  { name: "Objetivos", path: "/dashboard/goals", icon: TargetIcon },
  {
    name: "Perfis",
    path: "/dashboard/profiles",
    icon: PersonIcon,
    parentOnly: true,
  },
  { name: "Definições", path: "/dashboard/settings", icon: GearIcon, parentOnly: true },
];

const navItemStyle =
  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors";

export const DashboardShell = ({ children }: DashboardShellProps) => {
  const { familyProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuIsOpen, setMobileMenuIsOpen] = useState(false);
  const familyName = familyProfile?.family_name?.trim() || "Família";
  const parentProfileIsSelected = selectedProfileIsParent();

  const handleSwitchProfile = () => {
    setMobileMenuIsOpen(false);
    lockParentProfile();
    navigate("/profile");
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-white px-4 py-5 text-[#003514]">
      <div className="flex items-center justify-between gap-3 px-1">
        <Link
          to="/dashboard"
          className="flex items-center gap-3"
          onClick={() => setMobileMenuIsOpen(false)}
        >
          <Logo className="h-11" />
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-full text-[#003514] lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuIsOpen(false)}
        >
          <Cross2Icon className="size-5" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-8 rounded-lg border border-[#e1e2e4] bg-[#f8f9fb] p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#d4e251] text-[#003514]">
            <PersonIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{familyName}</p>
          </div>
        </div>
      </div>

      <nav aria-label="Dashboard" className="mt-6 flex flex-1 flex-col gap-1">
        {dashboardNavItems.map((item) => {
          if (item.parentOnly && !parentProfileIsSelected) {
            return null;
          }

          const Icon = item.icon;
          const isActive = item.path
            ? location.pathname === item.path ||
              (item.path !== "/dashboard" && location.pathname.startsWith(item.path))
            : false;
          const itemClassName = cn(
            navItemStyle,
            isActive
              ? "bg-[#003514] text-white shadow-[0px_6px_16px_-12px_rgba(0,53,20,0.75)]"
              : item.path
                ? "text-[#404940] hover:bg-[#f3f4f6] hover:text-[#003514]"
                : "cursor-not-allowed text-[#9ca3a0]",
          );
          const content = (
            <>
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {isActive ? (
                <ChevronRightIcon className="size-4 shrink-0" aria-hidden="true" />
              ) : null}
            </>
          );

          return item.path ? (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setMobileMenuIsOpen(false)}
              className={itemClassName}
            >
              {content}
            </Link>
          ) : (
            <span key={item.name} className={itemClassName} aria-disabled="true">
              {content}
            </span>
          );
        })}
      </nav>

      <div className="border-t border-[#e1e2e4] pt-4">
        <button
          type="button"
          onClick={handleSwitchProfile}
          className={cn(
            navItemStyle,
            "w-full cursor-pointer text-[#404940] hover:bg-[#f3f4f6] hover:text-[#003514]",
          )}
        >
          <LoopIcon className="size-5" aria-hidden="true" />
          <span>Trocar Perfil</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative isolate flex min-h-screen bg-[#f8f9fb] text-[#191c1e] lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#e1e2e4] bg-white shadow-[1px_0px_2px_#0000000d] lg:block">
        {sidebar}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/35 transition-opacity lg:hidden",
          mobileMenuIsOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={() => setMobileMenuIsOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(82vw,256px)] border-r border-[#e1e2e4] bg-white shadow-[20px_0px_40px_-32px_rgba(0,0,0,0.55)] transition-transform duration-200 lg:hidden",
          mobileMenuIsOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebar}
      </aside>

      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e1e2e4] bg-white/95 px-4 backdrop-blur sm:px-6 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full border border-[#e1e2e4] text-[#003514]"
            aria-label="Abrir menu"
            aria-expanded={mobileMenuIsOpen}
            onClick={() => setMobileMenuIsOpen(true)}
          >
            <HamburgerMenuIcon className="size-5" aria-hidden="true" />
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <Logo className="h-9" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-[#003514]"
            aria-label="Notificações"
          >
          </Button>
        </header>

        <div className="w-full flex-1">{children}</div>
      </div>
    </div>
  );
};

export default DashboardShell;
