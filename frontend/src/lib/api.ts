export const API_BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const getErrorMessage = (data: unknown) => {
  if (!data || typeof data !== "object") {
    return "API request failed";
  }

  const errorData = data as {
    detail?: unknown;
    message?: unknown;
    error?: unknown;
  };

  if (typeof errorData.detail === "string") {
    return errorData.detail;
  }

  if (
    errorData.detail &&
    typeof errorData.detail === "object" &&
    "message" in errorData.detail &&
    typeof errorData.detail.message === "string"
  ) {
    return errorData.detail.message;
  }

  if (typeof errorData.message === "string") {
    return errorData.message;
  }

  if (typeof errorData.error === "string") {
    return errorData.error;
  }

  return "API request failed";
};

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? "include",
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(getErrorMessage(errorData), response.status, errorData);
  }

  return response.json();
}
