import { LockKeyhole, Mail, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Logo from "@/components/Logo";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/context/useAuth";

type LoginCredentials = {
  email: string;
  password: string;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const loginMutation = useMutation({
    mutationFn: (data: LoginCredentials) => apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: async () => {
      const profile = await login();
      navigate(profile?.onboarding_completed ? "/profile" : "/onboarding/step1", {
        replace: true,
      });
    },
    onError: (error: unknown) => {
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        typeof error.data === "object" &&
        error.data !== null &&
        "detail" in error.data &&
        typeof error.data.detail === "object" &&
        error.data.detail !== null &&
        "error" in error.data.detail &&
        error.data.detail.error === "account_unverified"
      ) {
        navigate("/verification", { replace: true });
        return;
      }

      setFormError(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    loginMutation.mutate({ email, password });
  };

  return (
    <main className="bg-[#f8f9fb]">
      <section className="flex justify-center pb-10 pt-5 px-4 sm:px-6">
        <div className="flex w-full max-w-[620px] flex-col items-center gap-10">
          <header className="flex flex-col items-center">
            <Logo />
            <p className="mt-2 text-center  text-lg font-normal leading-[26px] text-[#404940]">
              Welcome Back! Ready to see progress?
            </p>
          </header>
          <Card className="w-full rounded-xl border-0 bg-white shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226]">
            <CardContent className="px-6 pb-9 pt-9 sm:px-10 sm:pb-8 sm:pt-10">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm font-semibold leading-5 text-[#191c1e]">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404940]" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-[51px] rounded-lg border-2 border-[#e1e2e4] bg-[#f8f9fb] pl-10 pr-3 text-base font-normal leading-normal text-[#6b7280]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password" className="text-sm font-semibold leading-5 text-[#191c1e]">Password</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404940]" />
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-[51px] rounded-lg border-2 border-[#e1e2e4] bg-[#f8f9fb] pl-10 pr-10 text-base font-normal leading-normal text-[#6b7280]" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#404940]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {formError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-auto w-full rounded-lg bg-[#dbe957] px-4 py-[18px] shadow-[0px_8px_10px_-6px_#034e221a,0px_10px_25px_-5px_#034e2226] hover:bg-[#d2e24f] text-sm font-semibold tracking-[0.70px] text-[#5f6800]"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "SIGNING IN..." : "SIGN IN"}
                </Button>
                <div className="space-y-2 pt-3">
                  <Separator className="bg-[#e1e2e4]" />
                  <div className="flex items-center justify-center gap-1 pt-0.5 text-center">
                    <span className=" text-base font-normal leading-6 text-[#404940]">
                      Don&apos;t have an account?
                    </span>
                    <Button
                      variant="link"
                      onClick={() => navigate("/register")}
                      className="h-auto p-0 text-sm font-semibold leading-5 text-[#003514] no-underline hover:no-underline"
                    >
                      Create an account
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

export default LoginPage;
