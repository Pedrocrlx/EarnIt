import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { cn } from "@/lib/utils";
import Logo from "./Logo";

const navigationItems = [
  { name: "Funcionalidades", path: "/#features" },
  { name: "Como funciona", path: "/#how-it-works" },
];

const hiddenNavbarPaths = [
  "/login",
  "/register",
  "/verification",
  "/profile",
  "/dashboard",
];

const primaryButtonStyle =
  "h-auto rounded-full bg-[#deec5a] px-4 py-2 text-xs font-bold leading-5 text-[#1a1d00] shadow-[0px_4px_0px_#5b630080] hover:bg-[#d7e652] sm:text-sm";
const ghostButtonStyle =
  "h-auto px-4 py-2 text-xs font-semibold leading-5 text-[#003514] shadow-none hover:bg-transparent hover:text-[#003514] sm:text-sm";
const mobileLinkStyle =
  "rounded-lg px-3 py-3 text-base font-semibold text-[#003514] transition-colors hover:bg-[#f3f4f6]";

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const [menuIsOpen, setMenuIsOpen] = useState(false);

  const shouldHideNavbar =
    hiddenNavbarPaths.includes(location.pathname) ||
    location.pathname.startsWith("/dashboard/") ||
    location.pathname.startsWith("/onboarding");

  if (shouldHideNavbar) {
    return null;
  }

  const navigateAndClose = (path: string) => {
    setMenuIsOpen(false);
    navigate(path);
  };

  const logoutAndClose = async () => {
    setMenuIsOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <header className="w-full border-b border-black/5 bg-white shadow-[0px_1px_2px_#0000000d]">
      <div className="flex items-center justify-between px-5 py-2 sm:px-8 lg:px-16">
        <Link to="/">
          <Logo className="h-12 w-auto sm:h-14" />
        </Link>
        <nav
          aria-label="Principal"
          className="hidden items-center gap-10 md:flex lg:gap-16"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="text-base font-normal leading-6 text-[#404940] transition-colors hover:text-[#003514]"
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:gap-4 md:flex">
          {isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate("/dashboard")}
                className={cn(ghostButtonStyle)}
              >
                Painel
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/dashboard/profiles")}
                className={cn(ghostButtonStyle)}
              >
                Perfis
              </Button>
              <Button
                variant="default"
                onClick={logoutAndClose}
                className={cn(primaryButtonStyle)}
              >
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate("/login")}
                className={cn(ghostButtonStyle)}
              >
                Entrar
              </Button>
              <Button
                variant="default"
                onClick={() => navigate("/register")}
                className={cn(primaryButtonStyle)}
              >
                Criar conta
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMenuIsOpen((isOpen) => !isOpen)}
          className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-[#e1e2e4] text-[#003514] transition-colors hover:bg-[#f3f4f6] md:hidden"
          aria-label={
            menuIsOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"
          }
          aria-expanded={menuIsOpen}
        >
          {menuIsOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {menuIsOpen ? (
        <div className="border-t border-black/5 bg-white px-5 pb-5 pt-3 md:hidden">
          <nav aria-label="Principal mobile" className="flex flex-col gap-1">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={mobileLinkStyle}
                onClick={() => setMenuIsOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="mt-4 grid gap-3">
            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigateAndClose("/dashboard")}
                  className={cn(ghostButtonStyle, "w-full justify-center py-3")}
                >
                  Painel
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigateAndClose("/dashboard/profiles")}
                  className={cn(ghostButtonStyle, "w-full justify-center py-3")}
                >
                  Perfis
                </Button>
                <Button
                  variant="default"
                  onClick={logoutAndClose}
                  className={cn(primaryButtonStyle, "w-full justify-center py-3")}
                >
                  Sair
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigateAndClose("/login")}
                  className={cn(ghostButtonStyle, "w-full justify-center py-3")}
                >
                  Entrar
                </Button>
                <Button
                  variant="default"
                  onClick={() => navigateAndClose("/register")}
                  className={cn(
                    primaryButtonStyle,
                    "w-full justify-center py-3",
                  )}
                >
                  Criar conta
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
};
