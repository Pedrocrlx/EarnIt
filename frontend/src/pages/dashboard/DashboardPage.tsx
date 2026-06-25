import { ArchiveIcon, CalendarIcon, CheckCircledIcon, ChevronRightIcon, CrossCircledIcon, ReloadIcon, StarIcon, TargetIcon, UpdateIcon } from "@radix-ui/react-icons";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import { formatEuros, formatPoints } from "@/lib/points";
import { selectedProfileIsParent } from "@/lib/profile-selection";
import { approveGoal, listGoals, rejectGoal } from "@/services/goalService";
import { getPointValue } from "@/services/profileService";
import {
  approveAllSubmissions,
  approveSubmission as approveSubmissionRequest,
  listSubmissions,
  listTasks,
  rejectSubmission as rejectSubmissionRequest,
} from "@/services/taskService";
import type {
  Goal,
  SubmissionResponse,
  TaskResponse,
} from "@/services/types";
import ChildDashboard from "./ChildDashboard";

type ChildGoals = { balance: number; goals: Goal[] };
type GoalWithChild = Goal & { childName: string };

// How many extra tasks to preview on the dashboard before "Ver todas".
const TASK_PREVIEW_LIMIT = 5;

const childChip = (name: string) => (
  <span className="shrink-0 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-bold text-[#5f6800]">
    {name}
  </span>
);

