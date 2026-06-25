import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coins,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChildShell from "@/components/ChildShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import { formatPoints } from "@/lib/points";
import { getSelectedProfileId } from "@/lib/profile-selection";
import { cn } from "@/lib/utils";
import {
  getWallet,
  listChildTasks,
  resubmitTask as resubmitTaskRequest,
  submitTask as submitTaskRequest,
} from "@/services/taskService";
import type { ChildTaskResponse, WalletResponse } from "@/services/types";

type TaskAction =
  | { label: string; mode: "disabled"; reason?: string }
  | { label: string; mode: "resubmit"; submissionId: string }
  | { label: string; mode: "submit" };

const statusLabels: Record<string, string> = {
  approved: "✅ Aprovada",
  pending: "⏳ Em revisão",
  rejected: "🔁 Tenta outra vez",
};

const statusStyles: Record<string, string> = {
  approved: "bg-[#eef7d1] text-[#4b5c00]",
  pending: "bg-[#fff4de] text-[#7a4100]",
  rejected: "bg-red-50 text-red-700",
};

const taskTypeLabels: Record<string, string> = {
  duty: "Rotina",
  extra_task: "Extra",
};

const getTaskAction = (task: ChildTaskResponse): TaskAction => {
  const submission = task.submission;

  if (!submission) {
    if (task.task_type === "duty") {
      return {
        label: "Indisponível hoje",
        mode: "disabled",
        reason: "A rotina ainda não tem espaço diário criado.",
      };
    }

    return { label: "Enviar", mode: "submit" };
  }

  if (submission.status === "rejected") {
    return {
      label: "Reenviar",
      mode: "resubmit",
      submissionId: submission.id,
    };
  }

  if (submission.status === "approved") {
    return { label: "Concluída ✅", mode: "disabled" };
  }

  if (submission.submitted_at) {
    return { label: "Em revisão ⏳", mode: "disabled" };
  }

  return { label: "Enviar", mode: "submit" };
};

