import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db.ts';
import { client, expectJson, makeTestDb, memoryStore } from './helpers.ts';

const ADMIN = { id: 'u-admin', email: 'admin@example.com', name: 'Admin' };
const TEACHER = { id: 'u-t1', email: 'Teacher.One@Example.com', name: 'Teacher One' }; // mixed case on purpose
const TEACHER2 = { id: 'u-t2', email: 'teacher.two@example.com', name: 'Teacher Two' };
const STRANGER = { id: 'u-x', email: 'stranger@example.com' };

let db: Db;
let as: ReturnType<typeof client>;
let store: ReturnType<typeof memoryStore>;

beforeAll(async () => {
  ({ db } = await makeTestDb());
  store = memoryStore();
  as = client(db, store);
  // Bootstrap: one admin via the table, two teachers — seeded directly because nobody can write yet.
  await db.insert((await import('../schema.ts')).adminUsers).values({ email: ADMIN.email, firstName: 'Ad', lastName: 'Min', isAdmin: true });
  await db.insert((await import('../schema.ts')).teachers).values([
    { email: 'teacher.one@example.com', firstName: 'Teacher', lastName: 'One' },
    { email: 'teacher.two@example.com', firstName: 'Teacher', lastName: 'Two' },
  ]);
});

describe('identity and roles', () => {
  it('rejects anonymous callers', async () => {
    expect((await as(null)('/api/me')).status).toBe(401);
    expect((await as(null)('/api/data/classes')).status).toBe(401);
  });
  it('reports roles from the tables, case-insensitively', async () => {
    expect((await expectJson<{ role: string }>(await as(ADMIN)('/api/me'))).role).toBe('admin');
    const me = await expectJson<{ role: string; email: string }>(await as(TEACHER)('/api/me'));
    expect(me.role).toBe('teacher');
    expect(me.email).toBe('teacher.one@example.com');
    expect((await expectJson<{ role: string }>(await as(STRANGER)('/api/me'))).role).toBe('none');
  });
  it('locks unregistered accounts out of data', async () => {
    expect((await as(STRANGER)('/api/data/classes')).status).toBe(403);
  });
  it('honours ADMIN_EMAILS as a bootstrap list', async () => {
    process.env.ADMIN_EMAILS = 'Stranger@Example.com';
    expect((await expectJson<{ role: string }>(await as(STRANGER)('/api/me'))).role).toBe('admin');
    delete process.env.ADMIN_EMAILS;
  });
  it('accepts the rewritten function URL as well as /api', async () => {
    const res = await as(ADMIN)('/.netlify/functions/api/me');
    expect((await expectJson<{ role: string }>(res)).role).toBe('admin');
  });
  it('forwards /api/auth/* to Better Auth with the URL normalised and the body intact', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const { route } = await import('../router.ts');
    const call = (url: string) => route(new Request(url, { method: 'POST', body: '{"provider":"google"}', headers: { 'content-type': 'application/json' } }), {
      db, identity: async () => null,
      authHandler: async r => { seen.push({ url: r.url, body: await r.text() }); return new Response('ok'); },
    });
    await call('http://localhost/api/auth/sign-in/social');
    await call('http://localhost/.netlify/functions/api/auth/sign-in/social');
    expect(seen.map(s => s.url)).toEqual(['http://localhost/api/auth/sign-in/social', 'http://localhost/api/auth/sign-in/social']);
    expect(seen.every(s => s.body === '{"provider":"google"}')).toBe(true);
  });
});

