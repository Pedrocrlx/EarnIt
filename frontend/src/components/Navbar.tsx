import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/useAuth";

const navigationItems = [
  { name: "Features", path: "/#features" },
  { name: "How it Works", path: "/#how-it-works" },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  const isLoginPage = location.pathname === "/login";
  const isRegisterPage = location.pathname === "/register";
  const isVerificationPage = location.pathname === "/verification";
  const isOnboardingPage = location.pathname.startsWith("/onboarding");
  const isProfileSelectorPage = location.pathname === "/profile";

  if (
    isLoginPage ||
    isRegisterPage ||
    isVerificationPage ||
    isOnboardingPage ||
    isProfileSelectorPage
  ) {
    return null;
  }

  const primaryButtonStyle = "h-auto rounded-full bg-[#deec5a] px-4 py-2 text-xs font-bold leading-5 text-[#1a1d00] shadow-[0px_4px_0px_#5b630080] hover:bg-[#d7e652] sm:text-sm";
  const ghostButtonStyle = "h-auto px-4 py-2 text-xs font-semibold leading-5 text-[#003514] shadow-none hover:bg-transparent hover:text-[#003514] sm:text-sm";

  return (
    <header className="w-full border-b border-black/5 bg-white shadow-[0px_1px_2px_#0000000d]">
      <div className="flex items-center justify-between px-5 py-2 sm:px-8 lg:px-16">
        <Link to="/">
          <Logo className="h-12 w-auto sm:h-14" />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-10 md:flex lg:gap-16">
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
        <div className="flex items-center gap-2 sm:gap-4">
          {isAuthenticated ? (
            <Button
              variant="default"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              className={cn(primaryButtonStyle)}
            >
              Logout
            </Button>
          ) : (
            <>
              <Button
                variant={isRegisterPage ? "default" : "ghost"}
                onClick={() => navigate("/login")}
                className={cn(isRegisterPage ? primaryButtonStyle : ghostButtonStyle)}
              >
                Sign In
              </Button>
              <Button
                variant={isLoginPage || (!isRegisterPage && !isLoginPage) ? "default" : "ghost"}
                onClick={() => navigate("/register")}
                className={cn(isLoginPage || (!isRegisterPage && !isLoginPage) ? primaryButtonStyle : ghostButtonStyle)}
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
