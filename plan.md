> **Moved (28 Oct 2026).** This app now lives in `benaustralia/newstarart-web` under `studentreports/`, branch
> `studentreports`, and is served at newstarart.com/studentreports. That copy of `plan.md`, `MIGRATION.md` and
> `prompts/phase-0.md` is the live one; this repo's branches are kept for history only.

# Plan: NSA Student Reports off Firebase — v2

Branch `neon-migration-v2` (from `neon-migration`). Read this top to bottom once, then dispatch the phases.
Every task below states its files, its acceptance check and what it must not touch, so tasks inside a
phase can run as parallel subagents on separate worktrees and merge cleanly.

## 1. Where things stand (done on `neon-migration`)

- **Firebase is out of the code.** Firestore → Neon Postgres via Drizzle; Firebase Auth → Better Auth (Google only,
  self-hosted in the function); Firebase Storage → Netlify Blobs behind `/api/files/<key>`; browser-side OpenAI key →
  `/api/ai-draft`. Rules → a `COLLECTIONS` policy table (`netlify/functions/lib/data.ts`) plus `teachers` /
  `admin_users` rows deciding roles (`session.ts`).
- **One function, Web-standard core.** `netlify/functions/lib/router.ts` is pure `Request → Response`; `api.mts` is a
  10-line Netlify adapter. `public/_redirects` sends `/api/*` to it.
- **The React app barely moved.** `src/services/api.ts` re-exports the old Firestore service's names; components
  changed imports only. Login is Google-only; email/password and reset were dropped.
- **Verified here:** `npm run build` green (Firebase chunks gone, vendor 283→101 kB); `npm test` = 29 tests running the
  whole API on PGlite with the generated migration SQL; `npm run check:functions` clean; migration script runs under
  Node 22 and its dry run was exercised on a fake export.
- **Not verifiable from the cloud (Ben, §5):** Neon project, Google OAuth redirect URIs, Netlify env vars, Blobs on a
  real site, the real dump/load. `MIGRATION.md` is the step list; `.env.example` the variables.
- **Suggested but not done:** rotate the OpenAI key that shipped in the old bundle; Netlify function region → Sydney;
  Neon Auth instead of self-hosted Better Auth (same library underneath, swap later if wanted).

## 2. Decisions for v2 (fixed; agents implement, not debate)

### Platform-agnostic shape
The only platform-specific code allowed is a thin adapter per host. Everything else is Node/Web-standard.

| Layer | Agnostic core | Host adapter(s) |
|---|---|---|
| HTTP | `lib/router.ts` (`Request → Response`) | `netlify/functions/api.mts` (exists) · `adapters/node.ts` for local dev · `adapters/vercel.ts` optional |
| DB | Drizzle schema + queries; driver chosen by env | `pg`/postgres.js over the Neon **pooler** (works on any Postgres) · `neon-http` optional for edge · PGlite in tests |
| Files | `FileStore` interface (`lib/files.ts`, exists) | `netlify-blobs` (exists) · `s3` (R2/B2/MinIO, S3 API) · `fs` for dev/tests |
| Auth | Better Auth (host-neutral) | none needed |
| PDF | `svg2pdf` logic as a plain function | mounted in the router at `/api/pdf` (retire the v1 handler) |
| Front end | Vite SPA, same-origin `/api` | `_redirects`/`_headers` (Netlify) — mirror in `vercel.json` only if ever needed |

Selection by env: `DATABASE_DRIVER=pg|neon-http` (default `pg`), `FILE_STORE=netlify|s3|fs` (default `netlify` on
Netlify, `fs` locally). No code path may import a host SDK outside its adapter file.

### Database security — the short version
The reason this stays simple: **the browser never touches Neon.** Only the function holds `DATABASE_URL`. So there is
no Data API, no Neon Auth, no row-level security, no anonymous role — none of the things Neon's assistant will want to
walk you through. The database is a private Postgres behind one credential, and the policy table in `data.ts` is the
authorisation layer (tested). Keep it that way. Concretely:

