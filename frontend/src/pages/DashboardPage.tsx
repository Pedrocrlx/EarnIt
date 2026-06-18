import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";

const DashboardPage = () => {
  const { familyProfile } = useAuth();
  const familyName = familyProfile?.family_name?.trim() || "Família";
  const children = familyProfile?.children ?? [];
  const activeChildren = children.filter((child) => child.is_active);

  return (
    <main className="min-h-screen bg-[#f8f9fb] px-4 py-6 text-[#191c1e] sm:px-6 lg:px-10">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_8px_20px_-16px_rgba(3,78,34,0.35)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase text-[#5f6800]">
              Painel parental
            </p>
            <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
              {familyName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#404940] sm:text-base">
              Reveja perfis, mantenha os controlos parentais protegidos e continue
              a partir do dispositivo da família.
            </p>
          </div>

          <Button
            asChild
            className="h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42]"
          >
            <Link to="/profile">
              Trocar perfil
              <ChevronRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#404940]">
                  Crianças ativas
                </p>
                <p className="mt-2 text-3xl font-bold text-[#003514]">
                  {activeChildren.length}
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-full bg-[#e6f0ff] text-[#1d4ed8]">
                <UsersRound className="size-5" aria-hidden="true" />
              </span>
            </div>
          </article>

          <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#404940]">
                  Estado da configuração
                </p>
                <p className="mt-2 text-lg font-bold text-[#003514]">
                  Concluída
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-full bg-[#eef7d1] text-[#5f6800]">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
            </div>
          </article>

          <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#404940]">
                  Área parental
                </p>
                <p className="mt-2 text-lg font-bold text-[#003514]">
                  Protegida por PIN
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-full bg-[#fff4de] text-[#9a5b00]">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-[#e1e2e4] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#003514]">
                  Perfis das crianças
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#404940]">
                  Perfis ligados a esta conta parental.
                </p>
              </div>
              <UsersRound className="size-5 text-[#404940]" aria-hidden="true" />
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {children.length > 0 ? (
                children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#003514] text-sm font-bold uppercase text-white">
                        {child.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#191c1e]">
                          {child.name}
                        </p>
                        <p className="mt-0.5 text-sm text-[#404940]">
                          {child.birth_date
                            ? `Nasc. ${child.birth_date}`
                            : "Data de nascimento não definida"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-[#404940]">
                      {child.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Ainda não existem perfis de crianças.
                </p>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#eef7d1] text-[#5f6800]">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold text-[#003514]">Controlos parentais</h2>
                  <p className="text-sm text-[#404940]">Prontos para acesso protegido.</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#e6f0ff] text-[#1d4ed8]">
                  <CalendarDays className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold text-[#003514]">Próxima sessão</h2>
                  <p className="text-sm text-[#404940]">Escolha um perfil para continuar.</p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
};

export default DashboardPage;
