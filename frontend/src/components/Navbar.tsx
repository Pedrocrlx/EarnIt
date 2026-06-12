import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { cn } from "@/lib/utils";

const navigationItems = [
  { name: "Features", path: "/#features" },
  { name: "How it Works", path: "/#how-it-works" },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === "/login";
  const isRegisterPage = location.pathname === "/register";

  const primaryButtonStyle = "h-auto rounded-full bg-[#deec5a] px-6 py-3 shadow-[0px_4px_0px_#5b630080] hover:bg-[#d7e652] text-sm font-bold leading-5 text-[#1a1d00]";
  const ghostButtonStyle = "h-auto px-6 py-3 shadow-none hover:bg-transparent text-sm font-semibold leading-5 text-[#003514] hover:text-[#003514]";

  return (
    <header className="w-full border-b border-black/5 bg-white shadow-[0px_1px_2px_#0000000d]">
      <div className="flex items-center justify-between">
        <Link to="/">
          <Logo/>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-16 md:flex">
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
        <div className="flex items-center gap-4 sm:gap-6">
          <Button
            variant={isRegisterPage ? "default" : "ghost"}
            onClick={() => navigate("/login")}
            className={cn(isRegisterPage ? primaryButtonStyle : ghostButtonStyle)}
          >
            Log In
          </Button>
          <Button
            variant={isLoginPage || (!isRegisterPage && !isLoginPage) ? "default" : "ghost"}
            onClick={() => navigate("/register")}
            className={cn(isLoginPage || (!isRegisterPage && !isLoginPage) ? primaryButtonStyle : ghostButtonStyle)}
          >
            Sign Up
          </Button>
        </div>
      </div>
    </header>
  );
};
