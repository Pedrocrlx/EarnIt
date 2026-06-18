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

const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || undefined;
};

const buildHeaders = (options: RequestInit) => {
  const headers = new Headers(options.headers);
  const bodyIsFormData = options.body instanceof FormData;

  if (!headers.has("Content-Type") && !bodyIsFormData) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
};

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? "include",
    headers: buildHeaders(options),
  });

  if (!response.ok) {
    const errorData = await parseResponseBody(response).catch(() => ({}));
    throw new ApiError(getErrorMessage(errorData), response.status, errorData);
  }

  return parseResponseBody(response) as Promise<T>;
}