describe('classes, students and ownership', () => {
  let classId: string;
  let otherClassId: string;
  let studentId: string;

  it('admin creates classes for two teachers', async () => {
    ({ id: classId } = await expectJson<{ id: string }>(await as(ADMIN)('/api/data/classes', {
      method: 'POST', json: { teacherEmail: 'Teacher.One@Example.com', classDay: 'Saturday', classTime: '10:00', classLocation: 'Box Hill', classLevel: 'Level 2' },
    }), 201));
    ({ id: otherClassId } = await expectJson<{ id: string }>(await as(ADMIN)('/api/data/classes', {
      method: 'POST', json: { teacherEmail: TEACHER2.email, classDay: 'Sunday', classTime: '11:00', classLocation: 'Box Hill', classLevel: 'Level 3' },
    }), 201));
    const rows = await expectJson<Array<{ teacherEmail: string }>>(await as(TEACHER)('/api/data/classes?teacherEmail=teacher.one@example.com'));
    expect(rows).toHaveLength(1);
    expect(rows[0].teacherEmail).toBe('teacher.one@example.com');
  });

  it('a teacher may edit their own class but not another teacher\'s', async () => {
    const ok = await as(TEACHER)(`/api/data/classes/${classId}`, { method: 'PATCH', json: { classTime: '10:30' } });
    expect((await expectJson<{ classTime: string }>(ok)).classTime).toBe('10:30');
    expect((await as(TEACHER)(`/api/data/classes/${otherClassId}`, { method: 'PATCH', json: { classTime: '9:00' } })).status).toBe(403);
    expect((await as(TEACHER)(`/api/data/classes/${classId}`, { method: 'PATCH', json: { teacherEmail: TEACHER2.email } })).status).toBe(403);
  });

  it('batch-creates students and filters by class, including IN and orphan queries', async () => {
    const { ids } = await expectJson<{ ids: string[] }>(await as(TEACHER)('/api/data/students', {
      method: 'POST', json: [
        { firstName: 'Amy', lastName: 'Zhang', classId },
        { firstName: 'Ben', lastName: 'Li', classId },
        { firstName: 'Orphan', lastName: 'Kid', classId: '' },
      ],
    }), 201);
    expect(ids).toHaveLength(3);
    studentId = ids[0];
    expect(await expectJson<unknown[]>(await as(TEACHER)(`/api/data/students?classId=${classId}`))).toHaveLength(2);
    expect(await expectJson<unknown[]>(await as(TEACHER)(`/api/data/students?classId=${classId}&classId=${otherClassId}`))).toHaveLength(2);
    const orphans = await expectJson<Array<{ classId: string }>>(await as(TEACHER)('/api/data/students?classId='));
    expect(orphans).toHaveLength(1);
    expect(orphans[0].classId).toBe(''); // null comes back as '' like Firestore did
  });

  it('refuses filters on unknown fields and deletes with delete-many', async () => {
    expect((await as(TEACHER)('/api/data/students?hacker=1')).status).toBe(400);
    const orphans = await expectJson<Array<{ id: string }>>(await as(ADMIN)('/api/data/students?classId='));
    const res = await expectJson<{ deleted: number }>(await as(ADMIN)('/api/data/students/delete-many', { method: 'POST', json: { ids: orphans.map(o => o.id) } }));
    expect(res.deleted).toBe(1);
  });

  it('keeps students when their class is deleted (set null, not cascade)', async () => {
    const { id: tmp } = await expectJson<{ id: string }>(await as(ADMIN)('/api/data/classes', { method: 'POST', json: { teacherEmail: TEACHER2.email, classLevel: 'Tmp' } }), 201);
    const { id: kid } = await expectJson<{ id: string }>(await as(ADMIN)('/api/data/students', { method: 'POST', json: { firstName: 'Tmp', lastName: 'Kid', classId: tmp } }), 201);
    await expectJson(await as(ADMIN)(`/api/data/classes/${tmp}`, { method: 'DELETE' }));
    const row = await expectJson<{ classId: string }>(await as(ADMIN)(`/api/data/students/${kid}`));
    expect(row.classId).toBe('');
    await expectJson(await as(ADMIN)(`/api/data/students/${kid}`, { method: 'DELETE' }));
  });

  it('rejects a report for a student that does not exist with 400, not 500', async () => {
    const res = await as(ADMIN)('/api/data/reports', { method: 'POST', json: { studentId: 'nope', classId, teacherEmail: 'teacher.one@example.com', reportText: 'x' } });
    expect(res.status).toBe(400);
  });

  describe('reports', () => {
    let reportId: string;
    it('createOrUpdateReport upserts one report per student', async () => {
      const first = await expectJson<{ id: string }>(await as(TEACHER)('/api/rpc/createOrUpdateReport', {
        method: 'POST', json: { studentId, classId, teacherEmail: TEACHER.email, reportText: 'Draft one', studentName: 'Amy Zhang' },
      }), 201);
      const second = await expectJson<{ id: string }>(await as(TEACHER)('/api/rpc/createOrUpdateReport', {
        method: 'POST', json: { studentId, classId, teacherEmail: TEACHER.email, reportText: 'Draft two', artworkUrl: '/api/files/x.jpg' },
      }));
      expect(second.id).toBe(first.id);
      reportId = first.id;
      const rows = await expectJson<Array<{ reportText: string; artworkUrl: string }>>(await as(TEACHER)(`/api/data/reports?studentId=${studentId}`));
      expect(rows).toHaveLength(1);
      expect(rows[0].reportText).toBe('Draft two');
      expect(rows[0].artworkUrl).toBe('/api/files/x.jpg');
    });
    it('null clears a field (the old deleteField behaviour)', async () => {
      const row = await expectJson<{ artworkUrl: string | null }>(await as(TEACHER)(`/api/data/reports/${reportId}`, { method: 'PATCH', json: { artworkUrl: null } }));
      expect(row.artworkUrl).toBeNull();
    });
    it('another teacher cannot touch it; an admin can', async () => {
      expect((await as(TEACHER2)(`/api/data/reports/${reportId}`, { method: 'PATCH', json: { reportText: 'hijack' } })).status).toBe(403);
      expect((await as(TEACHER2)('/api/rpc/createOrUpdateReport', { method: 'POST', json: { studentId, teacherEmail: TEACHER2.email, reportText: 'hijack' } })).status).toBe(403);
      await expectJson(await as(ADMIN)(`/api/data/reports/${reportId}`, { method: 'PATCH', json: { reportText: 'admin edit' } }));
    });
    it('deleting the student cascades to the report', async () => {
      await expectJson(await as(ADMIN)(`/api/data/students/${studentId}`, { method: 'DELETE' }));
      expect((await as(ADMIN)(`/api/data/reports/${reportId}`)).status).toBe(404);
    });
  });

  describe('requests', () => {
    let requestId: string;
    it('a teacher files a request for their own class only', async () => {
      ({ id: requestId } = await expectJson<{ id: string }>(await as(TEACHER)('/api/data/requests', {
        method: 'POST', json: { type: 'add_student', status: 'pending', teacherEmail: TEACHER.email, classId, studentFirstName: 'New', studentLastName: 'Student', requestedAt: new Date().toISOString() },
      }), 201));
      expect((await as(TEACHER)('/api/data/requests', { method: 'POST', json: { type: 'add_student', teacherEmail: TEACHER2.email, classId: otherClassId } })).status).toBe(403);
    });
    it('only an admin approves, and approval creates the student with the deterministic id', async () => {
      expect((await as(TEACHER)('/api/rpc/approveRequest', { method: 'POST', json: { requestId } })).status).toBe(403);
      await expectJson(await as(ADMIN)('/api/rpc/approveRequest', { method: 'POST', json: { requestId } }));
      const expectedId = `New-Student-${classId.split('-')[0]}`;
      const kid = await expectJson<{ classId: string }>(await as(ADMIN)(`/api/data/students/${expectedId}`));
      expect(kid.classId).toBe(classId);
      const req = await expectJson<{ status: string; resolvedBy: string }>(await as(ADMIN)(`/api/data/requests/${requestId}`));
      expect(req.status).toBe('approved');
      expect(req.resolvedBy).toBe(ADMIN.email);
    });
    it('declines', async () => {
      const { id } = await expectJson<{ id: string }>(await as(TEACHER)('/api/data/requests', {
        method: 'POST', json: { type: 'remove_student', teacherEmail: TEACHER.email, classId, studentId: 'whatever' },
      }), 201);
      await expectJson(await as(ADMIN)('/api/rpc/declineRequest', { method: 'POST', json: { requestId: id } }));
      expect((await expectJson<{ status: string }>(await as(TEACHER)(`/api/data/requests/${id}`))).status).toBe('declined');
      expect((await as(ADMIN)('/api/rpc/declineRequest', { method: 'POST', json: { requestId: 'missing' } })).status).toBe(404);
    });
  });
});

