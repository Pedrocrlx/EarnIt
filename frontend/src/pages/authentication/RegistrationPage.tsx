import { LockKeyhole, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Logo from "@/components/Logo";

const formFields = [
  {
    id: "email",
    label: "Email address",
    type: "email",
    icon: Mail,
  },
  {
    id: "password",
    label: "Password",
    type: "password",
    icon: LockKeyhole,
  },
  {
    id: "Confirm Password ",
    label: "Confirm Password",
    type: "password",
    icon: LockKeyhole,
  },
];

const RegistrationPage = () => {
  const navigate = useNavigate();

  return (
    <main className="bg-[#f8f9fb]">
      <section className="flex justify-center pb-10 pt-5 px-4 sm:px-6">
        <div className="flex w-full max-w-[620px] flex-col items-center gap-10">
          <header className="flex flex-col items-center">
            <Logo />
            <p className="mt-2 text-center  text-lg font-normal leading-[26px] text-[#404940]">
              Create your account. Join the crew!
            </p>
          </header>
          <Card className="w-full rounded-xl border-0 bg-white shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226]">
            <CardContent className="px-6 pb-9 pt-9 sm:px-10 sm:pb-8 sm:pt-10">
              <form className="space-y-6">
                {formFields.map((field) => {
                  const Icon = field.icon;

                  return (
                    <div key={field.id} className="space-y-1">
                      <Label
                        htmlFor={field.id}
                        className=" text-sm font-semibold leading-5 text-[#191c1e]"
                      >
                        {field.label}
                      </Label>
                      <div className="relative">
                        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404940]" />
                        <Input
                          id={field.id}
                          type={field.type}
                          defaultValue={field.defaultValue}
                          className="h-[51px] rounded-lg border-2 border-[#e1e2e4] bg-[#f8f9fb] pl-10 pr-3  text-base font-normal leading-normal text-[#6b7280] placeholder:text-[#6b7280] focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="submit"
                  className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f]  text-sm font-semibold tracking-[0.70px] text-[#5f6800]"
                >
                  CREATE ACCOUNT
                </Button>
                <div className="space-y-2 pt-3">
                  <Separator className="bg-[#e1e2e4]" />
                  <div className="flex items-center justify-center gap-1 pt-0.5 text-center">
                    <span className=" text-base font-normal leading-6 text-[#404940]">
                      Already have an account?
                    </span>
                    <Button
                      variant="link"
                      onClick={() => navigate("/login")}
                      className="h-auto p-0  text-sm font-semibold leading-5 text-[#003514] no-underline hover:no-underline"
                    >
                      Log In
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default RegistrationPage;