const ChildDashboard = () => {
  const { familyProfile } = useAuth();
  const { showToast } = useToast();
  const selectedProfileId = getSelectedProfileId();
  const selectedChild = useMemo(
    () =>
      familyProfile?.children.find(
        (child) => child.id === selectedProfileId && child.is_active,
      ) ?? null,
    [familyProfile?.children, selectedProfileId],
  );
  const [tasks, setTasks] = useState<ChildTaskResponse[]>([]);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!selectedChild) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [nextTasks, nextWallet] = await Promise.all([
        listChildTasks(selectedChild.id),
        getWallet(selectedChild.id),
      ]);
      setTasks(nextTasks);
      setWallet(nextWallet);
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar as tarefas.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedChild, showToast]);

  useEffect(() => {
    // Synchronizes async server state with the selected child task list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  const submitTask = async (task: ChildTaskResponse) => {
    if (!selectedChild) {
      return;
    }

    setBusyAction(`submit-${task.id}`);

    try {
      await submitTaskRequest(selectedChild.id, task.id);
      await loadDashboard();
      showToast("Tarefa enviada para aprovação. 🚀");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível enviar a tarefa.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const resubmitTask = async (submissionId: string) => {
    if (!selectedChild) {
      return;
    }

    setBusyAction(`resubmit-${submissionId}`);

    try {
      await resubmitTaskRequest(selectedChild.id, submissionId);
      await loadDashboard();
      showToast("Tarefa reenviada para aprovação. 🚀");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível reenviar a tarefa.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const completedCount = tasks.filter(
    (task) => task.submission?.status === "approved",
  ).length;
  const waitingCount = tasks.filter(
    (task) => task.submission?.status === "pending" && task.submission.submitted_at,
  ).length;
  const availableCount = tasks.filter((task) => {
    const action = getTaskAction(task);
    return action.mode === "submit" || action.mode === "resubmit";
  }).length;
  const actionIsRunning = busyAction !== null;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <ChildShell points={wallet?.balance_points ?? 0} loading={loading}>
      {!selectedChild ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-[#e1e2e4] bg-white p-5 text-center">
          <h1 className="font-montserrat text-xl font-bold text-[#003514]">
            Escolhe um perfil
          </h1>
          <p className="text-sm leading-6 text-[#404940]">
            Seleciona o teu perfil para veres as tuas tarefas e pontos.
          </p>
          <Button
            asChild
            className="h-11 rounded-full bg-[#d4e251] text-sm font-semibold text-[#003514] hover:bg-[#cfdc42]"
          >
            <Link to="/profile">Escolher perfil</Link>
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Progress hero */}
          <section className="rounded-2xl border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h1 className="font-montserrat text-xl font-bold text-[#003514]">
                  As minhas tarefas
                </h1>
                <p className="mt-1 text-sm text-[#404940]">
                  {completedCount} de {tasks.length} concluídas
                </p>
              </div>
              <span className="text-2xl font-bold text-[#5f6800]">{progress}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edeef0]">
              <div
                className="h-full rounded-full bg-[#d4e251] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#f8f9fb] px-3 py-2 text-center">
                <p className="text-lg font-bold text-[#003514]">{availableCount}</p>
                <p className="text-xs font-semibold text-[#59625a]">Para fazer</p>
              </div>
              <div className="rounded-xl bg-[#fff4de] px-3 py-2 text-center">
                <p className="text-lg font-bold text-[#7a4100]">{waitingCount}</p>
                <p className="text-xs font-semibold text-[#7a4100]">Em revisão</p>
              </div>
              <div className="rounded-xl bg-[#eef7d1] px-3 py-2 text-center">
                <p className="text-lg font-bold text-[#4b5c00]">{completedCount}</p>
                <p className="text-xs font-semibold text-[#5f6800]">Feitas</p>
              </div>
            </div>
          </section>

          {/* Task list */}
          {loading ? (
            <p className="rounded-2xl bg-[#f3f4f6] px-4 py-8 text-center text-sm font-semibold text-[#404940]">
              A carregar tarefas...
            </p>
          ) : tasks.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map((task) => {
                const action = getTaskAction(task);
                const status = task.submission?.status;
                const reward = Number(task.reward_amount);
                const isBusy =
                  busyAction === `submit-${task.id}` ||
                  (action.mode === "resubmit" &&
                    busyAction === `resubmit-${action.submissionId}`);

                return (
                  <article
                    key={task.id}
                    className="flex h-full flex-col gap-3 rounded-2xl border border-[#e1e2e4] bg-white p-4 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[#003514]">{task.title}</h3>
                      {status ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                            statusStyles[status] ?? "bg-[#f3f4f6] text-[#404940]",
                          )}
                        >
                          {statusLabels[status] ?? status}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#59625a]">
                      <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-[#404940]">
                        {taskTypeLabels[task.task_type] ?? task.task_type}
                      </span>
                      {reward > 0 ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-bold text-[#5f6800]">
                          <Coins className="size-3.5" aria-hidden="true" />
                          {formatPoints(reward)} pts
                        </span>
                      ) : null}
                      {task.expires_at ? (
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="size-4" aria-hidden="true" />
                          {new Date(task.expires_at).toLocaleDateString("pt-PT")}
                        </span>
                      ) : null}
                    </div>

                    {task.description ? (
                      <p className="text-sm leading-5 text-[#404940]">
                        {task.description}
                      </p>
                    ) : null}

                    {task.submission?.rejection_note ? (
                      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                        {task.submission.rejection_note}
                      </p>
                    ) : null}

                    {action.mode === "submit" || action.mode === "resubmit" ? (
                      <Button
                        type="button"
                        onClick={() =>
                          action.mode === "submit"
                            ? submitTask(task)
                            : resubmitTask(action.submissionId)
                        }
                        disabled={actionIsRunning}
                        className="mt-auto h-12 w-full rounded-full bg-[#d4e251] text-sm font-bold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                      >
                        {isBusy ? (
                          <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                        ) : action.mode === "submit" ? (
                          <ClipboardCheck className="mr-2 size-4" aria-hidden="true" />
                        ) : (
                          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                        )}
                        {action.label}
                      </Button>
                    ) : (
                      <div className="mt-auto flex flex-col gap-1">
                        <span className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#f3f4f6] text-sm font-bold text-[#404940]">
                          <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                          {action.label}
                        </span>
                        {action.reason ? (
                          <p className="text-center text-xs font-semibold text-[#7a4100]">
                            {action.reason}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-[#f3f4f6] px-4 py-10 text-center text-sm font-semibold text-[#404940]">
              Ainda não tens tarefas. ✨
            </p>
          )}
        </div>
      )}
    </ChildShell>
  );
};

export default ChildDashboard;
