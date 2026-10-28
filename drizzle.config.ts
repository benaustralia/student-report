import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes SQL into ./drizzle from the schema (no database needed).
// `npm run db:migrate` applies it to DATABASE_URL — safe here because the Neon project is
// this app's own, unlike feedback-for-c's shared branch.
export default defineConfig({
  dialect: 'postgresql',
  schema: './netlify/functions/lib/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
