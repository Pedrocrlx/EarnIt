import logoBlack from "@/assets/earnit_icon_black.webp";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
};

export const Logo = ({ className }: LogoProps) => {
  return (
    <img
      src={logoBlack}
      alt="Logótipo EarnIt"
      width={4001}
      height={2251}
      className={cn("h-36 w-auto object-contain", className)}
    />
  );
};

export default Logo;
