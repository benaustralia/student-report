// The one place the browser talks to /api. Same-origin, cookie-authenticated JSON.
// `undefined` values are sent as `null` so "clear this field" survives JSON.stringify,
// matching the old Firestore deleteField() behaviour.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const nullify = (_k: string, v: unknown) => (v === undefined ? null : v);

export const api = async <T = unknown>(path: string, init: { method?: string; json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}): Promise<T> => {
  const headers: Record<string, string> = { ...init.headers };
  let body = init.body;
  if (init.json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(init.json, nullify); }
  const res = await fetch(path, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { error: text }; } })() : null;
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Request failed: ${res.status}`);
  return data as T;
};

export const query = (params: Record<string, string | string[] | undefined>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};
