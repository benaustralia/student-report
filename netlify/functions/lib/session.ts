// Who is calling, and what may they do. A Better Auth session proves the Google identity;
// the teachers / admin_users tables decide the role. ADMIN_EMAILS is a bootstrap list so the
// first admin can get in before any admin_users row exists.
import { eq } from 'drizzle-orm';
import type { Db } from './db.ts';
import { HttpError, normaliseEmail } from './http.ts';
import { adminUsers, teachers } from './schema.ts';

export type Role = 'admin' | 'teacher' | 'none';
export interface AppUser { uid: string; email: string; displayName: string | null; role: Role; }

/** Something that can turn a request into a signed-in identity. The router wires Better Auth; tests wire a stub. */
export type IdentityResolver = (req: Request) => Promise<{ id: string; email: string; name: string | null } | null>;

const bootstrapAdmins = () =>
  (process.env.ADMIN_EMAILS ?? '').split(',').map(normaliseEmail).filter(Boolean);

export const roleFor = async (db: Db, email: string): Promise<Role> => {
  const e = normaliseEmail(email);
  if (!e) return 'none';
  if (bootstrapAdmins().includes(e)) return 'admin';
  const [admin] = await db.select({ isAdmin: adminUsers.isAdmin }).from(adminUsers).where(eq(adminUsers.email, e)).limit(1);
  if (admin?.isAdmin) return 'admin';
  const [teacher] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.email, e)).limit(1);
  return teacher ? 'teacher' : 'none';
};

export const resolveUser = async (db: Db, identity: IdentityResolver, req: Request): Promise<AppUser | null> => {
  const who = await identity(req);
  if (!who) return null;
  const email = normaliseEmail(who.email);
  return { uid: who.id, email, displayName: who.name, role: await roleFor(db, email) };
};

/** Throws 401 when signed out, 403 when signed in but not a teacher or admin. */
export const requireUser = async (db: Db, identity: IdentityResolver, req: Request): Promise<AppUser> => {
  const user = await resolveUser(db, identity, req);
  if (!user) throw new HttpError(401, 'Sign in required');
  if (user.role === 'none') throw new HttpError(403, 'This Google account is not registered as a teacher or admin');
  return user;
};