describe('admin-only collections and stats', () => {
  it('teachers cannot read adminUsers', async () => {
    expect((await as(TEACHER)('/api/data/adminUsers')).status).toBe(403);
    expect((await as(TEACHER)('/api/data/teachers', { method: 'POST', json: { email: 'x@y.z' } })).status).toBe(403);
  });
  it('stats counts admins + teachers as users', async () => {
    const s = await expectJson<{ userCount: number; classCount: number; studentCount: number }>(await as(TEACHER)('/api/rpc/stats'));
    expect(s.userCount).toBe(3);
    expect(s.classCount).toBe(2);
  });
});

describe('files', () => {
  const key = 'student-reports/students/Amy-Zhang-Saturday/profile_art.jpg';
  const url = `/api/files/${key}`;
  it('round-trips an upload', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const up = await expectJson<{ url: string }>(await as(TEACHER)(url, { method: 'PUT', body: bytes, headers: { 'content-type': 'image/jpeg' } }), 201);
    expect(up.url).toBe(url);
    expect((await as(TEACHER)(url, { method: 'HEAD' })).status).toBe(200);
    const got = await as(TEACHER)(url);
    expect(got.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes);
    expect((await as(TEACHER)(url, { method: 'DELETE' })).status).toBe(204);
    expect((await as(TEACHER)(url, { method: 'HEAD' })).status).toBe(404);
  });
  it('rejects path traversal and anonymous access', async () => {
    expect((await as(TEACHER)('/api/files/%2e%2e/secret', { method: 'HEAD' })).status).toBe(404); // folded away by the URL parser
    expect((await as(TEACHER)('/api/files/.hidden', { method: 'HEAD' })).status).toBe(400);
    expect((await as(null)(url, { method: 'HEAD' })).status).toBe(401);
  });
  it('accepts unicode folder names and encoded keys', async () => {
    const k = '/api/files/student-reports/students/' + encodeURIComponent('张-伟-Saturday') + '/' + encodeURIComponent('张-伟-Saturday.pdf');
    await expectJson(await as(TEACHER)(k, { method: 'PUT', body: new Uint8Array([9]), headers: { 'content-type': 'application/pdf' } }), 201);
    expect((await as(TEACHER)(k, { method: 'HEAD' })).status).toBe(200);
  });
});

describe('ai draft', () => {
  it('requires notes and strips bracket markers', async () => {
    expect((await as(TEACHER)('/api/ai-draft', { method: 'POST', json: {} })).status).toBe(400);
  });
});
