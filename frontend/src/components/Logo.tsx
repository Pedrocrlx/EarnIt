import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
};

export const Logo = ({ className }: LogoProps) => {
  return (
    <img
      src="/earnit_icon_black.webp"
      alt="Logótipo EarnIt"
      className={cn("h-36 w-auto object-contain", className)}
    />
  );
};

export default Logo;
