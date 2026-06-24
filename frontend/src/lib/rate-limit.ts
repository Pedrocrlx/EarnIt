import { ApiError } from "@/lib/api";

// A human wait phrase from a rate-limited (429) response. The backend puts the
// exact seconds left in `retry_after_seconds`; we round up to whole minutes, with
// a friendlier "menos de um minuto" under 60s. Reads the wait at request time —
// it does not tick down.
export const retryWaitMessage = (error: unknown): string => {
  let seconds: number | undefined;
  if (error instanceof ApiError && error.data && typeof error.data === "object") {
    const value = (error.data as { retry_after_seconds?: unknown }).retry_after_seconds;
    if (typeof value === "number") {
      seconds = value;
    }
  }

  if (!seconds || seconds <= 0) {
    return "um momento";
  }
  if (seconds < 60) {
    return "menos de um minuto";
  }
  const minutes = Math.ceil(seconds / 60);
  return `cerca de ${minutes} minuto${minutes === 1 ? "" : "s"}`;
};
