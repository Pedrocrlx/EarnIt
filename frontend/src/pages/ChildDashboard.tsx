import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Coins,
  LoaderCircle,
  RotateCcw,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";
import { apiFetch } from "@/lib/api";
import { getSelectedProfileId } from "@/lib/profile-selection";
import { cn } from "@/lib/utils";

type SubmissionStatus = "approved" | "pending" | "rejected" | string;

type ChildSubmission = {
  child_id: string;
  id: string;
  rejection_note: string | null;
  reviewed_at: string | null;
  scheduled_date: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  task_id: string;
};

type ChildTask = {
  description: string | null;
  expires_at: string | null;
  id: string;
  reward_amount: string;
  submission: ChildSubmission | null;
  task_type: "duty" | "extra_task" | string;
  title: string;
};

type WalletTransaction = {
  amount: string;
  child_id: string;
  created_at: string;
  description: string | null;
  id: string;
  task_submission_id: string | null;
  transaction_type: string;
};

type WalletResponse = {
  balance: string;
  child_id: string;
  transactions: WalletTransaction[];
};

type TaskAction =
  | { label: string; mode: "disabled"; reason?: string }
  | { label: string; mode: "resubmit"; submissionId: string }
  | { label: string; mode: "submit" };

const statusLabels: Record<string, string> = {
  approved: "Aprovada",
  pending: "Pendente",
  rejected: "Rejeitada",
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

const formatMoney = (amount: string) => `${Number(amount).toFixed(2)} €`;

const getTaskAction = (task: ChildTask): TaskAction => {
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
    return { label: "Concluída", mode: "disabled" };
  }

  if (submission.submitted_at) {
    return { label: "Em revisão", mode: "disabled" };
  }

  return { label: "Enviar", mode: "submit" };
};

