/**
 * 统一 API 客户端。
 * 开发态走 vite /api 代理（见 vite.config.ts），
 * 容器内由 nginx 把 /api 反代到 backend:3000（见 nginx.conf）。
 */

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['x-family-token'] = token;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      data?.message
        ? Array.isArray(data.message)
          ? data.message.join('；')
          : String(data.message)
        : `请求失败（${res.status}）`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  // 工作人员端
  listElders: () => request<import('./types').Elder[]>('/staff/elders'),
  createElder: (body: unknown) =>
    request<import('./types').Elder>('/staff/elders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listContacts: (elderId: string) =>
    request<import('./types').Contact[]>(`/staff/elders/${elderId}/contacts`),
  addContact: (elderId: string, body: unknown) =>
    request<import('./types').Contact>(
      `/staff/elders/${elderId}/contacts`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  updateContact: (elderId: string, contactId: string, body: unknown) =>
    request<import('./types').Contact>(
      `/staff/elders/${elderId}/contacts/${contactId}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
  toggleContact: (elderId: string, contactId: string, enabled: boolean) =>
    request<import('./types').Contact>(
      `/staff/elders/${elderId}/contacts/${contactId}/toggle`,
      { method: 'PATCH', body: JSON.stringify({ enabled }) },
    ),
  deleteContact: (elderId: string, contactId: string) =>
    request<{ ok: boolean }>(
      `/staff/elders/${elderId}/contacts/${contactId}`,
      { method: 'DELETE' },
    ),
  reorderContacts: (elderId: string, orderedContactIds: string[]) =>
    request<import('./types').Contact[]>(
      `/staff/elders/${elderId}/contacts/reorder`,
      { method: 'POST', body: JSON.stringify({ orderedContactIds }) },
    ),
  familyBindings: (elderId: string) =>
    request<import('./types').FamilyBinding[]>(
      `/staff/elders/${elderId}/family-bindings`,
    ),

  listEvents: (elderId?: string) =>
    request<import('./types').EventItem[]>(
      `/staff/events${elderId ? `?elderId=${elderId}` : ''}`,
    ),
  triggerEvent: (body: unknown) =>
    request<import('./types').EventItem>('/staff/events', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getEvent: (eventId: string) =>
    request<import('./types').EventDetail>(`/staff/events/${eventId}`),
  startCascade: (eventId: string) =>
    request<import('./types').EventItem>(
      `/staff/events/${eventId}/cascade`,
      { method: 'POST' },
    ),
  settleCall: (
    eventId: string,
    attemptId: string,
    body: { outcome: string; talkSeconds?: number; note?: string },
  ) =>
    request<{ ok: boolean }>(
      `/staff/events/${eventId}/attempts/${attemptId}/settle`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  resolveEvent: (eventId: string, resolution: string) =>
    request<{ ok: boolean }>(`/staff/events/${eventId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    }),
  staffReport: (eventId: string) =>
    request<import('./types').StaffReport>(
      `/staff/events/${eventId}/report`,
    ),

  // 家属 H5 端
  familyMe: (token: string) =>
    request<import('./types').FamilyMe>('/family/me', {}, token),
  familyEvents: (token: string) =>
    request<import('./types').FamilyEventListItem[]>('/family/events', {}, token),
  familyReport: (token: string, eventId: string) =>
    request<import('./types').FamilyReport>(
      `/family/events/${eventId}/report`,
      {},
      token,
    ),
};
