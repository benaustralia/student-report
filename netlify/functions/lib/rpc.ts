// Composite operations that need to be atomic-ish or admin-gated on the server.
import { count, eq } from 'drizzle-orm';
import type { Db } from './db.ts';
import { HttpError, json, normaliseEmail, readJson } from './http.ts';
import { adminUsers, classes, reports, requests, students, teachers } from './schema.ts';
import type { AppUser } from './session.ts';

type Row = Record<string, unknown>;

const requireAdmin = (user: AppUser) => {
  if (user.role !== 'admin') throw new HttpError(403, 'Admin only');
};

/** One report per student: update it if it exists, otherwise create it. Returns the id. */
const createOrUpdateReport = async (db: Db, user: AppUser, body: Row) => {
  const studentId = typeof body.studentId === 'string' ? body.studentId : '';
  if (!studentId) throw new HttpError(400, 'studentId required');
  const teacherEmail = normaliseEmail(body.teacherEmail);
  if (user.role !== 'admin' && teacherEmail !== user.email) throw new HttpError(403, 'Cannot write a report for another teacher');

  const data = {
    classId: typeof body.classId === 'string' && body.classId ? body.classId : null,
    teacherEmail,
    reportText: typeof body.reportText === 'string' ? body.reportText : '',
    studentName: typeof body.studentName === 'string' ? body.studentName : null,
    ...(body.artworkUrl !== undefined && { artworkUrl: (body.artworkUrl as string | null) || null }),
    ...(body.pdfUrl !== undefined && { pdfUrl: (body.pdfUrl as string | null) || null }),
  };

  const existing = await db.select({ id: reports.id, teacherEmail: reports.teacherEmail })
    .from(reports).where(eq(reports.studentId, studentId)).orderBy(reports.createdAt);
  if (existing.length) {
    if (user.role !== 'admin' && normaliseEmail(existing[0].teacherEmail) !== user.email) throw new HttpError(403, 'Not your report');
    await db.update(reports).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(reports.id, existing[0].id));
    return json({ id: existing[0].id });
  }
  const [row] = await db.insert(reports).values({ studentId, ...data }).returning({ id: reports.id });
  return json({ id: row.id }, 201);
};

/** Admin approves a teacher's add/remove-student request and applies it. */
const approveRequest = async (db: Db, user: AppUser, body: Row) => {
  requireAdmin(user);
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const [request] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!request) throw new HttpError(404, 'Request not found');

  if (request.type === 'add_student' && request.studentFirstName && request.studentLastName) {
    // Same deterministic id the old app used, so re-approving is idempotent.
    const studentId = `${request.studentFirstName}-${request.studentLastName}-${request.classId.split('-')[0] || 'unknown'}`;
    await db.insert(students)
      .values({ id: studentId, firstName: request.studentFirstName, lastName: request.studentLastName, classId: request.classId || null })
      .onConflictDoUpdate({ target: students.id, set: { classId: request.classId || null, updatedAt: new Date().toISOString() } });
  } else if (request.type === 'remove_student' && request.studentId) {
    await db.delete(students).where(eq(students.id, request.studentId));
  }

  const now = new Date().toISOString();
  await db.update(requests).set({ status: 'approved', resolvedBy: user.email, resolvedAt: now, updatedAt: now }).where(eq(requests.id, requestId));
  return json({ ok: true });
};

const declineRequest = async (db: Db, user: AppUser, body: Row) => {
  requireAdmin(user);
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const now = new Date().toISOString();
  const updated = await db.update(requests).set({ status: 'declined', resolvedBy: user.email, resolvedAt: now, updatedAt: now })
    .where(eq(requests.id, requestId)).returning({ id: requests.id });
  if (!updated.length) throw new HttpError(404, 'Request not found');
  return json({ ok: true });
};

/** Headline counts for the statistics bar. Replaces four Firestore realtime listeners. */
const stats = async (db: Db) => {
  const [[admins], [teacherRows], [classRows], [studentRows]] = await Promise.all([
    db.select({ n: count() }).from(adminUsers).where(eq(adminUsers.isAdmin, true)),
    db.select({ n: count() }).from(teachers),
    db.select({ n: count() }).from(classes),
    db.select({ n: count() }).from(students),
  ]);
  return json({ userCount: admins.n + teacherRows.n, classCount: classRows.n, studentCount: studentRows.n });
};

export const handleRpc = async (db: Db, user: AppUser, req: Request, op: string): Promise<Response> => {
  if (req.method !== 'POST' && op !== 'stats') throw new HttpError(405, 'POST required');
  switch (op) {
    case 'createOrUpdateReport': return createOrUpdateReport(db, user, await readJson<Row>(req));
    case 'approveRequest': return approveRequest(db, user, await readJson<Row>(req));
    case 'declineRequest': return declineRequest(db, user, await readJson<Row>(req));
    case 'stats': return stats(db);
    default: throw new HttpError(404, `Unknown operation "${op}"`);
  }
};
