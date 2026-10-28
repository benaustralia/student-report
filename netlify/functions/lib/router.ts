// The /api router. One function handles every route so a single `_redirects` rule
// (/api/* → this function) is all the routing Netlify has to do.
import { handleAiDraft } from './ai.ts';
import { handleData } from './data.ts';
import type { Db } from './db.ts';
import { handleFiles, type FileStore } from './files.ts';
import { HttpError, json } from './http.ts';
import { handleRpc } from './rpc.ts';
import { type IdentityResolver, requireUser, resolveUser } from './session.ts';

export interface RouterDeps {
  db: Db;
  identity: IdentityResolver;
  /** Handles /api/auth/* (Better Auth). */
  authHandler: (req: Request) => Promise<Response>;
  store?: FileStore;
}

/** Netlify may hand us the original URL or the rewritten function URL; make both look like /api/... */
export const normaliseUrl = (raw: string): URL => {
  const url = new URL(raw);
  url.pathname = url.pathname.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
  return url;
};

export const route = async (req: Request, deps: RouterDeps): Promise<Response> => {
  try {
    const url = normaliseUrl(req.url);
    const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const [head, ...rest] = segments;
    if (!head) throw new HttpError(404, 'Not found');

    if (head === 'auth') {
      // Better Auth matches on the URL, so hand it the /api/... form. Rebuild explicitly:
      // Node refuses `new Request(url, req)` when the body is a stream.
      const forwarded = url.href === req.url ? req : new Request(url, {
        method: req.method,
        headers: req.headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
      });
      return await deps.authHandler(forwarded);
    }

    if (head === 'me') {
      const user = await resolveUser(deps.db, deps.identity, req);
      if (!user) throw new HttpError(401, 'Sign in required');
      return json(user);
    }

    const user = await requireUser(deps.db, deps.identity, req);
    switch (head) {
      case 'data': return await handleData(deps.db, user, req, rest, url);
      case 'rpc': return await handleRpc(deps.db, user, req, rest[0] ?? '');
      case 'files': return await handleFiles(req, rest.join('/'), deps.store);
      case 'ai-draft': return await handleAiDraft(req);
      default: throw new HttpError(404, 'Not found');
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('[api] unhandled', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
};
