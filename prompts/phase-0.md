# Prompt: Phase 0 → Phase 1 kickoff for the NSA Student Reports migration

Paste everything below this line into Claude Code, run from `~/Documents/student-report` (or wherever the clone is).

---

You are continuing the Firebase → Neon/Netlify migration of this repo. Read `plan.md` and `MIGRATION.md` first; they are
the source of truth for what is built and what this session must set up. Branch: `neon-migration-v2`. Pull it first.

**How to work with me in this session**
- Prefer CLIs and APIs over clicking: `neonctl`, `netlify`, `gcloud`, `psql`/node one-liners. Install what is missing
  (`npm i -g neonctl netlify-cli`, `brew install libpq` for psql, `gcloud` via brew cask) after telling me.
- When a step has no API, run `open "<url>"` to put the exact page in front of me, tell me precisely what to click and
  what to copy back, then **wait for me to paste it** before continuing. Never guess a secret.
- Ask before anything that costs money or cannot be undone (creating a Neon project is fine; deleting anything is not;
  revoking keys only when I say "go").
- Keep every secret out of git and out of chat logs where possible: write them straight into `.env` (gitignored) and
  into Netlify env via the CLI. Echo only the last 4 characters when confirming.
- After each numbered step, print a one-line status and what you still need from me. Keep a running
  `STATUS` table (item · value/last4 · where it lives) and print the full table at the end.

## 0. Tooling
Check `node -v` (need 22.18+), `neonctl --version`, `netlify --version`, `gcloud --version`, `psql --version`.
Install the missing ones. Then `git checkout neon-migration-v2 && git pull && bun install && npm test` to prove the
tree is healthy before touching any account.