const countChip = (count: number) => (
  <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-[#404940]">
    {count}
  </span>
);

const DashboardPage = () => {
  const { familyProfile } = useAuth();
  const { showToast } = useToast();

  const children = useMemo(
    () => familyProfile?.children.filter((child) => child.is_active) ?? [],
    [familyProfile?.children],
  );

  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [goalsByChild, setGoalsByChild] = useState<Record<string, ChildGoals>>({});
  const [pointValueEur, setPointValueEur] = useState(0.01);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});

  const isParent = selectedProfileIsParent();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTasks, nextSubmissions, { point_value_eur }, goalResults] =
        await Promise.all([
          listTasks(),
          listSubmissions(),
          getPointValue(),
          Promise.all(
            children.map(async (child) => {
              const data = await listGoals(child.id);
              return [
                child.id,
                { balance: data.balance_points, goals: data.goals },
              ] as const;
            }),
          ),
        ]);
      setTasks(nextTasks);
      setSubmissions(nextSubmissions);
      setPointValueEur(Number(point_value_eur) || 0.01);
      setGoalsByChild(Object.fromEntries(goalResults));
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar o painel.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [children, showToast]);

  useEffect(() => {
    if (!isParent) {
      return;
    }
    // Synchronizes async server state with this overview page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [isParent, load]);

  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const childNameById = useMemo(
    () => new Map(children.map((child) => [child.id, child.name])),
    [children],
  );

  // Only extra tasks surface here — they're one-off and temporary, unlike
  // recurring duties which live in their own page.
  const activeExtraTasks = useMemo(
    () => tasks.filter((task) => task.is_active && task.task_type === "extra_task"),
    [tasks],
  );
  const pendingSubmissions = useMemo(
    () =>
      submissions.filter(
        (submission) => submission.status === "pending" && submission.submitted_at,
      ),
    [submissions],
  );
  const requestedGoals = useMemo<GoalWithChild[]>(
    () =>
      Object.entries(goalsByChild).flatMap(([childId, entry]) =>
        entry.goals
          .filter((goal) => goal.status === "requested")
          .map((goal) => ({
            ...goal,
            childName: childNameById.get(childId) ?? "Criança",
          })),
      ),
    [goalsByChild, childNameById],
  );

  // Child path delegates entirely to the child dashboard.
  if (!isParent) {
    return <ChildDashboard />;
  }

  const familyName = familyProfile?.family_name?.trim() || "Família";
  const actionIsRunning = busyAction !== null;

  const approveSubmission = async (submissionId: string) => {
    setBusyAction(`approve-${submissionId}`);
    try {
      await approveSubmissionRequest(submissionId);
      await load();
      showToast("Submissão aprovada.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível aprovar a submissão.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const rejectSubmission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectingId) {
      return;
    }
    setBusyAction(`reject-${rejectingId}`);
    try {
      await rejectSubmissionRequest(rejectingId, rejectionNote.trim() || null);
      setRejectingId(null);
      setRejectionNote("");
      await load();
      showToast("Submissão rejeitada.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível rejeitar a submissão.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const approveAll = async () => {
    setBusyAction("approve-all");
    try {
      const response = await approveAllSubmissions();
      await load();
      showToast(`${response.approved} submissões aprovadas.`);
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível aprovar as submissões.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const runGoalAction = async (goalId: string, action: () => Promise<unknown>) => {
    setBusyAction(`goal-${goalId}`);
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
      setBusyAction(null);
    }
  };

  const approveWish = (goal: GoalWithChild) => {
    const euros = Number(targets[goal.id]);
    const points = pointValueEur > 0 ? Math.round((euros || 0) / pointValueEur) : 0;
    if (!points || points <= 0) {
      showToast("Indique um valor de objetivo maior que zero.", "error");
      return;
    }
    void runGoalAction(goal.id, () => approveGoal(goal.child_id, goal.id, points));
  };

  return (
    <DashboardShell>
      <main className="flex min-h-screen w-full flex-col items-center gap-10 bg-[#f8f9fb] p-0 text-[#191c1e] lg:min-h-[1024px] lg:w-[1024px] lg:grow">
        <section className="flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-[#5f6800]">
                Painel parental
              </p>
              <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
                {familyName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#404940]">
                Resolva aqui o que está à espera de si.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={load}
              disabled={loading || actionIsRunning}
              aria-label="Atualizar"
              className="size-11 shrink-0 rounded-full border border-[#e1e2e4] text-[#003514] hover:bg-white"
            >
              <ReloadIcon
                className={`size-5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </Button>
          </header>

          {/* Submissions to review */}
          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <ArchiveIcon className="size-5 text-[#003514]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[#003514]">Submissões por rever</h2>
                {countChip(pendingSubmissions.length)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={approveAll}
                  disabled={actionIsRunning || pendingSubmissions.length === 0}
                  className="h-10 rounded-full bg-[#d4e251] px-4 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                >
                  {busyAction === "approve-all" ? (
                    <UpdateIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircledIcon className="mr-2 size-4" aria-hidden="true" />
                  )}
                  Aprovar todas
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 rounded-full px-3 text-xs font-semibold text-[#003514] hover:bg-[#f3f4f6]"
                >
                  <Link to="/dashboard/submissions">
                    Ver todas
                    <ChevronRightIcon className="ml-1 size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                  A carregar...
                </p>
              ) : pendingSubmissions.length > 0 ? (
                pendingSubmissions.map((submission) => {
                  const task = taskById.get(submission.task_id);
                  const isExtra = task?.task_type === "extra_task";
                  return (
                    <article key={submission.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-[#191c1e]">
                              {task?.title ?? "Tarefa"}
                            </h3>
                            {isExtra && task ? (
                              <span className="flex items-center gap-1.5 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-semibold text-[#5f6800]">
                                <StarIcon className="size-3.5" aria-hidden="true" />
                                {formatEuros(Number(task.reward_amount) * pointValueEur)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-[#404940]">
                            {childNameById.get(submission.child_id) ?? "Criança"}
                            {submission.submitted_at
                              ? ` · ${new Date(submission.submitted_at).toLocaleDateString("pt-PT")}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => approveSubmission(submission.id)}
                            disabled={actionIsRunning}
                            className="h-9 rounded-full bg-[#d4e251] px-3 text-xs font-semibold text-[#003514] hover:bg-[#cfdc42]"
                          >
                            {busyAction === `approve-${submission.id}` ? (
                              <UpdateIcon className="mr-2 size-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckCircledIcon className="mr-2 size-3.5" aria-hidden="true" />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setRejectingId(submission.id)}
                            disabled={actionIsRunning}
                            className="h-9 rounded-full px-3 text-xs font-semibold text-[#7a4100] hover:bg-[#fff4de] hover:text-[#7a4100]"
                          >
                            <CrossCircledIcon className="mr-2 size-3.5" aria-hidden="true" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>

                      {rejectingId === submission.id ? (
                        <form
                          onSubmit={rejectSubmission}
                          className="mt-3 flex flex-col gap-2 sm:flex-row"
                        >
                          <Input
                            value={rejectionNote}
                            onChange={(event) => setRejectionNote(event.target.value)}
                            disabled={actionIsRunning}
                            placeholder="Nota de rejeição (opcional)"
                            className="h-10 rounded-lg border-[#e1e2e4] bg-white"
                          />
                          <Button
                            type="submit"
                            disabled={actionIsRunning}
                            className="h-10 rounded-full bg-[#003514] px-4 text-xs font-semibold text-white hover:bg-[#003514]/90"
                          >
                            Confirmar
                          </Button>
                        </form>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Sem submissões por rever. 🎉
                </p>
              )}
            </div>
          </section>

          {/* Goal requests to approve */}
          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <TargetIcon className="size-5 text-[#003514]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[#003514]">Pedidos de objetivos</h2>
                {countChip(requestedGoals.length)}
              </div>
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-full px-3 text-xs font-semibold text-[#003514] hover:bg-[#f3f4f6]"
              >
                <Link to="/dashboard/goals">
                  Ver objetivos
                  <ChevronRightIcon className="ml-1 size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                  A carregar...
                </p>
              ) : requestedGoals.length > 0 ? (
                requestedGoals.map((goal) => {
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
                            htmlFor={`dash-target-${goal.id}`}
                            className="text-xs font-semibold text-[#404940]"
                          >
                            Valor do objetivo (€)
                          </Label>
                          <Input
                            id={`dash-target-${goal.id}`}
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
                            disabled={busyAction === `goal-${goal.id}`}
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
                            onClick={() => approveWish(goal)}
                            disabled={busyAction === `goal-${goal.id}`}
                            className="h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                          >
                            {busyAction === `goal-${goal.id}` ? (
                              <UpdateIcon className="mr-2 size-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              runGoalAction(goal.id, () => rejectGoal(goal.child_id, goal.id))
                            }
                            disabled={busyAction === `goal-${goal.id}`}
                            className="h-11 rounded-full bg-[#f3f4f6] px-5 text-sm font-semibold text-[#7a4100] hover:bg-[#fff4de]"
                          >
                            Recusar
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Sem pedidos pendentes.
                </p>
              )}
            </div>
          </section>

          {/* Active tasks at a glance */}
          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-5 text-[#003514]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[#003514]">Tarefas extra</h2>
                {countChip(activeExtraTasks.length)}
              </div>
              <Button
                asChild
                variant="ghost"
                className="h-9 rounded-full px-3 text-xs font-semibold text-[#003514] hover:bg-[#f3f4f6]"
              >
                <Link to="/dashboard/tasks">
                  Ver todas
                  <ChevronRightIcon className="ml-1 size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                  A carregar...
                </p>
              ) : activeExtraTasks.length > 0 ? (
                activeExtraTasks.slice(0, TASK_PREVIEW_LIMIT).map((task) => (
                  <article
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[#191c1e]">
                        {task.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#404940]">
                        {childNameById.get(task.child_id) ?? "Criança"}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-semibold text-[#5f6800]">
                      <StarIcon className="size-3.5" aria-hidden="true" />
                      {formatEuros(Number(task.reward_amount) * pointValueEur)}
                    </span>
                  </article>
                ))
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Sem tarefas extra ativas.
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
