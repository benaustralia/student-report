// Spin up an in-memory Postgres (PGlite), apply the generated migration SQL, and build a
// router whose identity is whatever the test says it is. No network, no Netlify, no Google.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setDb, type Db } from '../db.ts';
import type { FileStore } from '../files.ts';
import { route } from '../router.ts';
import * as schema from '../schema.ts';

const MIGRATIONS = join(import.meta.dirname, '../../../../drizzle');

export const makeTestDb = async () => {
  const pg = new PGlite();
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) await pg.exec(stmt);
  }
  const db = drizzle(pg, { schema }) as unknown as Db;
  setDb(db);
  return { db, pg };
};

export const memoryStore = (): FileStore & { map: Map<string, { data: ArrayBuffer; metadata: Record<string, string> }> } => {
  const map = new Map<string, { data: ArrayBuffer; metadata: Record<string, string> }>();
  return {
    map,
    async set(key, data, { metadata }) { map.set(key, { data, metadata }); },
    async getWithMetadata(key) { const v = map.get(key); return v ? { data: v.data, metadata: v.metadata } : null; },
    async getMetadata(key) { const v = map.get(key); return v ? { metadata: v.metadata } : null; },
    async delete(key) { map.delete(key); },
  };
};

export interface Caller { id: string; email: string; name?: string }

/** A fetch-like function that calls the router as `caller` (or anonymously). */
export const client = (db: Db, store: FileStore = memoryStore()) =>
  (caller: Caller | null) =>
    (path: string, init: RequestInit & { json?: unknown } = {}) => {
      const headers = new Headers(init.headers);
      let body = init.body;
      if (init.json !== undefined) { headers.set('content-type', 'application/json'); body = JSON.stringify(init.json); }
      const req = new Request(`http://localhost${path}`, { ...init, headers, body });
      return route(req, {
        db,
        store,
        identity: async () => (caller ? { id: caller.id, email: caller.email, name: caller.name ?? null } : null),
        authHandler: async () => new Response('auth stub', { status: 200 }),
      });
    };

export const expectJson = async <T = unknown>(res: Response, status = 200): Promise<T> => {
  const text = await res.text();
  if (res.status !== status) throw new Error(`Expected ${status}, got ${res.status}: ${text}`);
  return text ? JSON.parse(text) as T : (undefined as T);
};
