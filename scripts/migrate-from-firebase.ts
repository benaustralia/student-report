#!/usr/bin/env node
// One-off migration: Firebase (Firestore + Storage) → Neon Postgres + Netlify Blobs.
//
// Runs in two steps so the export can be inspected before anything is written:
//
//   node scripts/migrate-from-firebase.ts dump   # Firebase → ./migration-dump (JSON + files)
//   node scripts/migrate-from-firebase.ts load   # ./migration-dump → Neon + Blobs
//
// Env for `dump`:  GOOGLE_APPLICATION_CREDENTIALS (service-account JSON path), FIREBASE_STORAGE_BUCKET
// Env for `load`:  DATABASE_URL, NETLIFY_SITE_ID, NETLIFY_AUTH_TOKEN   (+ --skip-files to load rows only)
// Both accept --dir=<path> (default ./migration-dump) and `load` accepts --dry-run.
//
// Re-runnable: rows insert with ON CONFLICT DO NOTHING and blob uploads overwrite the same key.
// Needs Node 22.18+ (runs TypeScript directly).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import {
  adminUserRow, classRow, keyCandidates, reportRow, requestRow, studentRow, teacherRow, toIso, type FsDoc,
} from './lib/transform.ts';

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--'));
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const DIR = opt('dir', './migration-dump');
const FILES_DIR = join(DIR, 'files');
const COLLECTIONS = ['teachers', 'adminUsers', 'classes', 'students', 'reports', 'requests'] as const;
const FILE_PREFIXES = ['student-reports/', 'pdfs/'];

const log = (...a: unknown[]) => console.log('[migrate]', ...a);
const die = (msg: string): never => { console.error('[migrate] ' + msg); process.exit(1); };

// ---- dump -----------------------------------------------------------------------------------
const dump = async () => {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getStorage } = await import('firebase-admin/storage');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) die('GOOGLE_APPLICATION_CREDENTIALS must point at a service-account JSON file');
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? 'student-reports-final.firebasestorage.app';
  initializeApp({ credential: applicationDefault(), storageBucket: bucketName });

  mkdirSync(DIR, { recursive: true });
  const db = getFirestore();
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    const docs = snap.docs.map(d => {
      const data = d.data();
      // Serialise Timestamps now so the JSON is plain.
      for (const k of Object.keys(data)) if (data[k] && typeof data[k] === 'object' && typeof data[k].toDate === 'function') data[k] = toIso(data[k]);
      return { id: d.id, ...data };
    });
    writeFileSync(join(DIR, `${name}.json`), JSON.stringify(docs, null, 2));
    log(`${name}: ${docs.length} documents`);
  }

  if (flag('skip-files')) return;
  const bucket = getStorage().bucket();
  let n = 0;
  for (const prefix of FILE_PREFIXES) {
    const [files] = await bucket.getFiles({ prefix });
    for (const f of files) {
      if (f.name.endsWith('/')) continue;
      const dest = join(FILES_DIR, f.name);
      mkdirSync(dirname(dest), { recursive: true });
      await f.download({ destination: dest });
      n++;
      if (n % 25 === 0) log(`files: ${n}…`);
    }
  }
  log(`files: ${n} downloaded to ${FILES_DIR}`);
};

// ---- load -----------------------------------------------------------------------------------
const walk = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const contentTypeFor = (key: string) => {
  const ext = key.toLowerCase().split('.').pop() ?? '';
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' } as Record<string, string>)[ext] ?? 'application/octet-stream';
};

const load = async () => {
  const dryRun = flag('dry-run');
  const read = (name: string): FsDoc[] => {
    const p = join(DIR, `${name}.json`);
    if (!existsSync(p)) die(`${p} missing — run \`dump\` first`);
    return JSON.parse(readFileSync(p, 'utf8'));
  };
  const src = Object.fromEntries(COLLECTIONS.map(c => [c, read(c)])) as Record<typeof COLLECTIONS[number], FsDoc[]>;

  // Which files do we actually have?
  const have = new Set(walk(FILES_DIR).map(p => relative(FILES_DIR, p).split('\\').join('/')));
  const resolveKey = (key: string) => keyCandidates(key).find(k => have.has(k)) ?? null;

  const classIds = new Set(src.classes.map(c => c.id));
  const studentIds = new Set(src.students.map(s => s.id));
  const teachers = src.teachers.map(teacherRow);
  const admins = src.adminUsers.map(adminUserRow);
  const classes = src.classes.map(classRow);
  const students = src.students.map(s => studentRow(s, classIds));
  const reportResults = src.reports.map(r => reportRow(r, studentIds, classIds, resolveKey));
  const requests = src.requests.map(requestRow);
  const warnings = reportResults.flatMap(r => r.warnings);
  const neededKeys = new Set(reportResults.flatMap(r => Object.values(r.keys)));

  log(`rows → teachers ${teachers.length}, adminUsers ${admins.length}, classes ${classes.length}, students ${students.length}, reports ${reportResults.length}, requests ${requests.length}`);
  log(`files → ${have.size} in export, ${neededKeys.size} referenced by reports`);
  for (const w of warnings) console.warn('[migrate] warning:', w);
  if (dryRun) { log('dry run — nothing written'); return; }

  const databaseUrl = process.env.DATABASE_URL ?? die('DATABASE_URL required');
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  const schema = await import('../netlify/functions/lib/schema.ts');
  const db = drizzle(neon(databaseUrl), { schema });

  const insert = async <T extends { id: string }>(name: string, table: Parameters<typeof db.insert>[0], rows: T[]) => {
    for (let i = 0; i < rows.length; i += 200) {
      await db.insert(table).values(rows.slice(i, i + 200)).onConflictDoNothing();
    }
    log(`${name}: ${rows.length} rows written (existing ids skipped)`);
  };
  await insert('teachers', schema.teachers, teachers);
  await insert('adminUsers', schema.adminUsers, admins);
  await insert('classes', schema.classes, classes);
  await insert('students', schema.students, students);
  await insert('reports', schema.reports, reportResults.map(r => r.row));
  await insert('requests', schema.requests, requests);

  if (flag('skip-files')) return;
  const siteID = process.env.NETLIFY_SITE_ID ?? die('NETLIFY_SITE_ID required to upload files (or pass --skip-files)');
  const token = process.env.NETLIFY_AUTH_TOKEN ?? die('NETLIFY_AUTH_TOKEN required to upload files (or pass --skip-files)');
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'files', siteID, token, consistency: 'strong' });
  let n = 0;
  for (const key of have) {
    const data = readFileSync(join(FILES_DIR, key));
    await store.set(key, new Uint8Array(data).buffer as ArrayBuffer, { metadata: { contentType: contentTypeFor(key), size: String(data.length), migratedAt: new Date().toISOString() } });
    n++;
    if (n % 25 === 0) log(`blobs: ${n}/${have.size}…`);
  }
  log(`blobs: ${n} uploaded`);
};

if (command === 'dump') await dump();
else if (command === 'load') await load();
else die('usage: node scripts/migrate-from-firebase.ts <dump|load> [--dir=./migration-dump] [--dry-run] [--skip-files]');
