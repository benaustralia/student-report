// Small helpers shared by every route.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const readJson = async <T = unknown>(req: Request): Promise<T> => {
  const text = await req.text();
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; }
  catch { throw new HttpError(400, 'Body is not valid JSON'); }
};

export const normaliseEmail = (email: unknown): string =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';
