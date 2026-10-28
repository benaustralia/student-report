// Generic collection routes: the Postgres replacement for the old Firestore CRUD factory.
//
//   GET    /api/data/:collection?field=value&field=v1&field=v2   list (equality / IN filters)
//   GET    /api/data/:collection/:id                               one row
//   POST   /api/data/:collection                                   create one (object) or many (array)
//   PATCH  /api/data/:collection/:id                               update (null clears a field)
//   DELETE /api/data/:collection/:id                               delete
//   POST   /api/data/:collection/delete-many   { ids: [] }         batch delete
//
// Who may do what is the `COLLECTIONS` policy table below, a port of firestore.rules.
import { and, eq, getTableColumns, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db } from './db.ts';
import { HttpError, json, normaliseEmail, readJson } from './http.ts';
import { adminUsers, classes, reports, requests, students, teachers } from './schema.ts';
import type { AppUser } from './session.ts';

type Write = 'admin' | 'owner' | 'any';
interface Policy { table: PgTable; read: Array<AppUser['role']>; write: Write; fkNull: string[] }

export const COLLECTIONS: Record<string, Policy> = {
  reports:    { table: reports,    read: ['admin', 'teacher'], write: 'owner', fkNull: ['studentId', 'classId'] },
  classes:    { table: classes,    read: ['admin', 'teacher'], write: 'owner', fkNull: [] },
  students:   { table: students,   read: ['admin', 'teacher'], write: 'any',   fkNull: ['classId'] },
  teachers:   { table: teachers,   read: ['admin', 'teacher'], write: 'admin', fkNull: [] },
  adminUsers: { table: adminUsers, read: ['admin'],            write: 'admin', fkNull: [] },
  requests:   { table: requests,   read: ['admin', 'teacher'], write: 'owner', fkNull: [] },
};

type Row = Record<string, unknown>;
const EMAIL_KEYS = new Set(['email', 'teacherEmail', 'resolvedBy']);

const policyFor = (name: string): Policy => {
  const p = COLLECTIONS[name];
  if (!p) throw new HttpError(404, `Unknown collection "${name}"`);
  return p;
};

const columnsOf = (p: Policy) => getTableColumns(p.table) as Record<string, PgColumn>;

/** Keep only real columns, lower-case emails, and turn '' into NULL on foreign keys. */
const clean = (p: Policy, input: Row, { forInsert }: { forInsert: boolean }): Row => {
  const cols = columnsOf(p);
  const out: Row = {};
  for (const [k, v] of Object.entries(input)) {
    if (!(k in cols)) continue;
    if (k === 'createdAt' || k === 'updatedAt') continue;
    if (k === 'id' && !forInsert) continue;
    if (v === undefined) continue;
    let value: unknown = v;
    if (EMAIL_KEYS.has(k) && typeof value === 'string') value = normaliseEmail(value);
    if (p.fkNull.includes(k) && value === '') value = null;
    if (k === 'id' && (value === '' || value === null)) continue;
    out[k] = value;
  }
  return out;
};

/** Undo the fkNull mapping so the client keeps seeing '' where Firestore used to. */
const present = (p: Policy, row: Row): Row => {
  const out = { ...row };
  for (const k of p.fkNull) if (out[k] === null) out[k] = '';
  return out;
};

const ownerOf = (row: Row | undefined) => normaliseEmail(row?.teacherEmail);

const assertCanWrite = (p: Policy, user: AppUser, existing: Row | undefined, incoming: Row) => {
  if (user.role === 'admin') return;
  if (p.write === 'admin') throw new HttpError(403, 'Admin only');
  if (p.write === 'any') return;
  // 'owner': the row must belong to the caller, before and after the write.
  if (existing && ownerOf(existing) !== user.email) throw new HttpError(403, 'Not your record');
  if ('teacherEmail' in incoming && normaliseEmail(incoming.teacherEmail) !== user.email) {
    throw new HttpError(403, 'Cannot assign a record to another teacher');
  }
  if (!existing && !('teacherEmail' in incoming)) throw new HttpError(403, 'Record must carry your teacherEmail');
};

