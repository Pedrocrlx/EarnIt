import type { ReactNode } from "react";

import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";

type AuthFormLayoutProps = {
  children: ReactNode;
  subtitle: string;
};

export const AuthFormLayout = ({ children, subtitle }: AuthFormLayoutProps) => (
  <main className="bg-[#f8f9fb]">
    <section className="flex justify-center px-4 pb-10 pt-5 sm:px-6">
      <div className="flex w-full max-w-[620px] flex-col items-center gap-10">
        <header className="flex flex-col items-center">
          <Logo />
          <p className="mt-2 text-center text-lg font-normal leading-[26px] text-[#404940]">
            {subtitle}
          </p>
        </header>

        <Card className="w-full rounded-xl border-0 bg-white shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226]">
          <CardContent className="px-6 pb-9 pt-9 sm:px-10 sm:pb-8 sm:pt-10">
            {children}
          </CardContent>
        </Card>
      </div>
    </section>
  </main>
);
