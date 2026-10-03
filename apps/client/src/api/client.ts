const STAFF_TOKEN_KEY = "emergency_staff_token";

export const staffToken = {
  get: () => localStorage.getItem(STAFF_TOKEN_KEY) ?? "demo-staff-token",
  set: (v: string) => localStorage.setItem(STAFF_TOKEN_KEY, v),
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFamily = path.startsWith("/api/family");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  headers[isFamily ? "x-family-token" : "x-staff-token"] = isFamily
    ? (localStorage.getItem("family_token") ?? "")
    : staffToken.get();

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message ?? `请求失败（${res.status}）`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
