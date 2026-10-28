# Moving NSA Student Reports off Firebase

Branch `neon-migration` replaces every Firebase service with things that run on Netlify and Neon:

| Was | Now | Where |
|---|---|---|
| Firestore | Neon Postgres via Drizzle, behind `/api/data` and `/api/rpc` | `netlify/functions/lib/{schema,data,rpc}.ts` |
| Firebase Auth (Google) | Better Auth, self-hosted in the function, Google provider only | `netlify/functions/lib/auth.ts`, `src/services/auth.ts` |
| Firebase Storage | Netlify Blobs behind `/api/files/<key>` (same keys as the old bucket) | `netlify/functions/lib/files.ts`, `src/services/storageService.ts` |
| Security rules | `COLLECTIONS` policy table + `teachers` / `admin_users` rows | `netlify/functions/lib/data.ts`, `session.ts` |
| Browser-side OpenAI call with a `VITE_` key | `/api/ai-draft` with the key on the server | `netlify/functions/lib/ai.ts` |

One Netlify Function (`netlify/functions/api.mts`) serves everything under `/api`; `public/_redirects` routes it.
The React app, the shadcn UI, the SVG report template and the `svg2pdf` function are unchanged apart from imports.
`src/services/api.ts` exports the same names the old `firebaseService-ultra-final.ts` did, so components barely moved.

Email/password sign-in and "forgot password" were dropped: they had no backing once Firebase Auth went, and the
whitelist tables already decide who gets in. Google only.

## What is verified here

- `npm run build` — tsc + Vite, green. The old `firebase-firestore` (360 kB) and `firebase-auth` (128 kB) chunks are gone.
- `npm test` — 28 tests run the whole API against an in-memory Postgres (PGlite) using the generated migration SQL:
  roles, ownership rules, filters, cascade/set-null behaviour, upsert, request approval, file round-trips, the
  Firestore → Postgres transform.
- `npm run check:functions` — type-checks the function and the migration script.

Not verifiable from the cloud: the Google OAuth round-trip, Netlify Blobs against a real site, and the data load.
Those are the steps below.

## Your checklist

1. **Neon.** Create a project in **Sydney (ap-southeast-2)**. Copy the pooled connection string.
2. **Tables.** Locally: `DATABASE_URL=... npm run db:migrate` (applies `drizzle/0000_*.sql`). This Neon project is
   this app's own, so unlike feedback-for-c there is nothing else on the branch to collide with.
3. **Google OAuth client.** In Google Cloud → Credentials, either reuse the existing web client
   (`1089251772494-s8a9...`) or make a new one, and add these **Authorised redirect URIs**:
   - `https://nsastudentreports.netlify.app/api/auth/callback/google`
   - `https://development--nsastudentreports.netlify.app/api/auth/callback/google`
   - `http://localhost:8888/api/auth/callback/google`
4. **Netlify env vars** (Site → Environment variables; see `.env.example`):
   `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `ADMIN_EMAILS=bahinton@gmail.com`, `OPENAI_API_KEY` (a **new** key — the old one shipped in the bundle; revoke it).
   Netlify Blobs needs nothing: functions are wired to it automatically.
5. **Deploy the branch.** Simplest: merge `neon-migration` into `development` so it builds at
   `development--nsastudentreports.netlify.app` beside the live site. Open it, sign in with Google. You should land
   in the app (bootstrapped by `ADMIN_EMAILS`) with empty data. Hit `/api/me` in the address bar to see your role.
6. **Export Firebase.** Make a service-account key for `student-reports-final` (Project settings → Service accounts),
   then locally:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json npm run migrate:firebase -- dump
   ```
   That writes `migration-dump/*.json` and `migration-dump/files/…` (gitignored). Look at the JSON.
7. **Load it.** First a dry run, then for real:
   ```bash
   DATABASE_URL=... npm run migrate:firebase -- load --dry-run     # prints counts + warnings, writes nothing
   DATABASE_URL=... NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... npm run migrate:firebase -- load
   ```
   Warnings name reports whose student no longer exists or whose artwork/PDF file was not in the export; those
   fields are nulled, nothing is dropped. Re-running is safe (existing ids are skipped, blobs overwritten).
8. **Verify on the branch site:** a teacher's classes load, artwork displays, a report saves, "Generate with AI"
   drafts, a single PDF downloads, a class ZIP downloads. Then run one real report cycle on it.
9. **Cut over.** Merge to `main`. Teachers sign in with Google once; their session lasts 90 days as before.
10. **Decommission** the Firebase project after the cycle, and delete the old OpenAI key if not already done.

## Running locally

```bash
cp .env.example .env   # fill in
netlify dev            # Vite + the function at http://localhost:8888
```
Plain `npm run dev` serves the UI only; `/api` needs `netlify dev`.

## How authorisation works now

- A Better Auth session proves the Google identity.
- `/api/me` reports a role: `admin` if the email is in `ADMIN_EMAILS` or has an `admin_users` row with `is_admin`,
  `teacher` if it has a `teachers` row, otherwise `none` — and `none` is signed straight back out with a message.
- Reads: teachers and admins see all classes, students, reports, teachers and requests; only admins read `admin_users`.
- Writes: admins can do anything. A teacher can edit classes, reports and requests that carry their own
  `teacherEmail`, and may add/edit students (as the old rules allowed). Email comparisons are case-insensitive.
- Files: any signed-in teacher or admin can read or write any key. Same as the old bucket in practice.

## Things to know

- Emails are stored lower-case. The old data's mixed-case emails are normalised on import.
- A deleted class leaves its students with no class rather than deleting them (the admin panel's orphan cleanup
  still works). A deleted student deletes its report.
- `requests` gained `resolvedBy` / `resolvedAt`; the old `approvedBy` / `declinedBy` pairs map onto them.
- The AI model defaults to `gpt-4o-mini` (was `gpt-3.5-turbo`); override with `OPENAI_MODEL`.
- Function region: in Netlify → Functions settings, pick **Sydney** so the database hop is local.
- The dev-branch Lighthouse tricks (deferred hydration, script interception in `index.html`) are untouched.
