import { apiFetch } from "@/lib/api";

export type CreateChildPayload = {
  avatar_url: string | null;
  birth_date: string | null;
  name: string;
};

export const createChild = (payload: CreateChildPayload) =>
  apiFetch("/profiles/children", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateFamilyName = (familyName: string) =>
  apiFetch("/profiles/family-name", {
    method: "PATCH",
    body: JSON.stringify({ family_name: familyName }),
  });

export type ChildGoalPayload = {
  goal_description: string | null;
  goal_title: string | null;
  reward_amount: string | null;
};

export const updateChildGoal = (childId: string, payload: ChildGoalPayload) =>
  apiFetch(`/profiles/children/${childId}/goal`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
