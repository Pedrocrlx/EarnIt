import { CheckCircle2, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import {
  approveAllSubmissions,
  approveSubmission as approveTaskSubmission,
  getSubmissionPhotoUrl,
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

const SubmissionsPage = () => {
  const { familyProfile } = useAuth();
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
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const childNameById = useMemo(
    () => new Map(children.map((child) => [child.id, child.name])),
    [children],
  );
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "pending" && submission.submitted_at,
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [nextTasks, nextSubmissions] = await Promise.all([
        listTasks(),
        listSubmissions(),
      ]);
      setTasks(nextTasks);
      setSubmissions(nextSubmissions);
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar as submissões.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Synchronizes async server state with this page's local submission review UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const approveSubmission = async (submissionId: string) => {
    setBusyAction(`approve-${submissionId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await approveTaskSubmission(submissionId);
      await loadData();
      setSuccessMessage("Submissão aprovada.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível aprovar a submissão.",
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
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await rejectTaskSubmission(rejectingSubmissionId, rejectionNote.trim() || null);
      setRejectingSubmissionId(null);
      setRejectionNote("");
      await loadData();
      setSuccessMessage("Submissão rejeitada.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível rejeitar a submissão.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const approveAll = async () => {
    setBusyAction("approve-all");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await approveAllSubmissions();
      await loadData();
      setSuccessMessage(`${response.approved} submissões aprovadas.`);
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível aprovar as submissões.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const actionIsRunning = busyAction !== null;

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

          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg bg-[#eef7d1] px-4 py-3 text-sm font-semibold text-[#5f6800]">
              {successMessage}
            </p>
          ) : null}

          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#003514]">Submissões</h2>
                <p className="mt-1 text-sm text-[#404940]">Aprovar ou rejeitar tarefas enviadas.</p>
              </div>
              <Button type="button" onClick={approveAll} disabled={actionIsRunning || pendingSubmissions.length === 0} className="h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60">
                {busyAction === "approve-all" ? <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />}
                Aprovar pendentes
              </Button>
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                  A carregar submissões...
                </p>
              ) : submissions.length > 0 ? (
                submissions.map((submission) => {
                  const task = taskById.get(submission.task_id);
                  const canReview = submission.status === "pending" && submission.submitted_at;

                  return (
                    <article key={submission.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-[#191c1e]">{task?.title ?? "Tarefa"}</h3>
                            <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-[#404940]">
                              {statusLabels[submission.status] ?? submission.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[#404940]">
                            {childNameById.get(submission.child_id) ?? "Criança"}
                            {submission.submitted_at ? ` · Enviada ${new Date(submission.submitted_at).toLocaleDateString("pt-PT")}` : " · Ainda sem envio"}
                          </p>
                          {submission.rejection_note ? (
                            <p className="mt-1 text-sm text-[#7a4100]">{submission.rejection_note}</p>
                          ) : null}
                          {submission.has_photo ? (
                            <img
                              src={getSubmissionPhotoUrl(submission.id)}
                              alt={`Prova da tarefa ${task?.title ?? "submetida"}`}
                              className="mt-3 h-36 w-full max-w-xs rounded-lg border border-[#e1e2e4] object-cover"
                            />
                          ) : (
                            <p className="mt-2 text-sm text-[#59625a]">Sem fotografia de prova anexada.</p>
                          )}
                        </div>

                        {canReview ? (
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" onClick={() => approveSubmission(submission.id)} disabled={actionIsRunning} className="h-9 rounded-full bg-[#d4e251] px-3 text-xs font-semibold text-[#003514] hover:bg-[#cfdc42]">
                              {busyAction === `approve-${submission.id}` ? <LoaderCircle className="mr-2 size-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-2 size-3.5" aria-hidden="true" />}
                              Aprovar
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setRejectingSubmissionId(submission.id)} disabled={actionIsRunning} className="h-9 rounded-full px-3 text-xs font-semibold text-[#7a4100] hover:bg-[#fff4de] hover:text-[#7a4100]">
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
                          <Button type="submit" disabled={actionIsRunning} className="h-10 rounded-full bg-[#003514] px-4 text-xs font-semibold text-white hover:bg-[#003514]/90">
                            Confirmar
                          </Button>
                        </form>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  Ainda não existem submissões.
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
