import { apiFetch } from "@/lib/api";
import type {
  ChildTaskResponse,
  SubmissionResponse,
  TaskResponse,
  TaskType,
  WalletResponse,
} from "@/services/types";

export type CreateTaskPayload = {
  child_id: string;
  description: string | null;
  expires_at: string | null;
  reward_amount: string;
  task_type: TaskType;
  title: string;
};

export type UpdateTaskPayload = {
  description?: string | null;
  expires_at?: string | null;
  reward_amount?: number;
  title?: string;
};

export const listTasks = () => apiFetch<TaskResponse[]>("/tasks");

export const listSubmissions = () => apiFetch<SubmissionResponse[]>("/tasks/submissions");

export const createTask = (payload: CreateTaskPayload) =>
  apiFetch<TaskResponse>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateTask = (taskId: string, payload: UpdateTaskPayload) =>
  apiFetch<TaskResponse>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteTask = (taskId: string) =>
  apiFetch<TaskResponse>(`/tasks/${taskId}`, { method: "DELETE" });

export const reactivateTask = (taskId: string) =>
  apiFetch<TaskResponse>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: true }),
  });

export const approveSubmission = (submissionId: string) =>
  apiFetch<SubmissionResponse>(`/tasks/submissions/${submissionId}/approve`, {
    method: "POST",
  });

export const rejectSubmission = (submissionId: string, rejectionNote: string | null) =>
  apiFetch<SubmissionResponse>(`/tasks/submissions/${submissionId}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejection_note: rejectionNote }),
  });

export const approveAllSubmissions = () =>
  apiFetch<{ approved: number }>("/tasks/submissions/approve-all", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const listChildTasks = (childId: string) =>
  apiFetch<ChildTaskResponse[]>(`/children/${childId}/tasks`);

export const getWallet = (childId: string) =>
  apiFetch<WalletResponse>(`/children/${childId}/wallet`);

export const submitTask = (childId: string, taskId: string) =>
  apiFetch<SubmissionResponse>(`/children/${childId}/tasks/${taskId}/submit`, {
    method: "POST",
  });

export const resubmitTask = (childId: string, submissionId: string) =>
  apiFetch<SubmissionResponse>(`/children/${childId}/submissions/${submissionId}`, {
    method: "PATCH",
  });
