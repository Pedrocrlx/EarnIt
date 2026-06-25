import { Check, Gift, LoaderCircle, Sparkles, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import { formatPoints } from "@/lib/points";
import {
  getSelectedProfileId,
  selectedProfileIsParent,
} from "@/lib/profile-selection";
import {
  approveGoal,
  listGoals,
  redeemGoal,
  rejectGoal,
  requestGoal,
} from "@/services/goalService";
import { getWallet } from "@/services/taskService";
import { getPointValue } from "@/services/profileService";
import type { Goal, GoalListResponse, WalletResponse } from "@/services/types";

const progressPercent = (balance: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0;

const childChip = (name: string) => (
  <span className="shrink-0 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-bold text-[#5f6800]">
    {name}
  </span>
);

const Movements = ({ wallet }: { wallet: WalletResponse | null }) => (
  <section className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
    <h2 className="text-lg font-bold text-[#003514]">Últimos movimentos</h2>
    <div className="mt-4 grid gap-2">
      {wallet && wallet.transactions.length > 0 ? (
        wallet.transactions.slice(0, 6).map((movement) => (
          <div
            key={movement.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-[#f8f9fb] px-4 py-3"
          >
            <span className="min-w-0 truncate text-sm text-[#404940]">
              {movement.description ?? "Movimento"}
            </span>
            <span
              className={`shrink-0 text-sm font-bold ${
                movement.transaction_type === "debit"
                  ? "text-[#7a4100]"
                  : "text-[#5f6800]"
              }`}
            >
              {movement.transaction_type === "debit" ? "−" : "+"}
              {formatPoints(movement.amount_points)}
            </span>
          </div>
        ))
      ) : (
        <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
          Ainda não existem movimentos.
        </p>
      )}
    </div>
  </section>
);

const pageMain = (children: React.ReactNode) => (
  <DashboardShell>
    <main className="min-h-screen bg-[#f8f9fb] px-4 py-6 text-[#191c1e] sm:px-6 lg:px-10">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">{children}</section>
    </main>
  </DashboardShell>
);

// ---------------------------------------------------------------------------
// Child view — make a wish, watch progress.
// ---------------------------------------------------------------------------

const ChildGoals = () => {
  const { familyProfile } = useAuth();
  const { showToast } = useToast();
  const selectedProfileId = getSelectedProfileId();
  const child = useMemo(
    () =>
      familyProfile?.children.find(
        (item) => item.id === selectedProfileId && item.is_active,
      ) ?? null,
    [familyProfile?.children, selectedProfileId],
  );

  const [data, setData] = useState<GoalListResponse | null>(null);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!child) {
      return;
    }
    try {
      const [goals, walletData] = await Promise.all([
        listGoals(child.id),
        getWallet(child.id),
      ]);
      setData(goals);
      setWallet(walletData);
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar os objetivos.",
        "error",
      );
    }
  }, [child, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const makeWish = async () => {
    const name = wish.trim();
    if (!name || !child) {
      return;
    }
    setBusy(true);
    try {
      await requestGoal(child.id, name);
      setWish("");
      await load();
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível enviar o pedido.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const balance = data?.balance_points ?? 0;
  // Rejected goals are hidden from the child.
  const visibleGoals = (data?.goals ?? []).filter((goal) => goal.status !== "rejected");

  return pageMain(
    <>
      <header className="rounded-2xl bg-[#003514] p-6 text-white shadow-[0px_14px_30px_-18px_rgba(3,78,34,0.6)]">
        <p className="text-sm font-semibold uppercase tracking-[0.06em] text-[#d4e251]">
          Os meus objetivos
        </p>
        <p className="mt-2 text-3xl font-bold">{formatPoints(balance)}</p>
        <p className="mt-1 text-sm text-white/80">
          Ganha pontos a fazer tarefas e troca-os pelos teus desejos.
        </p>
      </header>

      <section className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#003514]">
          <Sparkles className="size-5" aria-hidden="true" /> Fazer um pedido
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={wish}
            onChange={(event) => setWish(event.target.value)}
            maxLength={120}
            placeholder="O que desejas? (ex.: Ir ao parque)"
            disabled={busy}
            className="h-12 flex-1 rounded-xl border-[#e1e2e4] bg-[#f8f9fb] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
          />
          <Button
            type="button"
            onClick={makeWish}
            disabled={busy || !wish.trim()}
            className="h-12 rounded-full bg-[#d4e251] px-6 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Fazer pedido
          </Button>
        </div>
      </section>

      <section className="grid gap-3">
        {visibleGoals.length > 0 ? (
          visibleGoals.map((goal) => (
            <article
              key={goal.id}
              className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-[#003514]">{goal.name}</h3>
                {goal.status === "redeemed" ? (
                  <span className="shrink-0 rounded-full bg-[#eef7d1] px-3 py-1 text-xs font-bold text-[#5f6800]">
                    Conquistado 🎉
                  </span>
                ) : null}
              </div>

              {goal.status === "requested" ? (
                <p className="mt-2 text-sm font-semibold text-[#404940]">
                  À espera de aprovação…
                </p>
              ) : null}

              {goal.status === "approved" && goal.target_amount ? (
                <div className="mt-3">
                  <div className="h-3 overflow-hidden rounded-full bg-[#edeef0]">
                    <div
                      className="h-full rounded-full bg-[#d4e251] transition-[width]"
                      style={{ width: `${progressPercent(balance, goal.target_amount)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#003514]">
                    {formatPoints(Math.min(balance, goal.target_amount))} /{" "}
                    {formatPoints(goal.target_amount)}
                    {balance >= goal.target_amount ? (
                      <span className="ml-1 text-[#5f6800]">
                        · Já podes resgatar! Pede a um adulto 🎉
                      </span>
                    ) : (
                      <span className="ml-1 text-[#404940]">
                        · Faltam {formatPoints(goal.target_amount - balance)}
                      </span>
                    )}
                  </p>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-2xl bg-[#f3f4f6] px-4 py-8 text-center text-sm font-semibold text-[#404940]">
            Ainda não tens objetivos. Faz um pedido! ✨
          </p>
        )}
      </section>

      <Movements wallet={wallet} />
    </>,
  );
};

// ---------------------------------------------------------------------------
// Parent view — all children's goals, grouped by status; approve/reject/redeem.
// ---------------------------------------------------------------------------

type GoalWithChild = Goal & { childName: string; balance: number };

const ParentGoals = () => {
  const { familyProfile } = useAuth();
  const { showToast } = useToast();
  const children = useMemo(
    () => familyProfile?.children.filter((item) => item.is_active) ?? [],
    [familyProfile?.children],
  );

  const [entries, setEntries] = useState<
    { childName: string; balance: number; goals: Goal[] }[]
  >([]);
  const [pointValueEur, setPointValueEur] = useState(0.01);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);

  useEffect(() => {
    void getPointValue()
      .then(({ point_value_eur }) => setPointValueEur(Number(point_value_eur) || 0.01))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (children.length === 0) {
      setEntries([]);
      return;
    }
    try {
      const results = await Promise.all(
        children.map(async (child) => {
          const data = await listGoals(child.id);
          return {
            childName: child.name,
            balance: data.balance_points,
            goals: data.goals,
          };
        }),
      );
      setEntries(results);
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar os objetivos.",
        "error",
      );
    }
  }, [children, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const runGoalAction = async (goalId: string, action: () => Promise<unknown>) => {
    setBusyGoalId(goalId);
    try {
      await action();
      await load();
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar o objetivo.",
        "error",
      );
    } finally {
      setBusyGoalId(null);
    }
  };

  const approve = (goal: GoalWithChild) => {
    const euros = Number(targets[goal.id]);
    const points = pointValueEur > 0 ? Math.round((euros || 0) / pointValueEur) : 0;
    if (!points || points <= 0) {
      showToast("Indique um valor de objetivo maior que zero.", "error");
      return;
    }
    void runGoalAction(goal.id, () => approveGoal(goal.child_id, goal.id, points));
  };

  const flat: GoalWithChild[] = entries.flatMap((entry) =>
    entry.goals.map((goal) => ({
      ...goal,
      childName: entry.childName,
      balance: entry.balance,
    })),
  );
  const requested = flat.filter((goal) => goal.status === "requested");
  const approved = flat.filter((goal) => goal.status === "approved");
  const history = flat.filter(
    (goal) => goal.status === "redeemed" || goal.status === "rejected",
  );

  return pageMain(
    <>
      <header className="rounded-2xl border border-[#e1e2e4] bg-white p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase text-[#5f6800]">Objetivos</p>
        <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514]">
          Pedidos e recompensas de todas as crianças
        </h1>
      </header>

      {children.length === 0 ? (
        <p className="rounded-2xl bg-[#f3f4f6] px-4 py-8 text-center text-sm font-semibold text-[#404940]">
          Ainda não existem perfis de crianças.
        </p>
      ) : (
        <>

          <section className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#003514]">
              <Target className="size-5" aria-hidden="true" /> Pedidos pendentes
            </h2>
            <div className="mt-4 grid gap-3">
              {requested.length > 0 ? (
                requested.map((goal) => {
                  const euros = Number(targets[goal.id]) || 0;
                  const points =
                    pointValueEur > 0 ? Math.round(euros / pointValueEur) : 0;
                  return (
                    <div key={goal.id} className="rounded-xl bg-[#f8f9fb] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-[#003514]">{goal.name}</p>
                        {childChip(goal.childName)}
                      </div>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={`target-${goal.id}`}
                            className="text-xs font-semibold text-[#404940]"
                          >
                            Valor do objetivo (€)
                          </Label>
                          <Input
                            id={`target-${goal.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={targets[goal.id] ?? ""}
                            onChange={(event) =>
                              setTargets((current) => ({
                                ...current,
                                [goal.id]: event.target.value,
                              }))
                            }
                            disabled={busyGoalId === goal.id}
                            className="h-11 rounded-lg border-[#e1e2e4] bg-white"
                          />
                          {euros > 0 ? (
                            <p className="text-xs text-[#59625a]">
                              = {formatPoints(points)} a poupar
                            </p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => approve(goal)}
                            disabled={busyGoalId === goal.id}
                            className="h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                          >
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              runGoalAction(goal.id, () =>
                                rejectGoal(goal.child_id, goal.id),
                              )
                            }
                            disabled={busyGoalId === goal.id}
                            className="h-11 rounded-full bg-[#f3f4f6] px-5 text-sm font-semibold text-[#7a4100] hover:bg-[#fff4de]"
                          >
                            Recusar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Sem pedidos pendentes.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#003514]">
              <Gift className="size-5" aria-hidden="true" /> Objetivos aprovados
            </h2>
            <div className="mt-4 grid gap-3">
              {approved.length > 0 ? (
                approved.map((goal) => {
                  const target = goal.target_amount ?? 0;
                  const canRedeem = goal.balance >= target;
                  return (
                    <div key={goal.id} className="rounded-xl bg-[#f8f9fb] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate font-bold text-[#003514]">
                            {goal.name}
                          </p>
                          {childChip(goal.childName)}
                        </div>
                        <Button
                          type="button"
                          onClick={() =>
                            runGoalAction(goal.id, () =>
                              redeemGoal(goal.child_id, goal.id),
                            )
                          }
                          disabled={busyGoalId === goal.id || !canRedeem}
                          className="h-10 shrink-0 rounded-full bg-[#003514] px-5 text-sm font-semibold text-[#d4e251] hover:bg-[#024d22] disabled:opacity-40"
                        >
                          {busyGoalId === goal.id ? (
                            <LoaderCircle
                              className="mr-2 size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : null}
                          Resgatar
                        </Button>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edeef0]">
                        <div
                          className="h-full rounded-full bg-[#d4e251]"
                          style={{ width: `${progressPercent(goal.balance, target)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#404940]">
                        {formatPoints(Math.min(goal.balance, target))} /{" "}
                        {formatPoints(target)}
                        {!canRedeem ? (
                          <span> · Faltam {formatPoints(target - goal.balance)}</span>
                        ) : null}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Nenhum objetivo aprovado.
                </p>
              )}
            </div>
          </section>

          {history.length > 0 ? (
            <section className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
              <h2 className="text-lg font-bold text-[#003514]">Histórico</h2>
              <div className="mt-4 grid gap-2">
                {history.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#f8f9fb] px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-sm text-[#404940]">
                        {goal.name}
                      </span>
                      {childChip(goal.childName)}
                    </div>
                    <span
                      className={`flex shrink-0 items-center gap-1 text-xs font-bold ${
                        goal.status === "redeemed" ? "text-[#5f6800]" : "text-[#7a4100]"
                      }`}
                    >
                      {goal.status === "redeemed" ? (
                        <>
                          <Check className="size-3.5" aria-hidden="true" /> Resgatado
                        </>
                      ) : (
                        "Recusado"
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>,
  );
};

const GoalsPage = () => (selectedProfileIsParent() ? <ParentGoals /> : <ChildGoals />);

export default GoalsPage;
