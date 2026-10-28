CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"email" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"teacher_email" text DEFAULT '' NOT NULL,
	"class_day" text DEFAULT '' NOT NULL,
	"class_time" text DEFAULT '' NOT NULL,
	"class_location" text DEFAULT '' NOT NULL,
	"class_level" text DEFAULT '' NOT NULL,
	"teacher_first_name" text,
	"teacher_last_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"student_id" text,
	"class_id" text,
	"teacher_email" text DEFAULT '' NOT NULL,
	"report_text" text DEFAULT '' NOT NULL,
	"artwork_url" text,
	"pdf_url" text,
	"student_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"teacher_email" text DEFAULT '' NOT NULL,
	"class_id" text DEFAULT '' NOT NULL,
	"student_id" text,
	"student_first_name" text,
	"student_last_name" text,
	"notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"class_id" text,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"teacher_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"email" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_users_email_idx" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "classes_teacher_email_idx" ON "classes" USING btree ("teacher_email");--> statement-breakpoint
CREATE INDEX "reports_student_id_idx" ON "reports" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "reports_class_id_idx" ON "reports" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "reports_teacher_email_idx" ON "reports" USING btree ("teacher_email");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_teacher_email_idx" ON "requests" USING btree ("teacher_email");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "students_class_id_idx" ON "students" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "teachers_email_idx" ON "teachers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");