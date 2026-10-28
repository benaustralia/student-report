// Netlify Function entry for everything under /api (see public/_redirects).
import type { Context } from '@netlify/functions';
import { getAuth } from './lib/auth.ts';
import { getDb } from './lib/db.ts';
import { route } from './lib/router.ts';

export default async (req: Request, _context: Context): Promise<Response> => {
  const db = getDb();
  const auth = getAuth(db);
  return route(req, {
    db,
    authHandler: r => auth.handler(r),
    identity: async r => {
      const s = await auth.api.getSession({ headers: r.headers });
      return s ? { id: s.user.id, email: s.user.email, name: s.user.name ?? null } : null;
    },
  });
};
