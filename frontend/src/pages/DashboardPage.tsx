import { ChevronRight, Target, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { selectedProfileIsParent } from "@/lib/profile-selection";
import ChildDashboard from "@/pages/ChildDashboard";

const DashboardPage = () => {
  const { familyProfile } = useAuth();

  if (!selectedProfileIsParent()) {
    return <ChildDashboard />;
  }

  const familyName = familyProfile?.family_name?.trim() || "Família";
  const children = familyProfile?.children ?? [];

  return (
    <DashboardShell>
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
                Reveja perfis, gira tarefas e objetivos, e mantenha os controlos
                parentais protegidos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="ghost"
                className="h-11 rounded-full bg-[#f3f4f6] px-5 text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
              >
                <Link to="/dashboard/goals">
                  <Target className="mr-2 size-4" aria-hidden="true" />
                  Objetivos
                </Link>
              </Button>
              <Button
                asChild
                className="h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42]"
              >
                <Link to="/profile">
                  Trocar perfil
                  <ChevronRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </header>

          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 sm:p-6">
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
          </section>
        </section>
      </main>
    </DashboardShell>
  );
};

export default DashboardPage;
