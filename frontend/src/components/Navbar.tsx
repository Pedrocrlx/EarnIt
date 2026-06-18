import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { cn } from "@/lib/utils";
import Logo from "./Logo";

const navigationItems = [
  { name: "Features", path: "/#features" },
  { name: "How it Works", path: "/#how-it-works" },
];

const hiddenNavbarPaths = ["/login", "/register", "/verification", "/profile"];

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
          aria-label="Primary"
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
            <Button
              variant="default"
              onClick={logoutAndClose}
              className={cn(primaryButtonStyle)}
            >
              Logout
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate("/login")}
                className={cn(ghostButtonStyle)}
              >
                Sign In
              </Button>
              <Button
                variant="default"
                onClick={() => navigate("/register")}
                className={cn(primaryButtonStyle)}
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMenuIsOpen((isOpen) => !isOpen)}
          className="flex size-10 items-center justify-center rounded-full border border-[#e1e2e4] text-[#003514] transition-colors hover:bg-[#f3f4f6] md:hidden"
          aria-label={
            menuIsOpen ? "Close navigation menu" : "Open navigation menu"
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
          <nav aria-label="Mobile primary" className="flex flex-col gap-1">
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
              <Button
                variant="default"
                onClick={logoutAndClose}
                className={cn(primaryButtonStyle, "w-full justify-center py-3")}
              >
                Logout
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigateAndClose("/login")}
                  className={cn(ghostButtonStyle, "w-full justify-center py-3")}
                >
                  Sign In
                </Button>
                <Button
                  variant="default"
                  onClick={() => navigateAndClose("/register")}
                  className={cn(
                    primaryButtonStyle,
                    "w-full justify-center py-3",
                  )}
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
};
