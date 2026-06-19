import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/useAuth";
import { apiFetch } from "@/lib/api";

type TaskType = "duty" | "extra_task";
type SubmissionStatus = "pending" | "approved" | "rejected" | string;

type TaskResponse = {
  child_id: string;
  created_at: string;
  description: string | null;
  expires_at: string | null;
  id: string;
  is_active: boolean;
  reward_amount: string;
  task_type: TaskType | string;
  title: string;
  updated_at: string;
  user_id: string;
};

type SubmissionResponse = {
  child_id: string;
  id: string;
  rejection_note: string | null;
  reviewed_at: string | null;
  scheduled_date: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  task_id: string;
};

type CreateTaskForm = {
  childId: string;
  description: string;
  expiresAt: string;
  rewardAmount: string;
  taskType: TaskType;
  title: string;
};

const initialTaskForm: CreateTaskForm = {
  childId: "",
  description: "",
  expiresAt: "",
  rewardAmount: "0.00",
  taskType: "duty",
  title: "",
};

const statusLabels: Record<string, string> = {
  approved: "Aprovada",
  pending: "Pendente",
  rejected: "Rejeitada",
};

const taskTypeLabels: Record<string, string> = {
  duty: "Rotina",
  extra_task: "Extra",
};

const formatMoney = (amount: string) => `${Number(amount).toFixed(2)} €`;

const toDateTimePayload = (value: string) => (value ? new Date(value).toISOString() : null);

