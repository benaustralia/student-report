import { describe, expect, it } from 'vitest';
import { apiUrlForKey, keyCandidates, reportRow, requestRow, storageKeyFromUrl, studentRow, toIso } from '../../../../scripts/lib/transform.ts';

describe('firebase → postgres transform', () => {
  it('converts every timestamp shape', () => {
    expect(toIso({ _seconds: 1700000000, _nanoseconds: 0 })).toBe('2023-11-14T22:13:20.000Z');
    expect(toIso({ seconds: 1700000000, nanoseconds: 500_000_000 })).toBe('2023-11-14T22:13:20.500Z');
    expect(toIso('2024-01-02T03:04:05.000Z')).toBe('2024-01-02T03:04:05.000Z');
    expect(toIso(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
    expect(toIso(undefined)).toBeNull();
    expect(toIso('not a date')).toBeNull();
  });

  it('extracts storage keys from download URLs and rewrites them to /api/files', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/student-reports-final.firebasestorage.app/o/student-reports%2Fstudents%2FAmy-Zhang-Saturday%2Fprofile_art.jpg?alt=media&token=abc';
    expect(storageKeyFromUrl(url)).toBe('student-reports/students/Amy-Zhang-Saturday/profile_art.jpg');
    expect(apiUrlForKey('student-reports/students/张 伟-Sat/a b.pdf')).toBe('/api/files/student-reports/students/%E5%BC%A0%20%E4%BC%9F-Sat/a%20b.pdf');
    expect(keyCandidates('student-reports/students/x/y.pdf')).toEqual(['student-reports/students/x/y.pdf', 'student-reports/student/x/y.pdf']);
  });

  it('nulls dangling foreign keys and missing files, and keeps good ones', () => {
    const have = new Set(['student-reports/student/Amy-Zhang-Saturday/profile_art.jpg']);
    const resolve = (k: string) => keyCandidates(k).find(c => have.has(c)) ?? null;
    const r = reportRow({
      id: 'r1', studentId: 's1', classId: 'gone', teacherEmail: 'T@X.com', reportText: 'hi',
      artworkUrl: 'https://firebasestorage.googleapis.com/v0/b/b/o/student-reports%2Fstudents%2FAmy-Zhang-Saturday%2Fprofile_art.jpg?alt=media',
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/b/o/pdfs%2Fr1%2Freport.pdf?alt=media',
      createdAt: { _seconds: 1700000000, _nanoseconds: 0 },
    }, new Set(['s1']), new Set(['c1']), resolve);
    expect(r.row.studentId).toBe('s1');
    expect(r.row.classId).toBeNull();
    expect(r.row.teacherEmail).toBe('t@x.com');
    expect(r.row.artworkUrl).toBe('/api/files/student-reports/student/Amy-Zhang-Saturday/profile_art.jpg'); // legacy folder honoured
    expect(r.row.pdfUrl).toBeNull();
    expect(r.warnings).toHaveLength(1);
    expect(r.row.updatedAt).toBe(r.row.createdAt);
  });

  it('maps students with a dead class to orphans and requests to resolvedBy/At', () => {
    expect(studentRow({ id: 's', classId: 'nope', firstName: 'A', lastName: 'B' }, new Set()).classId).toBeNull();
    const q = requestRow({ id: 'q', type: 'add_student', status: 'approved', teacherEmail: 't@x.com', classId: 'c', approvedBy: 'Admin@X.com', approvedAt: '2024-05-01T00:00:00Z' });
    expect(q.resolvedBy).toBe('admin@x.com');
    expect(q.resolvedAt).toBe('2024-05-01T00:00:00.000Z');
  });
});