1. **Two roles, not one.** `neondb_owner` runs migrations only (`npm run db:migrate`, from your laptop). The app uses a
   least-privilege role `app_rw` with `SELECT/INSERT/UPDATE/DELETE` on the app tables and nothing else (no DDL, no
   `pg_catalog` tricks, no other schemas). SQL lives in `drizzle/roles.sql` (Phase 1, task B). The Netlify
   `DATABASE_URL` is the `app_rw` **pooled** string with `sslmode=require`.
2. **Secrets live in the host's env only.** Nothing in git, nothing in `VITE_*`. `.env` is gitignored. Rotate `app_rw`'s
   password from the Neon console if it ever leaks; nothing else changes.
3. **One Neon branch per deploy context.** `main` → production branch; `development` deploy → a Neon branch with its
   own `DATABASE_URL` in Netlify's "deploy context" env. Testing never touches production rows.
4. **Migrations by file, never by push.** `drizzle-kit generate` → review SQL → `drizzle-kit migrate`. `db:push` is not
   a script in this repo on purpose (the feedback-for-c near-miss).
5. **Backups you own.** Neon's point-in-time restore is short on the free plan; add `npm run db:backup` (plain
   `pg_dump` to a dated file) and run it before every load and every report cycle.
6. **Hardening inside the app** (Phase 1, task E): Better Auth rate limiting on (`storage: 'database'`, since Lambda
   memory is per-container); no request bodies or headers in logs (`svg2pdf` currently logs both); `ADMIN_EMAILS`
   removed from env once your `admin_users` row exists; cookies `secure` + `sameSite=lax` (Better Auth default);
   CSP stays same-origin.
7. **Blobs/S3 are never public.** Reads go through `/api/files` with a session. If S3 is adopted, the bucket is
   private and the function signs nothing for the browser.

## 3. Phases

Dependencies: Phase 0 is Ben's and gates Phase 2 only. Phase 1 tasks are mutually independent (disjoint files).
Phase 2 needs Phase 1 merged. Phase 3 is sequential.

### Phase 0 — accounts (Ben, no agent)
Neon project in Sydney (+ a `dev` branch) · Google OAuth redirect URIs · Netlify env vars per context · new OpenAI
key and revoke the old · Netlify function region = Sydney. Checklist: `MIGRATION.md` §"Your checklist" steps 1–4.

### Phase 1 — parallel, one subagent each

**A. Storage adapters** — files: `netlify/functions/lib/files.ts` (interface + `defaultStore()` selection),
new `lib/stores/{netlify,s3,fs}.ts`, tests in `lib/__tests__/files.test.ts`.
Do: move the Blobs call into `stores/netlify.ts`; add `stores/fs.ts` (root dir from `FILE_STORE_DIR`, keys as paths,
metadata sidecar `.json`); add `stores/s3.ts` using `aws4fetch` (no AWS SDK weight) with `S3_ENDPOINT/BUCKET/KEY/SECRET/REGION`;
`defaultStore()` picks by `FILE_STORE`. Run the existing files tests against `fs`; mock-fetch test for `s3` request
signing. Don't touch `router.ts` signatures or the client.

**B. Database roles, driver choice, backup** — files: `netlify/functions/lib/db.ts`, new `drizzle/roles.sql`,
new `scripts/db-backup.ts`, `package.json` scripts, `MIGRATION.md` (DB section only).
Do: `getDb()` picks `pg` (via `drizzle-orm/node-postgres`, `pg` dep) or `neon-http` by `DATABASE_DRIVER`; `roles.sql`
creates `app_rw` with grants on exactly the app tables + Better Auth tables and `ALTER DEFAULT PRIVILEGES` for future
migrations; `db:backup` shells out to `pg_dump` (document the install) into `backups/` (gitignored). Acceptance:
tests still pass on PGlite; `roles.sql` applies on a scratch Postgres (PGlite in a test is fine) and `app_rw` is
refused `CREATE TABLE`.

