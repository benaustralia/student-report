// Better Auth, self-hosted inside the Netlify function, with Google as the only sign-in.
// Sessions and accounts live in the same Neon database as the app data.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Db } from './db.ts';
import { account, session, user, verification } from './schema.ts';

/** The site URL Better Auth should consider its own. Netlify sets URL / DEPLOY_PRIME_URL. */
export const siteUrl = () =>
  process.env.BETTER_AUTH_URL || process.env.DEPLOY_PRIME_URL || process.env.URL || 'http://localhost:8888';

export const makeAuth = (db: Db) =>
  betterAuth({
    baseURL: siteUrl(),
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
    trustedOrigins: [siteUrl(), 'http://localhost:8888', 'http://localhost:5173'],
    session: {
      expiresIn: 60 * 60 * 24 * 90, // 90 days, matching the old Firebase cookie
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  });

export type Auth = ReturnType<typeof makeAuth>;

let _auth: Auth | null = null;
export const getAuth = (db: Db): Auth => (_auth ??= makeAuth(db));
