import { apiFetch } from "@/lib/api";
import type { SettingsResponse } from "@/services/types";

export const getSettings = () => apiFetch<SettingsResponse>("/settings");

export const updateSettings = (pointsPerEuro: number) =>
  apiFetch<SettingsResponse>("/settings", {
    method: "PATCH",
    body: JSON.stringify({ points_per_euro: pointsPerEuro }),
  });