const TasksPage = () => {
  const { familyProfile } = useAuth();
  const children = useMemo(
    () => familyProfile?.children.filter((child) => child.is_active) ?? [],
    [familyProfile?.children],
  );
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [taskForm, setTaskForm] = useState<CreateTaskForm>(initialTaskForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
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
  const activeTasks = tasks.filter((task) => task.is_active);
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "pending" && submission.submitted_at,
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [nextTasks, nextSubmissions] = await Promise.all([
        apiFetch<TaskResponse[]>("/tasks"),
        apiFetch<SubmissionResponse[]>("/tasks/submissions"),
      ]);
      setTasks(nextTasks);
      setSubmissions(nextSubmissions);
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar as tarefas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!taskForm.childId && children[0]) {
      setTaskForm((currentForm) => ({ ...currentForm, childId: children[0].id }));
    }
  }, [children, taskForm.childId]);

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskForm.title.trim();
    if (!title || !taskForm.childId) {
      setErrorMessage("Escolha a criança e indique o título da tarefa.");
      setSuccessMessage("");
      return;
    }

    setBusyAction("create-task");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          child_id: taskForm.childId,
          title,
          description: taskForm.description.trim() || null,
          task_type: taskForm.taskType,
          reward_amount: taskForm.taskType === "duty" ? "0.00" : taskForm.rewardAmount,
          expires_at: toDateTimePayload(taskForm.expiresAt),
        }),
      });
      setTaskForm((currentForm) => ({
        ...initialTaskForm,
        childId: currentForm.childId,
      }));
      await loadTasks();
      setSuccessMessage("Tarefa criada.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error ? caughtError.message : "Não foi possível criar a tarefa.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const startEditTask = (task: TaskResponse) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setEditingDescription(task.description ?? "");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const updateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTaskId || !editingTitle.trim()) {
      setErrorMessage("Indique o título da tarefa.");
      return;
    }

    setBusyAction(`update-${editingTaskId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch(`/tasks/${editingTaskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editingTitle.trim(),
          description: editingDescription.trim() || null,
        }),
      });
      setEditingTaskId(null);
      await loadTasks();
      setSuccessMessage("Tarefa atualizada.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar a tarefa.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    setBusyAction(`delete-${taskId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
      await loadTasks();
      setSuccessMessage("Tarefa desativada.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível desativar a tarefa.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const approveSubmission = async (submissionId: string) => {
    setBusyAction(`approve-${submissionId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await apiFetch(`/tasks/submissions/${submissionId}/approve`, { method: "POST" });
      await loadTasks();
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
      await apiFetch(`/tasks/submissions/${rejectingSubmissionId}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejection_note: rejectionNote.trim() || null }),
      });
      setRejectingSubmissionId(null);
      setRejectionNote("");
      await loadTasks();
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
      const response = await apiFetch<{ approved: number }>("/tasks/submissions/approve-all", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadTasks();
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
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#5f6800]">
                Gestão de tarefas
              </p>
              <h1 className="mt-1 font-montserrat text-2xl font-bold text-[#003514] sm:text-3xl">
                Tarefas
              </h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={loadTasks}
              disabled={loading || actionIsRunning}
              className="h-11 rounded-full border border-[#e1e2e4] px-5 text-sm font-semibold text-[#003514] hover:bg-white"
            >
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              Atualizar
            </Button>
          </header>

          <section className="grid gap-3 md:grid-cols-3">
            <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
              <p className="text-sm font-semibold text-[#404940]">Ativas</p>
              <p className="mt-2 text-3xl font-bold text-[#003514]">{activeTasks.length}</p>
            </article>
            <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
              <p className="text-sm font-semibold text-[#404940]">Submissões pendentes</p>
              <p className="mt-2 text-3xl font-bold text-[#003514]">
                {pendingSubmissions.length}
              </p>
            </article>
            <article className="rounded-lg border border-[#e1e2e4] bg-white p-5">
              <p className="text-sm font-semibold text-[#404940]">Crianças ativas</p>
              <p className="mt-2 text-3xl font-bold text-[#003514]">{children.length}</p>
            </article>
          </section>

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

          <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <form
              onSubmit={createTask}
              className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]"
            >
              <h2 className="text-lg font-bold text-[#003514]">Nova tarefa</h2>
              <div className="mt-5 grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-child" className="text-[#404940]">Criança</Label>
                  <select
                    id="task-child"
                    value={taskForm.childId}
                    onChange={(event) =>
                      setTaskForm((currentForm) => ({
                        ...currentForm,
                        childId: event.target.value,
                      }))
                    }
                    disabled={actionIsRunning || children.length === 0}
                    className="h-12 w-full rounded-lg border border-[#e1e2e4] bg-white px-3 text-sm font-semibold text-[#191c1e] outline-none focus:border-[#003514] focus:ring-[3px] focus:ring-[#003514]/15"
                  >
                    {children.length === 0 ? <option value="">Sem crianças ativas</option> : null}
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-title" className="text-[#404940]">Título</Label>
                  <Input
                    id="task-title"
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((currentForm) => ({
                        ...currentForm,
                        title: event.target.value,
                      }))
                    }
                    disabled={actionIsRunning}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-description" className="text-[#404940]">Descrição</Label>
                  <Input
                    id="task-description"
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((currentForm) => ({
                        ...currentForm,
                        description: event.target.value,
                      }))
                    }
                    disabled={actionIsRunning}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-[#e1e2e4] text-sm font-semibold text-[#003514] has-[:checked]:border-[#003514] has-[:checked]:bg-[#003514] has-[:checked]:text-white">
                    <input
                      type="radio"
                      name="task-type"
                      value="duty"
                      checked={taskForm.taskType === "duty"}
                      onChange={() =>
                        setTaskForm((currentForm) => ({
                          ...currentForm,
                          rewardAmount: "0.00",
                          taskType: "duty",
                        }))
                      }
                      className="sr-only"
                    />
                    Rotina
                  </label>
                  <label className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-[#e1e2e4] text-sm font-semibold text-[#003514] has-[:checked]:border-[#003514] has-[:checked]:bg-[#003514] has-[:checked]:text-white">
                    <input
                      type="radio"
                      name="task-type"
                      value="extra_task"
                      checked={taskForm.taskType === "extra_task"}
                      onChange={() =>
                        setTaskForm((currentForm) => ({
                          ...currentForm,
                          rewardAmount: "1.00",
                          taskType: "extra_task",
                        }))
                      }
                      className="sr-only"
                    />
                    Extra
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="task-reward" className="text-[#404940]">Recompensa</Label>
                    <Input
                      id="task-reward"
                      type="number"
                      min="0"
                      step="0.01"
                      value={taskForm.rewardAmount}
                      onChange={(event) =>
                        setTaskForm((currentForm) => ({
                          ...currentForm,
                          rewardAmount: event.target.value,
                        }))
                      }
                      disabled={actionIsRunning || taskForm.taskType === "duty"}
                      className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-expires" className="text-[#404940]">Expira em</Label>
                    <Input
                      id="task-expires"
                      type="datetime-local"
                      value={taskForm.expiresAt}
                      onChange={(event) =>
                        setTaskForm((currentForm) => ({
                          ...currentForm,
                          expiresAt: event.target.value,
                        }))
                      }
                      disabled={actionIsRunning}
                      className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={actionIsRunning || children.length === 0}
                className="mt-5 h-11 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                {busyAction === "create-task" ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="mr-2 size-4" aria-hidden="true" />
                )}
                Criar tarefa
              </Button>
            </form>

            <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#003514]">Lista de tarefas</h2>
                  <p className="mt-1 text-sm text-[#404940]">Tarefas criadas para as crianças.</p>
                </div>
                <ClipboardList className="size-5 text-[#404940]" aria-hidden="true" />
              </div>

              <div className="mt-5 divide-y divide-[#e1e2e4]">
                {loading ? (
                  <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                    A carregar tarefas...
                  </p>
                ) : tasks.length > 0 ? (
                  tasks.map((task) => (
                    <article key={task.id} className="py-4 first:pt-0 last:pb-0">
                      {editingTaskId === task.id ? (
                        <form onSubmit={updateTask} className="grid gap-3">
                          <Input
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            disabled={actionIsRunning}
                            className="h-11 rounded-lg border-[#e1e2e4] bg-white"
                          />
                          <Input
                            value={editingDescription}
                            onChange={(event) => setEditingDescription(event.target.value)}
                            disabled={actionIsRunning}
                            className="h-11 rounded-lg border-[#e1e2e4] bg-white"
                          />
                          <div className="flex gap-2">
                            <Button type="submit" disabled={actionIsRunning} className="h-9 rounded-full bg-[#d4e251] px-4 text-xs font-semibold text-[#003514] hover:bg-[#cfdc42]">
                              Guardar
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setEditingTaskId(null)} disabled={actionIsRunning} className="h-9 rounded-full px-4 text-xs font-semibold text-[#404940]">
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-[#191c1e]">{task.title}</h3>
                              <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-[#404940]">
                                {taskTypeLabels[task.task_type] ?? task.task_type}
                              </span>
                              {!task.is_active ? (
                                <span className="rounded-full bg-[#fff4de] px-2.5 py-1 text-xs font-semibold text-[#7a4100]">
                                  Inativa
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-[#404940]">
                              {childNameById.get(task.child_id) ?? "Criança"} · {formatMoney(task.reward_amount)}
                            </p>
                            {task.description ? (
                              <p className="mt-1 text-sm text-[#59625a]">{task.description}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button type="button" variant="ghost" onClick={() => startEditTask(task)} disabled={actionIsRunning} className="h-9 rounded-full px-3 text-xs font-semibold text-[#003514] hover:bg-[#f3f4f6]">
                              Editar
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => deleteTask(task.id)} disabled={actionIsRunning || !task.is_active} className="h-9 rounded-full px-3 text-xs font-semibold text-[#7a4100] hover:bg-[#fff4de] hover:text-[#7a4100] disabled:opacity-50">
                              {busyAction === `delete-${task.id}` ? <LoaderCircle className="mr-2 size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="mr-2 size-3.5" aria-hidden="true" />}
                              Desativar
                            </Button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                    Ainda não existem tarefas.
                  </p>
                )}
              </div>
            </section>
          </section>

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
              {submissions.length > 0 ? (
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

export default TasksPage;
