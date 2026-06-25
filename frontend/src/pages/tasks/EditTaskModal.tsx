import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Plus,
  Save,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/useToast";
import { eurosToPoints } from "@/lib/points";
import { updateTask as updateTaskRequest } from "@/services/taskService";
import type { TaskResponse } from "@/services/types";

type EditTaskModalProps = {
  task: TaskResponse;
  pointValueEur: number;
  onClose: () => void;
  onSaved: (message: string) => void;
};

const typeLabels: Record<string, string> = { duty: "Rotina", extra_task: "Extra" };

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

// Split a stored ISO expiry into local date (YYYY-MM-DD) + time (HH:MM) inputs.
const splitExpiry = (iso: string | null) => {
  if (!iso) {
    return { date: "", time: "" };
  }
  const value = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
};

const EditTaskModal = ({
  task,
  pointValueEur,
  onClose,
  onSaved,
}: EditTaskModalProps) => {
  const { showToast } = useToast();
  const isExtra = task.task_type === "extra_task";
  const initialExpiry = splitExpiry(task.expires_at);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [descriptionVisible, setDescriptionVisible] = useState(
    Boolean(task.description),
  );
  const [rewardAmount, setRewardAmount] = useState(
    isExtra ? (Number(task.reward_amount) * pointValueEur).toFixed(2) : "0.00",
  );
  const [expiresDate, setExpiresDate] = useState(initialExpiry.date);
  const [expiresTime, setExpiresTime] = useState(initialExpiry.time);
  const [expiresVisible, setExpiresVisible] = useState(Boolean(task.expires_at));
  const [submitting, setSubmitting] = useState(false);

  // Collapsing only hides the field and keeps any typed value; collapsed fields
  // are excluded (cleared) at save time — same rules as the create modal.
  const hideDescription = () => setDescriptionVisible(false);
  const hideExpires = () => setExpiresVisible(false);

  const adjustReward = (delta: number) =>
    setRewardAmount((current) => Math.max(0, (Number(current) || 0) + delta).toFixed(2));

  const adjustRewardPoints = (delta: number) =>
    setRewardAmount((current) => {
      const nextPoints = Math.max(0, eurosToPoints(current, pointValueEur) + delta);
      return (nextPoints * pointValueEur).toFixed(2);
    });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast("Indique o título da tarefa.", "error");
      return;
    }

    const rewardPoints = eurosToPoints(rewardAmount, pointValueEur);
    if (isExtra && rewardPoints <= 0) {
      showToast("A recompensa de uma tarefa extra deve ser maior que 0.", "error");
      return;
    }

    setSubmitting(true);

    try {
      await updateTaskRequest(task.id, {
        title: trimmedTitle,
        description: descriptionVisible ? description.trim() || null : null,
        expires_at: expiresVisible ? buildExpiresAt(expiresDate, expiresTime) : null,
        ...(isExtra ? { reward_amount: rewardPoints } : {}),
      });
      onSaved("Tarefa atualizada.");
    } catch (caughtError) {
      showToast(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar a tarefa.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Editar tarefa"
      subtitle={typeLabels[task.task_type] ?? task.task_type}
      onClose={onClose}
      closeDisabled={submitting}
    >
      <form onSubmit={save} className="mt-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-task-title" className="text-[#404940]">Título</Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={submitting}
              className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
            />
          </div>

          {descriptionVisible ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-task-description" className="text-[#404940]">Descrição</Label>
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
                id="edit-task-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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

          {isExtra ? (
            <div className="space-y-2">
              <Label htmlFor="edit-task-reward" className="text-[#404940]">Recompensa</Label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Input
                    id="edit-task-reward"
                    type="text"
                    inputMode="decimal"
                    value={rewardAmount}
                    onChange={(event) => setRewardAmount(event.target.value)}
                    onBlur={(event) =>
                      setRewardAmount(
                        event.target.value === ""
                          ? ""
                          : (Number(event.target.value) || 0).toFixed(2),
                      )
                    }
                    disabled={submitting}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white pr-14 text-right text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                  <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#404940]">
                    €
                  </span>
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col">
                    <button type="button" onClick={() => adjustReward(1)} disabled={submitting} aria-label="Aumentar recompensa em euros" className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60">
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => adjustReward(-1)} disabled={submitting} aria-label="Diminuir recompensa em euros" className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60">
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <ArrowLeftRight className="size-5 shrink-0 text-[#404940]" aria-hidden="true" />

                <div className="relative flex-1">
                  <Input
                    id="edit-task-reward-points"
                    type="text"
                    inputMode="numeric"
                    value={
                      rewardAmount === ""
                        ? ""
                        : String(eurosToPoints(rewardAmount, pointValueEur))
                    }
                    onChange={(event) => {
                      const raw = event.target.value;
                      setRewardAmount(
                        raw === "" ? "" : ((Number(raw) || 0) * pointValueEur).toFixed(2),
                      );
                    }}
                    disabled={submitting}
                    className="h-12 rounded-lg border-[#e1e2e4] bg-white pr-16 text-right text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                  />
                  <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#404940]">
                    pts
                  </span>
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col">
                    <button type="button" onClick={() => adjustRewardPoints(1)} disabled={submitting} aria-label="Aumentar recompensa em pontos" className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60">
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => adjustRewardPoints(-1)} disabled={submitting} aria-label="Diminuir recompensa em pontos" className="flex h-5 w-6 items-center justify-center rounded text-[#404940] hover:bg-[#f3f4f6] disabled:opacity-60">
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
                  id="edit-task-expires-date"
                  type="date"
                  value={expiresDate}
                  onChange={(event) => setExpiresDate(event.target.value)}
                  disabled={submitting}
                  className="h-12 rounded-lg border-[#e1e2e4] bg-white text-[#191c1e] focus-visible:border-[#003514] focus-visible:ring-[#003514]/15"
                />
                <Input
                  id="edit-task-expires-time"
                  type="time"
                  step={60}
                  value={expiresTime}
                  onChange={(event) => setExpiresTime(event.target.value)}
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
            disabled={submitting}
            className="h-11 flex-1 rounded-full bg-[#d4e251] px-5 text-sm font-semibold text-[#003514] hover:bg-[#cfdc42] disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="mr-2 size-4" aria-hidden="true" />
            )}
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditTaskModal;