const ChildDashboard = () => {
  const { familyProfile } = useAuth();
  const selectedProfileId = getSelectedProfileId();
  const selectedChild = useMemo(
    () =>
      familyProfile?.children.find(
        (child) => child.id === selectedProfileId && child.is_active,
      ) ?? null,
    [familyProfile?.children, selectedProfileId],
  );
  const [tasks, setTasks] = useState<ChildTask[]>([]);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!selectedChild) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const [nextTasks, nextWallet] = await Promise.all([
        apiFetch<ChildTask[]>(`/children/${selectedChild.id}/tasks`),
        apiFetch<WalletResponse>(`/children/${selectedChild.id}/wallet`),
      ]);
      setTasks(nextTasks);
      setWallet(nextWallet);
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar o painel.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedChild]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const submitTask = async (task: ChildTask) => {
    if (!selectedChild) {
      return;
    }

    setBusyAction(`submit-${task.id}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch(`/children/${selectedChild.id}/tasks/${task.id}/submit`, {
        method: "POST",
      });
      await loadDashboard();
      setSuccessMessage("Tarefa enviada para aprovação.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível enviar a tarefa.",
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
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch(`/children/${selectedChild.id}/submissions/${submissionId}`, {
        method: "PATCH",
      });
      await loadDashboard();
      setSuccessMessage("Tarefa reenviada para aprovação.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível reenviar a tarefa.",
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
  const latestTransactions = wallet?.transactions.slice(0, 3) ?? [];
  const actionIsRunning = busyAction !== null;

  return (
    <DashboardShell>
      <main className="relative z-0 flex w-full max-w-[1200px] flex-none grow-0 flex-col items-start gap-10 self-stretch bg-[#f8f9fb] px-4 py-6 pb-16 text-[#191c1e] sm:px-6 lg:h-[1024px] lg:min-h-[1024px] lg:w-[1024px] lg:px-10 lg:py-10 lg:pb-[258px]">
        {!selectedChild ? (
          <section className="flex w-full flex-col gap-5 rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div>
              <p className="text-sm font-semibold uppercase text-[#5f6800]">
                Perfil da criança
              </p>
              <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514]">
                Escolha um perfil
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#404940]">
                Selecione uma criança para ver tarefas, progresso e carteira.
              </p>
            </div>
            <Button
              asChild
              className="h-11 w-fit rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42]"
            >
              <Link to="/profile">Trocar perfil</Link>
            </Button>
          </section>
        ) : (
          <>
            <header className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase text-[#5f6800]">
                  Lista de tarefas
                </p>
                <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
                  Olá, {selectedChild.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#404940]">
                  Vê as tuas tarefas, envia o que terminaste e acompanha as moedas
                  ganhas.
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                className="h-11 rounded-full border border-[#e1e2e4] bg-white px-5 text-sm font-semibold text-[#003514] hover:bg-white"
              >
                <Link to="/profile">
                  <UsersRound className="mr-2 size-4" aria-hidden="true" />
                  Trocar perfil
                </Link>
              </Button>
            </header>

            <section className="grid w-full gap-3 md:grid-cols-4">
              <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#404940]">Moedas</p>
                    <p className="mt-2 text-3xl font-bold text-[#003514]">
                      {formatMoney(wallet?.balance ?? "0")}
                    </p>
                  </div>
                  <WalletCards className="size-5 text-[#5f6800]" aria-hidden="true" />
                </div>
              </article>
              <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
                <p className="text-sm font-semibold text-[#404940]">Disponíveis</p>
                <p className="mt-2 text-3xl font-bold text-[#003514]">
                  {availableCount}
                </p>
              </article>
              <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
                <p className="text-sm font-semibold text-[#404940]">Em revisão</p>
                <p className="mt-2 text-3xl font-bold text-[#003514]">
                  {waitingCount}
                </p>
              </article>
              <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
                <p className="text-sm font-semibold text-[#404940]">Concluídas</p>
                <p className="mt-2 text-3xl font-bold text-[#003514]">
                  {completedCount}
                </p>
              </article>
            </section>

            {errorMessage ? (
              <p className="w-full rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="w-full rounded-lg bg-[#eef7d1] px-4 py-3 text-sm font-semibold text-[#5f6800]">
                {successMessage}
              </p>
            ) : null}

            <section className="grid w-full gap-6 xl:grid-cols-[1fr_320px]">
              <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#003514]">
                      Tarefas de hoje
                    </h2>
                    <p className="mt-1 text-sm text-[#404940]">
                      Envia as tarefas quando estiverem prontas.
                    </p>
                  </div>
                  <ClipboardList className="size-5 text-[#404940]" aria-hidden="true" />
                </div>

                <div className="mt-5 grid gap-3">
                  {loading ? (
                    <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                      A carregar tarefas...
                    </p>
                  ) : tasks.length > 0 ? (
                    tasks.map((task) => {
                      const action = getTaskAction(task);
                      const status = task.submission?.status;
                      const isBusy =
                        busyAction === `submit-${task.id}` ||
                        (action.mode === "resubmit" &&
                          busyAction === `resubmit-${action.submissionId}`);

                      return (
                        <article
                          key={task.id}
                          className="flex flex-col gap-4 rounded-lg border border-[#e1e2e4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-[#191c1e]">
                                {task.title}
                              </h3>
                              <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-[#404940]">
                                {taskTypeLabels[task.task_type] ?? task.task_type}
                              </span>
                              {status ? (
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                                    statusStyles[status] ?? "bg-[#f3f4f6] text-[#404940]",
                                  )}
                                >
                                  {statusLabels[status] ?? status}
                                </span>
                              ) : null}
                            </div>
                            {task.description ? (
                              <p className="mt-2 text-sm leading-5 text-[#404940]">
                                {task.description}
                              </p>
                            ) : null}
                            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#59625a]">
                              <Coins className="size-4" aria-hidden="true" />
                              {formatMoney(task.reward_amount)}
                              {task.expires_at ? (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <Clock3 className="size-4" aria-hidden="true" />
                                  {new Date(task.expires_at).toLocaleDateString("pt-PT")}
                                </>
                              ) : null}
                            </p>
                            {task.submission?.rejection_note ? (
                              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                                {task.submission.rejection_note}
                              </p>
                            ) : null}
                            {action.mode === "disabled" && action.reason ? (
                              <p className="mt-2 text-xs font-semibold text-[#7a4100]">
                                {action.reason}
                              </p>
                            ) : null}
                          </div>

                          {action.mode === "submit" ? (
                            <Button
                              type="button"
                              onClick={() => submitTask(task)}
                              disabled={actionIsRunning}
                              className="h-11 shrink-0 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                            >
                              {isBusy ? (
                                <LoaderCircle
                                  className="mr-2 size-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ClipboardCheck
                                  className="mr-2 size-4"
                                  aria-hidden="true"
                                />
                              )}
                              {action.label}
                            </Button>
                          ) : action.mode === "resubmit" ? (
                            <Button
                              type="button"
                              onClick={() => resubmitTask(action.submissionId)}
                              disabled={actionIsRunning}
                              className="h-11 shrink-0 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                            >
                              {isBusy ? (
                                <LoaderCircle
                                  className="mr-2 size-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                              )}
                              {action.label}
                            </Button>
                          ) : (
                            <span className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] px-5 text-sm font-semibold text-[#404940]">
                              <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                              {action.label}
                            </span>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                      Ainda não tens tarefas.
                    </p>
                  )}
                </div>
              </section>

              <aside className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
                <h2 className="text-lg font-bold text-[#003514]">Carteira</h2>
                <p className="mt-1 text-sm text-[#404940]">
                  Últimos movimentos aprovados.
                </p>
                <div className="mt-5 grid gap-3">
                  {latestTransactions.length > 0 ? (
                    latestTransactions.map((transaction) => (
                      <article
                        key={transaction.id}
                        className="rounded-lg bg-[#f8f9fb] px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-[#191c1e]">
                          {formatMoney(transaction.amount)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#59625a]">
                          {transaction.description ?? "Movimento da carteira"}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                      Ainda não existem movimentos.
                    </p>
                  )}
                </div>
              </aside>
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
};

export default ChildDashboard;
