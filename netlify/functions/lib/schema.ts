// Drizzle schema for the NSA student reports app on Neon Postgres.
//
// Two families of tables live here:
//   1. App data (teachers, admin_users, classes, students, reports, requests) — a straight
//      relational port of the old Firestore collections. Ids stay `text` so migrated
//      Firestore ids are preserved; new rows get a uuid.
//   2. Better Auth tables (user, session, account, verification) — field names follow
//      Better Auth's defaults exactly so the drizzle adapter needs no field mapping.
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const textId = () => text('id').primaryKey().default(sql`gen_random_uuid()::text`);
// App rows carry ISO strings over the wire, so `mode: 'string'` keeps server and client aligned.
const stamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const teachers = pgTable('teachers', {
  id: textId(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  ...stamps(),
}, t => [index('teachers_email_idx').on(t.email)]);

export const adminUsers = pgTable('admin_users', {
  id: textId(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  isAdmin: boolean('is_admin').notNull().default(false),
  ...stamps(),
}, t => [index('admin_users_email_idx').on(t.email)]);

export const classes = pgTable('classes', {
  id: textId(),
  teacherEmail: text('teacher_email').notNull().default(''),
  classDay: text('class_day').notNull().default(''),
  classTime: text('class_time').notNull().default(''),
  classLocation: text('class_location').notNull().default(''),
  classLevel: text('class_level').notNull().default(''),
  teacherFirstName: text('teacher_first_name'),
  teacherLastName: text('teacher_last_name'),
  ...stamps(),
}, t => [index('classes_teacher_email_idx').on(t.teacherEmail)]);

export const students = pgTable('students', {
  id: textId(),
  // Nullable so a deleted class leaves "orphaned" students (the old app had a cleanup tool
  // for exactly this) rather than cascading. The API maps null <-> '' for the client.
  classId: text('class_id').references(() => classes.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  teacherEmail: text('teacher_email'),
  ...stamps(),
}, t => [index('students_class_id_idx').on(t.classId)]);

export const reports = pgTable('reports', {
  id: textId(),
  studentId: text('student_id').references(() => students.id, { onDelete: 'cascade' }),
  classId: text('class_id').references(() => classes.id, { onDelete: 'set null' }),
  teacherEmail: text('teacher_email').notNull().default(''),
  reportText: text('report_text').notNull().default(''),
  artworkUrl: text('artwork_url'),
  pdfUrl: text('pdf_url'),
  studentName: text('student_name'),
  ...stamps(),
}, t => [
  index('reports_student_id_idx').on(t.studentId),
  index('reports_class_id_idx').on(t.classId),
  index('reports_teacher_email_idx').on(t.teacherEmail),
]);

export const requests = pgTable('requests', {
  id: textId(),
  type: text('type').notNull(),            // 'add_student' | 'remove_student'
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'declined'
  teacherEmail: text('teacher_email').notNull().default(''),
  classId: text('class_id').notNull().default(''),
  studentId: text('student_id'),
  studentFirstName: text('student_first_name'),
  studentLastName: text('student_last_name'),
  notes: text('notes'),
  requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
  resolvedBy: text('resolved_by'),
  ...stamps(),
}, t => [index('requests_status_idx').on(t.status), index('requests_teacher_email_idx').on(t.teacherEmail)]);

// ---- Better Auth ---------------------------------------------------------------------------
// These use `mode: 'date'` (the default) because Better Auth hands the adapter Date objects.
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, t => [index('session_user_id_idx').on(t.userId)]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [index('account_user_id_idx').on(t.userId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [index('verification_identifier_idx').on(t.identifier)]);
