// Pure mapping from Firestore documents (as dumped by the admin SDK) to Postgres rows.
// Kept free of I/O so it can be unit-tested; migrate-from-firebase.ts does the plumbing.

export type FsDoc = Record<string, unknown> & { id: string };

interface FsTimestamp { _seconds?: number; seconds?: number; _nanoseconds?: number; nanoseconds?: number; toDate?: () => Date }

/** Firestore Timestamp | Date | ISO string | millis → ISO string (or null). */
export const toIso = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }
  if (typeof v === 'number') return new Date(v).toISOString();
  const t = v as FsTimestamp;
  if (typeof t.toDate === 'function') return t.toDate().toISOString();
  const secs = t._seconds ?? t.seconds;
  if (typeof secs === 'number') return new Date(secs * 1000 + Math.floor((t._nanoseconds ?? t.nanoseconds ?? 0) / 1e6)).toISOString();
  return null;
};

export const email = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const optStr = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);

/** The storage key inside a Firebase Storage download URL, or the input if it already is a key. */
export const storageKeyFromUrl = (url: string): string | null => {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url.replace(/^\/+/, '') || null;
  try {
    const m = new URL(url).pathname.match(/\/o\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
};

export const apiUrlForKey = (key: string) => `/api/files/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Old scans sometimes sat under student-reports/student/ instead of students/. Try both. */
export const keyCandidates = (key: string): string[] => {
  const out = [key];
  if (key.includes('/students/')) out.push(key.replace('/students/', '/student/'));
  else if (key.includes('/student/')) out.push(key.replace('/student/', '/students/'));
  return out;
};

const stamps = (d: FsDoc) => {
  const createdAt = toIso(d.createdAt) ?? new Date().toISOString();
  return { createdAt, updatedAt: toIso(d.updatedAt) ?? createdAt };
};

export const teacherRow = (d: FsDoc) => ({
  id: d.id, email: email(d.email), firstName: str(d.firstName), lastName: str(d.lastName), ...stamps(d),
});

export const adminUserRow = (d: FsDoc) => ({
  id: d.id, email: email(d.email), firstName: str(d.firstName), lastName: str(d.lastName), isAdmin: d.isAdmin === true, ...stamps(d),
});

export const classRow = (d: FsDoc) => ({
  id: d.id,
  teacherEmail: email(d.teacherEmail),
  classDay: str(d.classDay), classTime: str(d.classTime), classLocation: str(d.classLocation), classLevel: str(d.classLevel),
  teacherFirstName: optStr(d.teacherFirstName), teacherLastName: optStr(d.teacherLastName),
  ...stamps(d),
});

export const studentRow = (d: FsDoc, classIds: Set<string>) => ({
  id: d.id,
  classId: typeof d.classId === 'string' && classIds.has(d.classId) ? d.classId : null,
  firstName: str(d.firstName), lastName: str(d.lastName),
  teacherEmail: optStr(d.teacherEmail) && email(d.teacherEmail),
  ...stamps(d),
});

export interface ReportRowResult {
  row: {
    id: string; studentId: string | null; classId: string | null; teacherEmail: string; reportText: string;
    artworkUrl: string | null; pdfUrl: string | null; studentName: string | null; createdAt: string; updatedAt: string;
  };
  /** Storage keys this row expects to exist (artwork, pdf). */
  keys: { artwork?: string; pdf?: string };
  warnings: string[];
}

export const reportRow = (d: FsDoc, studentIds: Set<string>, classIds: Set<string>, resolveKey: (key: string) => string | null): ReportRowResult => {
  const warnings: string[] = [];
  const studentId = typeof d.studentId === 'string' && studentIds.has(d.studentId) ? d.studentId : null;
  if (!studentId && d.studentId) warnings.push(`report ${d.id}: student ${String(d.studentId)} not found, report kept without a student`);
  const classId = typeof d.classId === 'string' && classIds.has(d.classId) ? d.classId : null;

  const keys: ReportRowResult['keys'] = {};
  const fileUrl = (field: 'artworkUrl' | 'pdfUrl', which: 'artwork' | 'pdf'): string | null => {
    const raw = str(d[field]).trim();
    if (!raw) return null;
    const key = storageKeyFromUrl(raw);
    const found = key ? resolveKey(key) : null;
    if (!found) { warnings.push(`report ${d.id}: ${field} file not found in the export (${raw.slice(0, 90)}), cleared`); return null; }
    keys[which] = found;
    return apiUrlForKey(found);
  };
  const artworkUrl = fileUrl('artworkUrl', 'artwork');
  const pdfUrl = fileUrl('pdfUrl', 'pdf');

  return {
    row: {
      id: d.id, studentId, classId, teacherEmail: email(d.teacherEmail), reportText: str(d.reportText),
      artworkUrl, pdfUrl, studentName: optStr(d.studentName), ...stamps(d),
    },
    keys, warnings,
  };
};

export const requestRow = (d: FsDoc) => {
  const status = str(d.status, 'pending');
  const resolvedBy = email(d.resolvedBy || d.approvedBy || d.declinedBy) || null;
  const resolvedAt = toIso(d.resolvedAt ?? d.approvedAt ?? d.declinedAt);
  const s = stamps(d);
  return {
    id: d.id, type: str(d.type, 'add_student'), status, teacherEmail: email(d.teacherEmail), classId: str(d.classId),
    studentId: optStr(d.studentId), studentFirstName: optStr(d.studentFirstName), studentLastName: optStr(d.studentLastName),
    notes: optStr(d.notes), requestedAt: toIso(d.requestedAt) ?? s.createdAt, resolvedAt, resolvedBy, ...s,
  };
};
