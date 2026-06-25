import { ClockIcon, PersonIcon, PlusIcon, ReloadIcon, StarIcon, TrashIcon, UpdateIcon } from "@radix-ui/react-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/NavbarMobile";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/lib/points";
import { getPointValue } from "@/services/profileService";
import {
  deleteTask as deleteTaskRequest,
  listTasks,
} from "@/services/taskService";
import type { TaskResponse } from "@/services/types";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/context/useToast";
import CreateTaskModal from "./CreateTaskModal";
import EditTaskModal from "./EditTaskModal";

const formatExpiry = (value: string) =>
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

const TasksPage = () => {
  const { familyProfile } = useAuth();
  const { showToast } = useToast();
  const children = useMemo(
    () => familyProfile?.children.filter((child) => child.is_active) ?? [],
    [familyProfile?.children],
  );
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pointValueEur, setPointValueEur] = useState(0.01);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [taskView, setTaskView] = useState<"duty" | "extra_task">("duty");

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

  const dutyTasks = useMemo(
    () => tasks.filter((task) => task.task_type === "duty"),
    [tasks],
  );
  const extraTasks = useMemo(
    () => tasks.filter((task) => task.task_type === "extra_task"),
    [tasks],
  );
  const visibleTasks = taskView === "duty" ? dutyTasks : extraTasks;

  const loadTasks = useCallback(async () => {
    setLoading(true);

    try {
      setTasks(await listTasks());
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
  }, [showToast]);

  useEffect(() => {
    // Synchronizes async server state with this page's local task list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks();
  }, [loadTasks]);

  const handleCreated = (message: string) => {
    showToast(message);
    setCreateModalOpen(false);
    void loadTasks();
  };

  const startEditTask = (task: TaskResponse) => {
    setEditingTask(task);
  };

  const handleEdited = (message: string) => {
    showToast(message);
    setEditingTask(null);
    void loadTasks();
  };

  const deleteTask = async (taskId: string) => {
    setBusyAction(`delete-${taskId}`);

    try {
      await deleteTaskRequest(taskId);
      await loadTasks();
      showToast("Tarefa eliminada.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível eliminar a tarefa.",
        "error",
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
              <ReloadIcon
                className={`size-5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </Button>
          </header>

          {createModalOpen ? (
            <CreateTaskModal
              activeChildren={children}
              pointValueEur={pointValueEur}
              onClose={() => setCreateModalOpen(false)}
              onCreated={handleCreated}
            />
          ) : null}

          {editingTask ? (
            <EditTaskModal
              task={editingTask}
              pointValueEur={pointValueEur}
              onClose={() => setEditingTask(null)}
              onSaved={handleEdited}
            />
          ) : null}

          <section className="rounded-lg border border-[#e1e2e4] bg-white p-5 shadow-[0px_4px_20px_rgba(3,78,34,0.05)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-[#003514]">Lista de tarefas</h2>
                <div className="inline-flex rounded-full border border-[#e1e2e4] bg-[#f8f9fb] p-1">
                  <button
                    type="button"
                    onClick={() => setTaskView("duty")}
                    className={segmentClass(taskView === "duty")}
                  >
                    Rotinas ({dutyTasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView("extra_task")}
                    className={segmentClass(taskView === "extra_task")}
                  >
                    Extra ({extraTasks.length})
                  </button>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                disabled={children.length === 0}
                className="h-10 shrink-0 rounded-full bg-[#d4e251] px-4 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
              >
                <PlusIcon className="mr-2 size-4" aria-hidden="true" />
                Nova tarefa
              </Button>
            </div>

            <div className="mt-5 divide-y divide-[#e1e2e4]">
              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-[#404940]">
                  A carregar tarefas...
                </p>
              ) : visibleTasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <article key={task.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-[#191c1e]">{task.title}</h3>
                            {task.task_type === "extra_task" ? (
                              <span className="flex items-center gap-1.5 rounded-full bg-[#eef7d1] px-2.5 py-1 text-xs font-semibold text-[#5f6800]">
                                <StarIcon className="size-3.5" aria-hidden="true" />
                                {formatEuros(Number(task.reward_amount) * pointValueEur)} (
                                {Number(task.reward_amount).toLocaleString("pt-PT")} pts)
                              </span>
                            ) : null}
                          </div>
                          {task.description ? (
                            <p className="mt-1.5 text-sm text-[#59625a]">{task.description}</p>
                          ) : (
                            <p className="mt-1.5 text-sm italic text-[#9aa39b]">Sem descrição</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                            <span className={metaItemClass}>
                              <PersonIcon className="size-4 text-[#7a8278]" aria-hidden="true" />
                              {childNameById.get(task.child_id) ?? "Criança"}
                            </span>
                            {task.expires_at ? (
                              (() => {
                                const expired = new Date(task.expires_at) < new Date();
                                return (
                                  <span
                                    className={`flex items-center gap-1.5 text-sm ${
                                      expired ? "font-semibold text-[#7a4100]" : "text-[#404940]"
                                    }`}
                                  >
                                    <ClockIcon
                                      className={`size-4 ${expired ? "text-[#7a4100]" : "text-[#7a8278]"}`}
                                      aria-hidden="true"
                                    />
                                    {expired ? "Expirou " : ""}
                                    {formatExpiry(task.expires_at)}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className={metaItemClass}>
                                <ClockIcon className="size-4 text-[#7a8278]" aria-hidden="true" />
                                sem prazo
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button type="button" variant="ghost" onClick={() => startEditTask(task)} disabled={actionIsRunning} className="h-9 rounded-full px-3 text-xs font-semibold text-[#003514] hover:bg-[#f3f4f6]">
                            Editar
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => deleteTask(task.id)} disabled={actionIsRunning} className="h-9 rounded-full px-3 text-xs font-semibold text-[#7a4100] hover:bg-[#fff4de] hover:text-[#7a4100] disabled:opacity-50">
                            {busyAction === `delete-${task.id}` ? <UpdateIcon className="mr-2 size-3.5 animate-spin" aria-hidden="true" /> : <TrashIcon className="mr-2 size-3.5" aria-hidden="true" />}
                            Eliminar
                          </Button>
                        </div>
                      </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg bg-[#f3f4f6] px-4 py-6 text-center text-sm font-semibold text-[#404940]">
                  {taskView === "duty" ? "Sem rotinas." : "Sem tarefas extra."}
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