const whereFromQuery = (p: Policy, params: URLSearchParams): SQL | undefined => {
  const cols = columnsOf(p);
  const parts: SQL[] = [];
  const grouped = new Map<string, string[]>();
  for (const [k, v] of params) {
    if (!(k in cols)) throw new HttpError(400, `Cannot filter on "${k}"`);
    grouped.set(k, [...(grouped.get(k) ?? []), EMAIL_KEYS.has(k) ? normaliseEmail(v) : v]);
  }
  for (const [k, values] of grouped) {
    const col = cols[k];
    const nullable = p.fkNull.includes(k);
    const real = values.filter(v => v !== '');
    const wantsNull = nullable && values.includes('');
    const clauses: SQL[] = [];
    if (real.length === 1) clauses.push(eq(col, real[0]));
    else if (real.length > 1) clauses.push(inArray(col, real));
    if (wantsNull) clauses.push(isNull(col));
    if (!nullable && real.length === 0) clauses.push(eq(col, ''));
    if (clauses.length) parts.push(clauses.length === 1 ? clauses[0] : or(...clauses)!);
  }
  return parts.length ? and(...parts) : undefined;
};

const fetchOne = async (db: Db, p: Policy, id: string): Promise<Row | undefined> => {
  const cols = columnsOf(p);
  const [row] = await db.select().from(p.table).where(eq(cols.id, id)).limit(1);
  return row as Row | undefined;
};

const pgError = (e: unknown): never => {
  // drizzle wraps driver errors; the Postgres code sits on the cause.
  const err = e as { code?: string; cause?: { code?: string } };
  const code = err?.code ?? err?.cause?.code;
  if (code === '23503') throw new HttpError(400, 'Referenced record does not exist');
  if (code === '23505') throw new HttpError(409, 'Duplicate record');
  throw e;
};

export const handleData = async (db: Db, user: AppUser, req: Request, segments: string[], url: URL): Promise<Response> => {
  const [name, id, action] = segments;
  if (!name) throw new HttpError(404, 'Collection required');
  const p = policyFor(name);
  const cols = columnsOf(p);
  const method = req.method.toUpperCase();

  if (!p.read.includes(user.role)) throw new HttpError(403, 'Not allowed to read this collection');

  if (method === 'GET' && !id) {
    const where = whereFromQuery(p, url.searchParams);
    const rows = await db.select().from(p.table).where(where);
    return json((rows as Row[]).map(r => present(p, r)));
  }
  if (method === 'GET') {
    const row = await fetchOne(db, p, id);
    if (!row) throw new HttpError(404, 'Not found');
    return json(present(p, row));
  }

  if (method === 'POST' && id === 'delete-many' && !action) {
    const { ids } = await readJson<{ ids?: string[] }>(req);
    if (!Array.isArray(ids) || ids.some(x => typeof x !== 'string')) throw new HttpError(400, 'ids must be an array of strings');
    if (ids.length === 0) return json({ deleted: 0 });
    if (user.role !== 'admin') {
      const rows = await db.select().from(p.table).where(inArray(cols.id, ids)) as Row[];
      for (const r of rows) assertCanWrite(p, user, r, {});
    }
    const deleted = await db.delete(p.table).where(inArray(cols.id, ids)).returning({ id: cols.id });
    return json({ deleted: deleted.length });
  }

  if (method === 'POST' && !id) {
    const body = await readJson<Row | Row[]>(req);
    const items = Array.isArray(body) ? body : [body];
    if (items.length === 0) return json({ ids: [] });
    const values = items.map(item => {
      if (!item || typeof item !== 'object') throw new HttpError(400, 'Each item must be an object');
      const v = clean(p, item, { forInsert: true });
      assertCanWrite(p, user, undefined, v);
      return v;
    });
    const inserted = await db.insert(p.table).values(values).returning({ id: cols.id }).catch(pgError);
    const ids = inserted.map(r => r.id as string);
    return json(Array.isArray(body) ? { ids } : { id: ids[0] }, 201);
  }

  if (method === 'PATCH' && id && !action) {
    const existing = await fetchOne(db, p, id);
    if (!existing) throw new HttpError(404, 'Not found');
    const v = clean(p, await readJson<Row>(req), { forInsert: false });
    assertCanWrite(p, user, existing, v);
    await db.update(p.table).set({ ...v, updatedAt: new Date().toISOString() }).where(eq(cols.id, id)).catch(pgError);
    const updated = await fetchOne(db, p, id);
    return json(present(p, updated!));
  }

  if (method === 'DELETE' && id && !action) {
    const existing = await fetchOne(db, p, id);
    if (!existing) return json({ deleted: 0 });
    assertCanWrite(p, user, existing, {});
    await db.delete(p.table).where(eq(cols.id, id));
    return json({ deleted: 1 });
  }

  throw new HttpError(405, `Unsupported ${method} on /data/${segments.join('/')}`);
};
