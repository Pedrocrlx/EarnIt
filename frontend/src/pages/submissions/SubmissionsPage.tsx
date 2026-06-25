import {
  CheckCircle2,
  Clock,
  Coins,
  LoaderCircle,
  RefreshCw,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import { formatEuros } from "@/lib/points";
import { getPointValue } from "@/services/profileService";
import {
  approveAllSubmissions,
  approveSubmission as approveTaskSubmission,
  listSubmissions,
  listTasks,
  rejectSubmission as rejectTaskSubmission,
} from "@/services/taskService";
import type { SubmissionResponse, TaskResponse } from "@/services/types";

const statusLabels: Record<string, string> = {
  approved: "Aprovada",
  pending: "Pendente",
  rejected: "Rejeitada",
};

const taskTypeLabels: Record<string, string> = {
  duty: "Rotina",
  extra_task: "Extra",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const segmentClass = (active: boolean) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
    active ? "bg-[#003514] text-white" : "text-[#404940] hover:text-[#003514]"
  }`;

const metaItemClass = "flex items-center gap-1.5 text-sm text-[#404940]";

const SubmissionsPage = () => {
  const { familyProfile } = useAuth();
  const { showToast } = useToast();
  const children = useMemo(
    () => familyProfile?.children.filter((child) => child.is_active) ?? [],
    [familyProfile?.children],
  );
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pointValueEur, setPointValueEur] = useState(0.01);
  const [submissionView, setSubmissionView] = useState<
    "pending" | "approved" | "rejected"
  >("pending");

  useEffect(() => {
    let isMounted = true;
    void getPointValue()
      .then(({ point_value_eur }) => {
        if (isMounted) {
          setPointValueEur(Number(point_value_eur) || 0.01);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const childNameById = useMemo(
    () => new Map(children.map((child) => [child.id, child.name])),
    [children],
  );
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const pendingSubmissions = useMemo(
    () =>
      submissions.filter(
        (submission) => submission.status === "pending" && submission.submitted_at,
      ),
    [submissions],
  );
  const approvedSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === "approved"),
    [submissions],
  );
  const rejectedSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === "rejected"),
    [submissions],
  );
  const visibleSubmissions =
    submissionView === "pending"
      ? pendingSubmissions
      : submissionView === "approved"
        ? approvedSubmissions
        : rejectedSubmissions;

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [nextTasks, nextSubmissions] = await Promise.all([
        listTasks(),
        listSubmissions(),
      ]);
      setTasks(nextTasks);
      setSubmissions(nextSubmissions);
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar as submissões.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // Synchronizes async server state with this page's local submission review UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const approveSubmission = async (submissionId: string) => {
    setBusyAction(`approve-${submissionId}`);

    try {
      await approveTaskSubmission(submissionId);
      await loadData();
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
    if (!rejectingSubmissionId) {
      return;
    }

    setBusyAction(`reject-${rejectingSubmissionId}`);

    try {
      await rejectTaskSubmission(rejectingSubmissionId, rejectionNote.trim() || null);
      setRejectingSubmissionId(null);
      setRejectionNote("");
      await loadData();
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
      await loadData();
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

  const actionIsRunning = busyAction !== null;

  const emptyMessage =
    submissionView === "pending"
      ? "Sem submissões pendentes."
      : submissionView === "approved"
        ? "Sem submissões aprovadas."
        : "Sem submissões rejeitadas.";

  return (
    <DashboardShell>
      <main className="flex min-h-screen w-full flex-col items-center gap-10 bg-[#f8f9fb] p-0 text-[#191c1e] lg:min-h-[1024px] lg:w-[1024px] lg:grow">
        <section className="flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-[#5f6800]">
                Gestão de tarefas
              </p>
              <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
                Submissões
              </h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={loadData}
              disabled={loading || actionIsRunning}
              aria-label="Atualizar"
              className="size-11 shrink-0 rounded-full border border-[#e1e2e4] text-[#003514] hover:bg-white"
            >
              <RefreshCw
                className={`size-5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </Button>
          </header>

          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-[#003514]">Lista de submissões</h2>
                <div className="inline-flex rounded-full border border-[#e1e2e4] bg-[#f8f9fb] p-1">
                  <button
                    type="button"
                    onClick={() => setSubmissionView("pending")}
                    className={segmentClass(submissionView === "pending")}
                  >
                    Pendentes ({pendingSubmissions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionView("approved")}
                    className={segmentClass(submissionView === "approved")}
                  >
                    Aprovadas ({approvedSubmissions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionView("rejected")}
                    className={segmentClass(submissionView === "rejected")}
                  >
                    Rejeitadas ({rejectedSubmissions.length})
                  </button>
                </div>
              </div>
              <Button
                type="button"
                onClick={approveAll}
                disabled={actionIsRunning || pendingSubmissions.length === 0}
                className="h-10 shrink-0 rounded-full bg-[#d4e251] px-4 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {busyAction === "approve-all" ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                )}
                Aprovar pendentes
              </Button>
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                  A carregar submissões...
                </p>
              ) : visibleSubmissions.length > 0 ? (
                visibleSubmissions.map((submission) => {
                  const task = taskById.get(submission.task_id);
                  const canReview =
                    submission.status === "pending" && submission.submitted_at;
                  const reviewedOrSubmitted =
                    submission.reviewed_at ?? submission.submitted_at;

                  return (
                    <article key={submission.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-[#191c1e]">
                              {task?.title ?? "Tarefa"}
                            </h3>
                            <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-[#404940]">
                              {statusLabels[submission.status] ?? submission.status}
                            </span>
                            {task && task.task_type === "extra_task" ? (
                              <span className="flex items-center gap-1.5 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-semibold text-[#5f6800]">
                                <Coins className="size-3.5" aria-hidden="true" />
                                {formatEuros(Number(task.reward_amount) * pointValueEur)} (
                                {Number(task.reward_amount).toLocaleString("pt-PT")} pts)
                              </span>
                            ) : null}
                          </div>
                          {submission.rejection_note ? (
                            <p className="mt-1.5 text-sm text-[#7a4100]">
                              {submission.rejection_note}
                            </p>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                            <span className={metaItemClass}>
                              <UserRound className="size-4 text-[#7a8278]" aria-hidden="true" />
                              {childNameById.get(submission.child_id) ?? "Criança"}
                            </span>
                            {task ? (
                              <span className={metaItemClass}>
                                <Tag className="size-4 text-[#7a8278]" aria-hidden="true" />
                                {taskTypeLabels[task.task_type] ?? task.task_type}
                              </span>
                            ) : null}
                            <span className={metaItemClass}>
                              <Clock className="size-4 text-[#7a8278]" aria-hidden="true" />
                              {reviewedOrSubmitted
                                ? formatDate(reviewedOrSubmitted)
                                : "ainda sem envio"}
                            </span>
                          </div>
                        </div>

                        {canReview ? (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={() => approveSubmission(submission.id)}
                              disabled={actionIsRunning}
                              className="h-9 rounded-full bg-[#d4e251] px-3 text-xs font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
                            >
                              {busyAction === `approve-${submission.id}` ? (
                                <LoaderCircle className="mr-2 size-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="mr-2 size-3.5" aria-hidden="true" />
                              )}
                              Aprovar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setRejectingSubmissionId(submission.id)}
                              disabled={actionIsRunning}
                              className="h-9 rounded-full px-3 text-xs font-semibold text-[#7a4100] hover:bg-[#fff4de] hover:text-[#7a4100] disabled:opacity-50"
                            >
                              <XCircle className="mr-2 size-3.5" aria-hidden="true" />
                              Rejeitar
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {rejectingSubmissionId === submission.id ? (
                        <form onSubmit={rejectSubmission} className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={rejectionNote}
                            onChange={(event) => setRejectionNote(event.target.value)}
                            disabled={actionIsRunning}
                            placeholder="Nota de rejeição"
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
                  {emptyMessage}
                </p>
              )}
            </div>
          </section>
        </section>
      </main>
    </DashboardShell>
  );
};

export default SubmissionsPage;
