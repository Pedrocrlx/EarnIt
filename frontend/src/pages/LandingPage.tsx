import { 
  ClipboardList, 
  TrendingUp, 
  Gift, 
  CheckCircle2, 
  Coins, 
  ArrowRight,
  Shield,
  MessageCircle,
  HelpCircle,
  FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

const howItWorksSteps = [
  {
    title: "Assign Chores",
    description: "Parents set tasks, point values, and deadlines in seconds.",
    icon: ClipboardList,
    iconColor: "text-white",
    iconBg: "bg-[#034e22]",
  },
  {
    title: "Kids Earn",
    description: "Kids complete tasks, checking them off to earn points and level up.",
    icon: TrendingUp,
    iconColor: "text-[#1a1d00]",
    iconBg: "bg-[#deec5a]",
    highlight: true,
  },
  {
    title: "Redeem Rewards",
    description: "Points translate to real-world rewards, screen time, or allowance.",
    icon: Gift,
    iconColor: "text-white",
    iconBg: "bg-[#034e22]",
  },
];

const footerLinks = [
  { name: "Privacy Policy", icon: Shield },
  { name: "Terms of Service", icon: FileText },
  { name: "Contact Us", icon: MessageCircle },
  { name: "Help Center", icon: HelpCircle },
];

export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col w-full overflow-x-hidden">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-white px-4 py-10 sm:px-6 lg:px-20 lg:py-16">
          <div className="container mx-auto grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6 max-w-lg">
              <h1 className="font-montserrat text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-[#003514]">
                Turn Chores into <br />
                <span className="text-[#c2cf40]">Achievements.</span>
              </h1>
              <p className="text-[#404940] text-sm sm:text-base leading-relaxed max-w-md">
                Make responsibility fun. Earnit helps parents organize tasks
                while rewarding kids for building great habits through a
                playful, gamified experience.
              </p>
              <Button 
                onClick={() => navigate("/register")}
                className="h-auto rounded-full bg-[#deec5a] px-6 py-3 shadow-[0px_4px_0px_#5b630080] hover:bg-[#d7e652] text-base font-bold text-[#1a1d00] transition-all hover:scale-105"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            <div className="relative max-w-sm lg:max-w-none mx-auto lg:mx-0">
              <div className="bg-[#034e22] rounded-[24px] aspect-square overflow-hidden border-4 border-white shadow-xl relative">
                {/* Decorative Elements */}
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,53,20,0.4)_0%,transparent_100%)] z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1502086223501-7ea244b05ffb?auto=format&fit=crop&q=80&w=800" 
                  alt="Family happy"
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
                
                {/* Floating Badge 1 */}
                <div className="absolute -top-3 -left-3 bg-white p-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-bounce-slow rotate-[-6deg] z-20">
                  <div className="bg-[#deec5a]/20 p-1 rounded-md">
                    <Coins className="w-4 h-4 text-[#003514]" />
                  </div>
                  <span className="font-bold text-[#003514] text-sm">+50 Points!</span>
                </div>

                {/* Floating Badge 2 */}
                <div className="absolute -bottom-2 -right-2 bg-white p-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-float rotate-[3deg] z-20">
                  <div className="bg-[#034e22]/10 p-1 rounded-md">
                    <CheckCircle2 className="w-4 h-4 text-[#034e22]" />
                  </div>
                  <span className="font-bold text-[#003514] text-sm">Room Cleaned</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-20">
          <div className="container mx-auto space-y-10">
            <div className="text-center space-y-2">
              <h2 className="font-montserrat text-2xl sm:text-3xl font-bold text-[#003514]">
                How it Works
              </h2>
              <p className="text-[#404940] text-sm max-w-lg mx-auto">
                Three simple steps to building better habits.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {howItWorksSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article 
                    key={step.title}
                    className="bg-white p-6 rounded-[24px] shadow-[0px_8px_24px_#034e2214] flex flex-col items-center text-center space-y-4 transition-transform hover:-translate-y-1"
                  >
                    <div className={`${step.iconBg} w-14 h-14 rounded-full flex items-center justify-center shadow-sm relative`}>
                      {step.highlight && (
                        <div className="absolute inset-0 rounded-full animate-ping bg-[#deec5a] opacity-20" />
                      )}
                      <Icon className={`w-7 h-7 ${step.iconColor}`} />
                    </div>
                    <h3 className="font-montserrat text-lg font-bold text-[#003514]">
                      {step.title}
                    </h3>
                    <p className="text-[#404940] text-xs sm:text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-12 sm:px-6 lg:px-20">
          <div className="container mx-auto">
            <div className="bg-[#034e22] rounded-[24px] p-8 lg:p-12 relative overflow-hidden text-center space-y-6 shadow-xl">
              {/* Abstract backgrounds */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#003514] rounded-full blur-[64px] opacity-50" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#deec5a] rounded-full blur-[64px] opacity-10" />
              
              <div className="relative z-10 space-y-4">
                <h2 className="font-montserrat text-2xl sm:text-4xl font-bold text-white leading-tight">
                  Join the Family
                </h2>
                <p className="text-[#92d69c] text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                  Start making chores less of a chore. Sign up today and get your first
                  month free and join thousands of happy families.
                </p>
                <Button 
                  onClick={() => navigate("/register")}
                  className="h-auto rounded-full bg-[#deec5a] px-8 py-3 shadow-[0px_4px_0px_#5b630080] hover:bg-[#d7e652] text-base font-bold text-[#1a1d00] transition-all hover:scale-105"
                >
                  Start Earning
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-black/5 py-6 px-4 sm:px-6 lg:px-20">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center lg:items-start gap-2">
              <Logo />
              <p className="text-[#404940] font-semibold text-[10px] sm:text-xs">
                © 2026 Earnit Family. All rights reserved.
              </p>
            </div>
            
            <nav className="flex flex-wrap justify-center gap-5">
              {footerLinks.map((link) => (
                <a 
                  key={link.name}
                  href="#" 
                  className="flex items-center gap-1.5 text-[#404940] hover:text-[#003514] font-semibold text-[10px] sm:text-xs transition-colors"
                >
                  <link.icon className="w-3 h-3 sm:w-3.5 h-3.5" />
                  {link.name}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
