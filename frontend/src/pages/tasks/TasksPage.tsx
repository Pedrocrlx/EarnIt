import { LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuros } from "@/lib/points";
import { getPointValue } from "@/services/profileService";
import {
  deleteTask as deleteTaskRequest,
  listTasks,
  updateTask as updateTaskRequest,
} from "@/services/taskService";
import type { TaskResponse } from "@/services/types";
import { useAuth } from "@/context/useAuth";
import CreateTaskModal from "./CreateTaskModal";

const taskTypeLabels: Record<string, string> = {
  duty: "Rotina",
  extra_task: "Extra",
};

const TasksPage = () => {
  const { familyProfile } = useAuth();
  const children = useMemo(
    () => familyProfile?.children.filter((child) => child.is_active) ?? [],
    [familyProfile?.children],
  );
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingChildId, setEditingChildId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pointValueEur, setPointValueEur] = useState(0.01);
  const [createModalOpen, setCreateModalOpen] = useState(false);

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

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      setTasks(await listTasks());
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
    // Synchronizes async server state with this page's local task list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks();
  }, [loadTasks]);

  const handleCreated = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage("");
    setCreateModalOpen(false);
    void loadTasks();
  };

  const startEditTask = (task: TaskResponse) => {
    setEditingTaskId(task.id);
    setEditingChildId(task.child_id);
    setEditingTitle(task.title);
    setEditingDescription(task.description ?? "");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const updateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTaskId || !editingTitle.trim() || !editingChildId) {
      setErrorMessage("Escolha a criança e indique o título da tarefa.");
      return;
    }

    setBusyAction(`update-${editingTaskId}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateTaskRequest(editingTaskId, {
        child_id: editingChildId,
        title: editingTitle.trim(),
        description: editingDescription.trim() || null,
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
      await deleteTaskRequest(taskId);
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
                Tarefas
              </h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={loadTasks}
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

          {createModalOpen ? (
            <CreateTaskModal
              activeChildren={children}
              pointValueEur={pointValueEur}
              onClose={() => setCreateModalOpen(false)}
              onCreated={handleCreated}
            />
          ) : null}

          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#003514]">Lista de tarefas</h2>
                <p className="mt-1 text-sm text-[#404940]">Tarefas criadas para as crianças.</p>
              </div>
              <Button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                disabled={children.length === 0}
                className="h-10 shrink-0 rounded-full bg-[#d4e251] px-4 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                Nova tarefa
              </Button>
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
                        <select
                          value={editingChildId}
                          onChange={(event) => setEditingChildId(event.target.value)}
                          disabled={actionIsRunning || children.length === 0}
                          className="h-11 w-full rounded-lg border border-[#e1e2e4] bg-white px-3 text-sm font-semibold text-[#191c1e] outline-none focus:border-[#003514] focus:ring-[3px] focus:ring-[#003514]/15"
                        >
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>{child.name}</option>
                          ))}
                        </select>
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
                          placeholder="Descrição (opcional)"
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
                            {childNameById.get(task.child_id) ?? "Criança"} · {formatEuros(Number(task.reward_amount) * pointValueEur)} · {Number(task.reward_amount).toLocaleString("pt-PT")} pontos
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
      </main>
    </DashboardShell>
  );
};

export default TasksPage;
