import {
  CheckCircledIcon,
  CheckIcon,
  MagicWandIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import ChildShell from "@/components/ChildShell";
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
import { getPointValue } from "@/services/profileService";
import type { Goal, GoalListResponse } from "@/services/types";

const progressPercent = (balance: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0;

// Faint vertical gridlines every 10% so progress reads granularly over the bar.
const progressGrid = {
  backgroundImage:
    "repeating-linear-gradient(90deg, transparent 0, transparent calc(10% - 1px), rgba(0,53,20,0.14) calc(10% - 1px), rgba(0,53,20,0.14) 10%)",
};

const childChip = (name: string) => (
  <span className="shrink-0 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-bold text-[#5f6800]">
    {name}
  </span>
);

const segmentClass = (active: boolean) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
    active ? "bg-[#003514] text-white" : "text-[#404940] hover:text-[#003514]"
  }`;

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
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!child) {
      return;
    }
    try {
      setData(await listGoals(child.id));
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
  // Rejected and already-conquered (redeemed) goals are hidden from the child —
  // only what they're still working towards stays on the list.
  const visibleGoals = (data?.goals ?? []).filter(
    (goal) => goal.status === "requested" || goal.status === "approved",
  );

  return (
    <ChildShell points={balance} loading={data === null}>
      <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-montserrat text-xl font-bold text-[#003514]">
          Os meus objetivos
        </h1>
        <p className="mt-1 text-sm text-[#404940]">
          Ganha pontos a fazer tarefas e troca-os pelos teus desejos.
        </p>
      </div>

      <section className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#003514]">
          <MagicWandIcon className="size-5" aria-hidden="true" /> Fazer um pedido
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
              <UpdateIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Fazer pedido
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e1e2e4] bg-white shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
        {visibleGoals.length > 0 ? (
          <div className="divide-y divide-[#e1e2e4]">
            {visibleGoals.map((goal) => {
              const target = goal.target_amount ?? 0;
              const pending = goal.status !== "approved" || target <= 0;
              const percent = progressPercent(balance, target);
              const ready = !pending && balance >= target;
              return (
                <div key={goal.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <p className="truncate font-bold text-[#003514]">{goal.name}</p>
                      {!pending ? (
                        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-[#7a8278]">
                          {formatPoints(Math.min(balance, target))} pts / {formatPoints(target)} pts
                        </span>
                      ) : null}
                    </div>
                    {ready ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-bold text-[#5f6800]">
                        <CheckCircledIcon
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        Pronto!
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    {pending ? (
                      <div className="h-5 flex-1 rounded-full border-2 border-dashed border-[#cbd5cd] bg-[#f7f8f6]" />
                    ) : (
                      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-[#edeef0]">
                        <div
                          className="absolute inset-y-0 left-0 bg-[#d4e251] transition-[width]"
                          style={{ width: `${percent}%` }}
                        />
                        <div className="absolute inset-0" style={progressGrid} />
                      </div>
                    )}
                    <span
                      className={`shrink-0 text-right text-sm font-bold ${
                        pending ? "w-20 text-[#7a8278]" : "w-12 text-[#003514]"
                      }`}
                    >
                      {pending ? "À espera" : `${percent}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm font-semibold text-[#404940]">
            <MagicWandIcon
              className="size-5 text-[#5f6800]"
              aria-hidden="true"
            />
            <p>Ainda não tens objetivos. Faz um pedido!</p>
          </div>
        )}
      </section>
      </div>
    </ChildShell>
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
  const [loading, setLoading] = useState(true);
  const [goalView, setGoalView] = useState<"pending" | "approved" | "history">(
    "pending",
  );

  useEffect(() => {
    void getPointValue()
      .then(({ point_value_eur }) => setPointValueEur(Number(point_value_eur) || 0.01))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (children.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
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
    } finally {
      setLoading(false);
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

  const emptyMessage =
    goalView === "pending"
      ? "Sem pedidos pendentes."
      : goalView === "approved"
        ? "Nenhum objetivo aprovado."
        : "Sem histórico de objetivos.";

  const renderPending = (goal: GoalWithChild) => {
    const euros = Number(targets[goal.id]) || 0;
    const points = pointValueEur > 0 ? Math.round(euros / pointValueEur) : 0;
    return (
      <article key={goal.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-[#191c1e]">{goal.name}</h3>
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
                runGoalAction(goal.id, () => rejectGoal(goal.child_id, goal.id))
              }
              disabled={busyGoalId === goal.id}
              className="h-11 rounded-full bg-[#f3f4f6] px-5 text-sm font-semibold text-[#7a4100] hover:bg-[#fff4de]"
            >
              Recusar
            </Button>
          </div>
        </div>
      </article>
    );
  };

  const renderApproved = (goal: GoalWithChild) => {
    const target = goal.target_amount ?? 0;
    const canRedeem = goal.balance >= target;
    return (
      <article key={goal.id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-semibold text-[#191c1e]">{goal.name}</h3>
            {childChip(goal.childName)}
          </div>
          <Button
            type="button"
            onClick={() =>
              runGoalAction(goal.id, () => redeemGoal(goal.child_id, goal.id))
            }
            disabled={busyGoalId === goal.id || !canRedeem}
            className="h-10 shrink-0 rounded-full bg-[#003514] px-5 text-sm font-semibold text-[#d4e251] hover:bg-[#024d22] disabled:opacity-40"
          >
            {busyGoalId === goal.id ? (
              <UpdateIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
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
          {formatPoints(Math.min(goal.balance, target))} / {formatPoints(target)}
          {!canRedeem ? (
            <span> · Faltam {formatPoints(target - goal.balance)}</span>
          ) : null}
        </p>
      </article>
    );
  };

  const renderHistory = (goal: GoalWithChild) => (
    <article
      key={goal.id}
      className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-[#191c1e]">
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
            <CheckIcon className="size-3.5" aria-hidden="true" /> Resgatado
          </>
        ) : (
          "Recusado"
        )}
      </span>
    </article>
  );

  const visibleGoals =
    goalView === "pending"
      ? requested
      : goalView === "approved"
        ? approved
        : history;

  return (
    <DashboardShell>
      <main className="flex min-h-screen w-full flex-col items-center gap-10 bg-[#f8f9fb] p-0 text-[#191c1e] lg:min-h-[1024px] lg:w-[1024px] lg:grow">
        <section className="flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
          <header>
            <div>
              <p className="text-sm font-semibold uppercase text-[#5f6800]">
                Gestão familiar
              </p>
              <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
                Objetivos
              </h1>
            </div>
          </header>

          {children.length === 0 ? (
            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
              <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                Ainda não existem perfis de crianças.
              </p>
            </section>
          ) : (
            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-[#003514]">
                  Objetivos das crianças
                </h2>
                <div className="inline-flex rounded-full border border-[#e1e2e4] bg-[#f8f9fb] p-1">
                  <button
                    type="button"
                    onClick={() => setGoalView("pending")}
                    className={segmentClass(goalView === "pending")}
                  >
                    Pendentes ({requested.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalView("approved")}
                    className={segmentClass(goalView === "approved")}
                  >
                    Aprovados ({approved.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalView("history")}
                    className={segmentClass(goalView === "history")}
                  >
                    Histórico ({history.length})
                  </button>
                </div>
              </div>

              <div className="mt-5 divide-y divide-[#e1e2e4]">
                {loading ? (
                  <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                    A carregar objetivos...
                  </p>
                ) : visibleGoals.length > 0 ? (
                  goalView === "pending"
                    ? visibleGoals.map(renderPending)
                    : goalView === "approved"
                      ? visibleGoals.map(renderApproved)
                      : visibleGoals.map(renderHistory)
                ) : (
                  <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                    {emptyMessage}
                  </p>
                )}
              </div>
            </section>
          )}
        </section>
      </main>
    </DashboardShell>
  );
};

const GoalsPage = () => (selectedProfileIsParent() ? <ParentGoals /> : <ChildGoals />);

export default GoalsPage;