**C. Node dev adapter + Vite proxy** — files: new `netlify/functions/adapters/node.ts` (or `server/dev.ts`),
`vite.config.ts` (`server.proxy['/api']` only), `package.json` (`dev:api`, `dev:all`), README dev section.
Do: `node:http` server that builds a `Request` from the incoming message, calls `route()` with the same deps as
`api.mts`, writes the `Response` back (streams ok). `FILE_STORE=fs` by default. Acceptance: `npm run dev:all` serves the
app on 5173 with `/api/me` answering 401 unauthenticated; no `netlify dev` required.

**D. Port `svg2pdf` into the router** — files: `netlify/functions/svg2pdf.{ts,js}` (delete), new `lib/pdf.ts`,
`router.ts` (one `case 'pdf'`), `src/services/pdfGenerationService.ts` + `zipPDFGenerator.ts` (`getFunctionUrl` →
`/api/pdf`), `netlify.toml` (`included_files` for the font), `netlify/functions/package.json` (remove if pdfkit moves
to root deps).
Do: same pdfkit + svg-to-pdfkit logic as a `(svg: string) => Promise<Uint8Array>`; require a session; no header/body
logging. Acceptance: a test renders a tiny SVG to a PDF whose bytes start with `%PDF`; build green.

**E. Security hardening in code** — files: `lib/auth.ts` (rate limit config), `lib/session.ts` (`ADMIN_EMAILS` warning
when set in production), `public/_headers` (review), `lib/router.ts` (structured error logging without bodies),
`lib/__tests__/api.test.ts` (add: a teacher cannot read another teacher's requests? — no, reads are open by design;
add instead: PATCH cannot change `id`/`createdAt`, unknown collection 404, `delete-many` ownership on mixed ids).
Don't touch storage or DB files (A/B own them).

**F. Audit + cleanup (read-mostly)** — files: `README.md` (replace the Vite template text with a real one), delete
`test-tabs.html`, `probe.txt`, `jacksontester.txt`, `PERFORMANCE_TESTING.md` if stale, the stray root `@/components/ui`
duplicates (confirm nothing imports them), `PDF_GENERATION_SYSTEM.md` (update "Firebase Storage" → `/api/files`).
Also grep `src` for the remaining "Firebase" comments and fix the wording. Acceptance: build + tests green; no file
outside the list touched.

### Phase 2 — integration (one agent, after Phase 1 merges; needs Phase 0)
1. Apply `drizzle/roles.sql` and the migration to the Neon `dev` branch; set the `development` deploy context env.
2. Run `migrate:firebase dump` locally (Ben supplies the service-account JSON), `load --dry-run`, then `load`
   against the dev branch. Fix whatever the warnings surface.
3. Playwright run against `netlify dev` (or the Phase 1-C server) with a seeded session: sign-in gate, class list,
   artwork upload → `/api/files`, report save, AI draft (mock the completer), single PDF, class ZIP.
4. Lighthouse on the branch deploy; the old score discipline (99 perf) is the bar.

### Phase 3 — cut-over (sequential, Ben + one agent)
Backup (`db:backup`) → apply roles + migration to the production branch → final `load` → merge to `main` → teachers
sign in → one report cycle → decommission Firebase → remove `ADMIN_EMAILS`.

## 4. Subagent brief template
```
Task <letter> from plan.md §3 Phase 1. Branch from neon-migration-v2 in your own worktree.
Files you may change: <list>. Files you must not touch: everything else.
Done means: <acceptance line> + `npm run build && npm test && npm run check:functions` green.
Commit by file name (never -A), message states what changed and why. Report: diff summary, test output, open questions.
```

## 5. Open questions for Ben
- S3 target if any (Cloudflare R2 is the usual free pick) or stay on Blobs for v1?
- Keep `pg` as the default driver (universal) or `neon-http` (fewer deps on Netlify)? Plan assumes `pg`.
- Neon Auth vs self-hosted Better Auth — plan keeps self-hosted; say if you'd rather consolidate on Neon.
