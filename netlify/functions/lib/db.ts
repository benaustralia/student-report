// One Drizzle instance per function container. Production talks to Neon over HTTP
// (no connection pool to manage in a Lambda); tests swap in a PGlite instance via `setDb`.
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.ts';

export type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | null = null;

export const getDb = (): Db => {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _db = drizzle(neon(url), { schema });
  return _db;
};

/** Test seam: point every handler at a different database (e.g. PGlite). */
export const setDb = (db: Db | null) => { _db = db; };
