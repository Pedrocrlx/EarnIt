import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eurosToPoints } from "@/lib/points";
import { createTask as createTaskRequest } from "@/services/taskService";
import type { TaskType } from "@/services/types";

type CreateTaskModalProps = {
  activeChildren: { id: string; name: string }[];
  pointValueEur: number;
  onClose: () => void;
  onCreated: (message: string) => void;
};

type CreateTaskForm = {
  childIds: string[];
  description: string;
  expiresDate: string;
  expiresTime: string;
  rewardAmount: string;
  taskType: TaskType;
  title: string;
};

const initialTaskForm: CreateTaskForm = {
  childIds: [],
  description: "",
  expiresDate: "",
  expiresTime: "",
  rewardAmount: "0.00",
  taskType: "duty",
  title: "",
};

const childChipClass = (active: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
    active
      ? "border-[#003514] bg-[#003514] text-white"
      : "border-[#e1e2e4] text-[#003514] hover:bg-[#f3f4f6]"
  }`;

const disclosureButtonClass =
  "flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#cbd5d0] text-sm font-semibold text-[#003514] transition-colors hover:bg-[#f3f4f6] disabled:opacity-60";

// Build the expiry ISO string from separate date/hour inputs. Missing hour
// defaults to end of day (23:59); missing date defaults to today.
const buildExpiresAt = (date: string, time: string): string | null => {
  if (!date && !time) {
    return null;
  }
  const day = date || new Date().toISOString().slice(0, 10);
  const hour = time || "23:59";
  return new Date(`${day}T${hour}`).toISOString();
};

const CreateTaskModal = ({
  activeChildren,
  pointValueEur,
  onClose,
  onCreated,
}: CreateTaskModalProps) => {
  const [taskForm, setTaskForm] = useState<CreateTaskForm>(initialTaskForm);
  const [descriptionVisible, setDescriptionVisible] = useState(false);
  const [expiresVisible, setExpiresVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedChildIds = taskForm.childIds;
  const allChildrenSelected =
    activeChildren.length > 0 && selectedChildIds.length === activeChildren.length;

  // Collapsing only hides the field and keeps any typed value, so an accidental
  // collapse is not destructive. Collapsed fields are excluded at submit time.
  const hideDescription = () => setDescriptionVisible(false);
  const hideExpires = () => setExpiresVisible(false);

  const toggleChild = (childId: string) =>
    setTaskForm((currentForm) => ({
      ...currentForm,
      childIds: currentForm.childIds.includes(childId)
        ? currentForm.childIds.filter((id) => id !== childId)
        : [...currentForm.childIds, childId],
    }));

  const toggleAllChildren = () =>
    setTaskForm((currentForm) => ({
      ...currentForm,
      childIds:
        currentForm.childIds.length === activeChildren.length
          ? []
          : activeChildren.map((child) => child.id),
    }));

  // Step the reward by whole euros and keep it formatted to 2 decimals (e.g. 2.00).
  const adjustReward = (delta: number) =>
    setTaskForm((currentForm) => {
      const next = Math.max(0, (Number(currentForm.rewardAmount) || 0) + delta);
      return { ...currentForm, rewardAmount: next.toFixed(2) };
    });

  // Step the reward by whole points; euros stays the canonical stored value.
  const adjustRewardPoints = (delta: number) =>
    setTaskForm((currentForm) => {
      const nextPoints = Math.max(
        0,
        eurosToPoints(currentForm.rewardAmount, pointValueEur) + delta,
      );
      return { ...currentForm, rewardAmount: (nextPoints * pointValueEur).toFixed(2) };
    });

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskForm.title.trim();
    const childIds = taskForm.childIds;
    if (!title || childIds.length === 0) {
      setErrorMessage("Escolha pelo menos uma criança e indique o título da tarefa.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const rewardAmount =
      taskForm.taskType === "duty"
        ? "0"
        : String(eurosToPoints(taskForm.rewardAmount, pointValueEur));

    try {
      // One task per selected child (the backend creates per-child).
      await Promise.all(
        childIds.map((childId) =>
          createTaskRequest({
            child_id: childId,
            title,
            description: descriptionVisible ? taskForm.description.trim() || null : null,
            task_type: taskForm.taskType,
            reward_amount: rewardAmount,
            expires_at: expiresVisible
              ? buildExpiresAt(taskForm.expiresDate, taskForm.expiresTime)
              : null,
          }),
        ),
      );
      onCreated(childIds.length > 1 ? "Tarefas criadas." : "Tarefa criada.");
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error ? caughtError.message : "Não foi possível criar a tarefa.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Nova tarefa" onClose={onClose} closeDisabled={submitting}>
      {errorMessage ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={createTask} className="mt-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="text-[#404940]">Crianças</Label>
              {activeChildren.length === 0 ? (
                <p className="text-sm font-semibold text-[#7a4100]">Sem crianças ativas.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleAllChildren}
                    disabled={submitting}
                    aria-pressed={allChildrenSelected}
                    className={childChipClass(allChildrenSelected)}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Todas
                  </button>
                  {activeChildren.map((child) => {
                    const isSelected = selectedChildIds.includes(child.id);
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => toggleChild(child.id)}
                        disabled={submitting}
                        aria-pressed={isSelected}
                        className={childChipClass(isSelected)}
                      >
                        {isSelected ? (
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                        ) : null}
                        {child.name}
                      </button>
                    );
                  })}
                </div>
              )}
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
                disabled={submitting}
                className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
              />
            </div>

            {descriptionVisible ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task-description" className="text-[#404940]">Descrição</Label>
                  <button
                    type="button"
                    onClick={hideDescription}
                    disabled={submitting}
                    className="text-xs font-semibold text-[#7a4100] hover:underline disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
                <textarea
                  id="task-description"
                  rows={3}
                  value={taskForm.description}
                  onChange={(event) =>
                    setTaskForm((currentForm) => ({
                      ...currentForm,
                      description: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  className="w-full resize-y rounded-lg border border-[#e1e2e4] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none focus-visible:border-[#003514] focus-visible:ring-[3px] focus-visible:ring-[#003514]/15 disabled:opacity-60"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDescriptionVisible(true)}
                disabled={submitting}
                className={disclosureButtonClass}
              >
                <Plus className="size-4" aria-hidden="true" />
                Adicionar descrição
              </button>
            )}

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

            {taskForm.taskType !== "duty" ? (
              <div className="space-y-2">
                <Label htmlFor="task-reward" className="text-[#404940]">Recompensa</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      id="task-reward"
                      type="text"
                      inputMode="decimal"
                      value={taskForm.rewardAmount}
                      onChange={(event) =>
                        setTaskForm((currentForm) => ({
                          ...currentForm,
                          rewardAmount: event.target.value,
                        }))
                      }
                      onBlur={(event) =>
                        setTaskForm((currentForm) => ({
                          ...currentForm,
                          rewardAmount:
                            event.target.value === ""
                              ? ""
                              : (Number(event.target.value) || 0).toFixed(2),
                        }))
                      }
                      disabled={submitting}
                      className="h-12 rounded-lg border-[#e1e2e4] bg-white pr-14 text-right text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                    />
                    <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#404940]">
                      €
                    </span>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col">
                      <button
                        type="button"
                        onClick={() => adjustReward(1)}
                        disabled={submitting}
                        aria-label="Aumentar recompensa em euros"
                        className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60"
                      >
                        <ChevronUp className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustReward(-1)}
                        disabled={submitting}
                        aria-label="Diminuir recompensa em euros"
                        className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60"
                      >
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <ArrowLeftRight
                    className="size-5 shrink-0 text-[#404940]"
                    aria-hidden="true"
                  />

                  <div className="relative flex-1">
                    <Input
                      id="task-reward-points"
                      type="text"
                      inputMode="numeric"
                      value={
                        taskForm.rewardAmount === ""
                          ? ""
                          : String(eurosToPoints(taskForm.rewardAmount, pointValueEur))
                      }
                      onChange={(event) => {
                        const raw = event.target.value;
                        setTaskForm((currentForm) => ({
                          ...currentForm,
                          rewardAmount:
                            raw === ""
                              ? ""
                              : ((Number(raw) || 0) * pointValueEur).toFixed(2),
                        }));
                      }}
                      disabled={submitting}
                      className="h-12 rounded-lg border-[#e1e2e4] bg-white pr-16 text-right text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                    />
                    <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#404940]">
                      pts
                    </span>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col">
                      <button
                        type="button"
                        onClick={() => adjustRewardPoints(1)}
                        disabled={submitting}
                        aria-label="Aumentar recompensa em pontos"
                        className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60"
                      >
                        <ChevronUp className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustRewardPoints(-1)}
                        disabled={submitting}
                        aria-label="Diminuir recompensa em pontos"
                        className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60"
                      >
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {expiresVisible ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[#404940]">Expira em</Label>
                  <button
                    type="button"
                    onClick={hideExpires}
                    disabled={submitting}
                    className="text-xs font-semibold text-[#7a4100] hover:underline disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="task-expires-date"
                    type="date"
                    value={taskForm.expiresDate}
                    onChange={(event) =>
                      setTaskForm((currentForm) => ({
                        ...currentForm,
                        expiresDate: event.target.value,
                      }))
                    }
                    disabled={submitting}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                  <Input
                    id="task-expires-time"
                    type="time"
                    step={60}
                    value={taskForm.expiresTime}
                    onChange={(event) =>
                      setTaskForm((currentForm) => ({
                        ...currentForm,
                        expiresTime: event.target.value,
                      }))
                    }
                    disabled={submitting}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExpiresVisible(true)}
                disabled={submitting}
                className={disclosureButtonClass}
              >
                <Plus className="size-4" aria-hidden="true" />
                Adicionar prazo
              </button>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="h-11 flex-1 rounded-full bg-[#f3f4f6] text-sm font-semibold text-[#003514] hover:bg-[#e8eaed] hover:text-[#003514]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || activeChildren.length === 0}
              className="h-11 flex-1 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
            >
              {submitting ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="mr-2 size-4" aria-hidden="true" />
              )}
              Criar tarefa
            </Button>
          </div>
      </form>
    </Modal>
  );
};

export default CreateTaskModal;
