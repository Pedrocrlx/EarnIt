import { ArrowLeftIcon, HomeIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1f5e6] to-[#f8f9fb] px-5 py-12 text-[#191c1e]">
    <section className="flex w-full max-w-2xl flex-col items-center rounded-[32px] border border-[#e1e2e4] bg-white px-6 py-10 text-center shadow-[0px_16px_50px_-24px_rgba(3,78,34,0.28)] sm:px-10">
      <Logo className="h-11" />

      <div className="mt-8 flex items-end justify-center gap-3">
        <img
          src="/mascot/avocado.webp"
          alt="Mascote abacate EarnIt"
          className="h-32 w-auto object-contain sm:h-40"
        />
        <img
          src="/mascot/kiwi.webp"
          alt="Mascote kiwi EarnIt"
          className="h-24 w-auto object-contain sm:h-32"
        />
      </div>

      <p className="mt-7 text-sm font-bold uppercase tracking-[0.14em] text-[#5f6800]">
        Erro 404
      </p>
      <h1 className="mt-2 font-montserrat text-3xl font-bold text-[#003514] sm:text-4xl">
        Esta página não existe
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#404940] sm:text-base">
        Parece que este caminho ficou por cumprir. Volte ao início para continuar
        a acompanhar as tarefas e objetivos da família.
      </p>

      <div className="mt-7 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <Button
          asChild
          variant="ghost"
          className="h-12 flex-1 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed]"
        >
          <Link to="/profile">
            <ArrowLeftIcon className="mr-2 size-4" aria-hidden="true" />
            Escolher perfil
          </Link>
        </Button>
        <Button
          asChild
          className="h-12 flex-1 rounded-full bg-[#d4e251] text-sm font-semibold text-[#003514] hover:bg-[#cfdc42]"
        >
          <Link to="/">
            <HomeIcon className="mr-2 size-4" aria-hidden="true" />
            Página inicial
          </Link>
        </Button>
      </div>
    </section>
  </main>
);

export default NotFoundPage;
