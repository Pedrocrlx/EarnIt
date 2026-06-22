import {
  ChevronRight,
  LoaderCircle,
  Save,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import { DEFAULT_POINTS_PER_EURO, eurosToPoints, formatPoints } from "@/lib/points";
import { selectedProfileIsParent } from "@/lib/profile-selection";
import ChildDashboard from "@/pages/ChildDashboard";
import { updateChildGoal } from "@/services/profileService";
import { getSettings } from "@/services/settingsService";

const DashboardPage = () => {
  const { familyProfile, refreshSession } = useAuth();
  const [editingGoalChildId, setEditingGoalChildId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalRewardAmount, setGoalRewardAmount] = useState("");
  const [pointsPerEuro, setPointsPerEuro] = useState(DEFAULT_POINTS_PER_EURO);
  const [busyChildId, setBusyChildId] = useState<string | null>(null);
  const [goalError, setGoalError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const settings = await getSettings();
        if (isMounted) {
          setPointsPerEuro(settings.points_per_euro);
        }
      } catch {
        if (isMounted) {
          setPointsPerEuro(DEFAULT_POINTS_PER_EURO);
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!selectedProfileIsParent()) {
    return <ChildDashboard />;
  }

  const familyName = familyProfile?.family_name?.trim() || "Família";
  const children = familyProfile?.children ?? [];

  const startEditGoal = (child: (typeof children)[number]) => {
    setEditingGoalChildId(child.id);
    setGoalTitle(child.goal_title ?? "");
    setGoalDescription(child.goal_description ?? "");
    setGoalRewardAmount(child.reward_amount ?? "");
    setGoalError("");
  };

  const saveGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingGoalChildId) {
      return;
    }

    if (goalRewardAmount && Number(goalRewardAmount) < 0) {
      setGoalError("O valor da recompensa não pode ser negativo.");
      return;
    }

    setBusyChildId(editingGoalChildId);
    setGoalError("");

    try {
      await updateChildGoal(editingGoalChildId, {
        goal_title: goalTitle.trim() || null,
        goal_description: goalDescription.trim() || null,
        reward_amount: goalRewardAmount ? Number(goalRewardAmount).toFixed(2) : null,
      });
      setEditingGoalChildId(null);
      await refreshSession();
    } catch (caughtError) {
      setGoalError(
        caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o objetivo.",
      );
    } finally {
      setBusyChildId(null);
    }
  };

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
              {goalError ? (
                <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {goalError}
                </p>
              ) : null}
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
                    {editingGoalChildId === child.id ? (
                      <form onSubmit={saveGoal} className="grid w-full max-w-sm gap-3">
                        <div className="space-y-1">
                          <Label htmlFor={`goal-title-${child.id}`} className="text-[#404940]">
                            Objetivo
                          </Label>
                          <Input
                            id={`goal-title-${child.id}`}
                            value={goalTitle}
                            onChange={(event) => setGoalTitle(event.target.value)}
                            disabled={busyChildId === child.id}
                            className="h-10 rounded-lg border-[#e1e2e4] bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`goal-description-${child.id}`} className="text-[#404940]">
                            Descrição (opcional)
                          </Label>
                          <Input
                            id={`goal-description-${child.id}`}
                            value={goalDescription}
                            onChange={(event) => setGoalDescription(event.target.value)}
                            disabled={busyChildId === child.id}
                            className="h-10 rounded-lg border-[#e1e2e4] bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`goal-reward-${child.id}`} className="text-[#404940]">
                            Valor da recompensa
                          </Label>
                          <Input
                            id={`goal-reward-${child.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={goalRewardAmount}
                            onChange={(event) => setGoalRewardAmount(event.target.value)}
                            disabled={busyChildId === child.id}
                            className="h-10 rounded-lg border-[#e1e2e4] bg-white"
                          />
                          <p className="text-xs font-semibold text-[#59625a]">
                            {formatPoints(eurosToPoints(goalRewardAmount || "0", pointsPerEuro))}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={busyChildId === child.id} className="h-9 rounded-full bg-[#d4e251] px-4 text-xs font-semibold text-[#003514] hover:bg-[#cfdc42]">
                            {busyChildId === child.id ? <LoaderCircle className="mr-2 size-3.5 animate-spin" aria-hidden="true" /> : <Save className="mr-2 size-3.5" aria-hidden="true" />}
                            Guardar
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setEditingGoalChildId(null)} disabled={busyChildId === child.id} className="h-9 rounded-full px-4 text-xs font-semibold text-[#404940]">
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-[#404940]">
                          {child.is_active ? "Ativo" : "Inativo"}
                        </span>
                        <div className="text-right text-sm text-[#404940]">
                          <p className="font-semibold text-[#191c1e]">
                            {child.goal_title ?? "Sem objetivo definido"}
                          </p>
                          {child.reward_amount ? (
                            <p>
                              {Number(child.reward_amount).toFixed(2)} € · {formatPoints(eurosToPoints(child.reward_amount, pointsPerEuro))}
                            </p>
                          ) : null}
                        </div>
                        <Button type="button" variant="ghost" onClick={() => startEditGoal(child)} className="h-9 rounded-full px-3 text-xs font-semibold text-[#003514] hover:bg-[#f3f4f6]">
                          Editar objetivo
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Ainda não existem perfis de crianças.
                </p>
              )}
            </div>
          </div>
        </section>
      </section>
      </main>
    </DashboardShell>
  );
};

export default DashboardPage;