## 1. Neon (the database)
1. `neonctl auth` (opens a browser once; I'll complete the login).
2. Create the project in Sydney: `neonctl projects create --name nsa-student-reports --region-id aws-ap-southeast-2 --output json`.
   Record `project id`. The default branch is production. Create `neonctl branches create --project-id <id> --name dev`.
3. Owner connection strings for both branches (direct, not pooled — migrations need a real connection):
   `neonctl connection-string --project-id <id> --branch-name <main|dev> --role-name neondb_owner --database-name neondb`.
   Keep them as `OWNER_URL_PROD` / `OWNER_URL_DEV` in your shell only.
4. Apply the schema to both branches: `DATABASE_URL=$OWNER_URL_DEV npm run db:migrate` then the same for prod.
5. **Least-privilege app role — create it with SQL, not with neonctl.** (Roles made through Neon's console/CLI/API are
   members of `neon_superuser`; a role created by SQL is not.) Generate a password with `openssl rand -hex 24` and run
   this as the owner on **each** branch (`psql "$OWNER_URL_DEV" -f drizzle/roles.sql` or a node one-liner using
   `@neondatabase/serverless`), substituting the password:
   ```sql
   CREATE ROLE app_rw LOGIN PASSWORD '<password>';
   GRANT USAGE ON SCHEMA public TO app_rw;
   REVOKE CREATE ON SCHEMA public FROM app_rw;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rw;
   ```
   Save that SQL (with `<password>` left as a placeholder) as `drizzle/roles.sql` and commit it — plan.md task B then
   only has to wire the driver and backup script; note that in plan.md.
6. Build the app connection strings: take the **pooled** owner string (`neonctl connection-string ... --pooled`), swap
   user and password for `app_rw`, keep `?sslmode=require`. These are `DATABASE_URL` for prod and dev.
7. Verify the fence: as `app_rw`, `select count(*) from teachers` succeeds and `create table x(id int)` **fails** with
   permission denied. Show me both outputs.

## 2. Google (service-account key for the export, and the OAuth client)
1. `gcloud auth login` (browser once), then `gcloud config set project student-reports-final`.
2. Export key for the Firebase admin service account, programmatically:
   `gcloud iam service-accounts list` → pick `firebase-adminsdk-…@student-reports-final.iam.gserviceaccount.com` →
   `gcloud iam service-accounts keys create ./firebase-service-account.json --iam-account <that email>`.
   Confirm it is gitignored (`git check-ignore firebase-service-account.json`).
3. OAuth client — **UI only, no API exists.** `open "https://console.cloud.google.com/apis/credentials?project=student-reports-final"`.
   Tell me to create a **new** OAuth client ID, type *Web application*, name `NSA Reports (Better Auth)`, so the old
   app's Google button keeps working untouched. Authorised redirect URIs (give me these to paste, one per line):
   - `https://nsastudentreports.netlify.app/api/auth/callback/google`
   - `https://development--nsastudentreports.netlify.app/api/auth/callback/google`
   - `https://neon-migration-v2--nsastudentreports.netlify.app/api/auth/callback/google`
   - `http://localhost:8888/api/auth/callback/google`
   - `http://localhost:5173/api/auth/callback/google`
   Wait for me to paste the client ID and secret.

## 3. OpenAI — UI only
`open "https://platform.openai.com/api-keys"`. Ask me to create a key named `nsa-reports-netlify` and paste it. Ask me
to revoke the old key (the one that shipped in the browser bundle) **only after** step 4 has stored the new one and
I say "go".

## 4. Netlify (hosting, env, blobs)
1. `netlify login` (browser once), then `netlify link --name nsastudentreports` (or `netlify sites:list` to find it).
2. Allow the branch to deploy. Try the API first:
   `netlify api updateSite --data '{"site_id":"<id>","body":{"build_settings":{"allowed_branches":["main","development","neon-migration-v2"]}}}'`.
   If that errors, `open "https://app.netlify.com/sites/nsastudentreports/configuration/deploys#branches-and-deploy-contexts"`
   and tell me what to set.
3. Function region → Sydney. Try `netlify api updateSite --data '{"site_id":"<id>","body":{"functions_region":"ap-southeast-2"}}'`;
   if the field is rejected, `open "https://app.netlify.com/sites/nsastudentreports/configuration/functions"` and guide me.
4. Generate `BETTER_AUTH_SECRET=$(openssl rand -base64 32)`.
5. Set env per context with `netlify env:set <KEY> <value> --context <ctx>`:
   - `--context production`: `DATABASE_URL` (prod app_rw pooled), `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
     `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS=bahinton@gmail.com`, `OPENAI_API_KEY`.
   - `--context branch:development` and `--context branch:neon-migration-v2`: same keys but the **dev** `DATABASE_URL`.
   - Nothing for deploy-preview (random URLs can't be OAuth redirect targets).
   `netlify env:list --context production` to confirm names (values are masked; fine).
6. For the migration script I need a token: use the CLI's own
   (`cat ~/.config/netlify/config.json` → `users.<id>.auth.token`) or `open "https://app.netlify.com/user/applications#personal-access-tokens"`
   to mint `nsa-migration`. Site ID from `netlify status`. Put both in `.env` as `NETLIFY_AUTH_TOKEN` / `NETLIFY_SITE_ID`.

## 5. Local `.env` and first deploy
1. Write `.env` from `.env.example` with the **dev** `DATABASE_URL`, the secrets above, `FIREBASE_STORAGE_BUCKET=student-reports-final.firebasestorage.app`,
   `GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json`.
2. `npm run build && npm test && npm run check:functions`. Commit `drizzle/roles.sql` and the plan.md note by name,
   `git push origin neon-migration-v2`.
3. Wait for the branch deploy: `netlify watch` or `netlify api listSiteDeploys` filtered to the branch until `state: ready`.
4. Smoke: `curl -si https://neon-migration-v2--nsastudentreports.netlify.app/api/me` must return `401` JSON (proves
   the `/api/*` redirect reaches the function). Then `open` that site and have me sign in with Google. `/api/me` in the
   address bar should show `"role":"admin"` (from `ADMIN_EMAILS`). If sign-in bounces, read the function log
   (`netlify logs:function api`) before changing anything.

## 6. Move the data (into the dev branch first)
1. `npm run migrate:firebase -- dump` → `migration-dump/`. Print document counts per collection and file count.
2. `npm run migrate:firebase -- load --dry-run` → show me every warning. Explain each in one line.
3. On my "go": `npm run migrate:firebase -- load` with the **dev** `DATABASE_URL`. Then verify with `app_rw`:
   row counts per table match the dump, and `netlify blobs:list files | wc -l` matches the file count.
4. Reload the branch site: my classes appear, an artwork thumbnail renders, open one report and download its PDF.
   Report what you could verify yourself (HTTP status of a `/api/files/...` URL, etc.).

## 7. Record and hand over
Update `MIGRATION.md` (replace placeholders with the real project id, branch names, URLs — never secrets) and
`plan.md` §1 with "Phase 0 done <date>". Commit by file name. Print the STATUS table.

## 8. Phase 1 dispatch
Only when I say "dispatch": create one git worktree per plan.md Phase 1 task (A–F), launch a subagent per task with
the brief template in plan.md §4 (fill in the file lists from §3), in parallel. Each agent must finish with build, tests
and `check:functions` green and must not touch files outside its list. Collect their reports, merge A–F into
`neon-migration-v2` in alphabetical order resolving conflicts yourself, run the full checks once more, push, and
summarise what changed per task and what Phase 2 needs from me.
