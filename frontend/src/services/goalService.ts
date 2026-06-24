import { apiFetch } from "@/lib/api";
import type { Goal, GoalListResponse } from "@/services/types";

// Goals are a child's wishlist: the child requests (a free-text wish), the parent
// approves with a points target / rejects, and redeems once the balance reaches it.
// All routes are the parent session, child-scoped; the GET also returns the child's
// current balance so progress (balance vs target) is derivable.

export const listGoals = (childId: string, status?: string) =>
  apiFetch<GoalListResponse>(
    `/children/${childId}/goals${status ? `?status=${status}` : ""}`,
  );

export const requestGoal = (childId: string, name: string) =>
  apiFetch<Goal>(`/children/${childId}/goals`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const approveGoal = (childId: string, goalId: string, targetAmount: number) =>
  apiFetch<Goal>(`/children/${childId}/goals/${goalId}/approve`, {
    method: "POST",
    body: JSON.stringify({ target_amount: targetAmount }),
  });

export const rejectGoal = (childId: string, goalId: string) =>
  apiFetch<Goal>(`/children/${childId}/goals/${goalId}/reject`, { method: "POST" });

export const redeemGoal = (childId: string, goalId: string) =>
  apiFetch<Goal>(`/children/${childId}/goals/${goalId}/redeem`, { method: "POST" });
