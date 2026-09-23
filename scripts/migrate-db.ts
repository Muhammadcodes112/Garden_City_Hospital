import "dotenv/config";
import postgres from "postgres";

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false });

  console.log("Applying database migrations...");

  try {
    await sql.unsafe(`
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'account_deleted';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'admin_created';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'access_code_regenerated';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'access_code_updated';

      CREATE TABLE IF NOT EXISTS "access_code_settings" (
        "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
        "period_seconds" integer DEFAULT 2592000 NOT NULL,
        "anchor_at" timestamp DEFAULT now() NOT NULL,
        "version" integer DEFAULT 1 NOT NULL,
        "updated_by" text,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "failed_signups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ip_address" text,
        "email" text,
        "reason" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "two_factor" (
        "id" text PRIMARY KEY NOT NULL,
        "secret" text NOT NULL,
        "backup_codes" text NOT NULL,
        "user_id" text NOT NULL,
        "verified" boolean DEFAULT true,
        "failed_verification_count" integer DEFAULT 0,
        "locked_until" timestamp
      );

      ALTER TABLE "activity_logs" ALTER COLUMN "form_record_id" DROP NOT NULL;
      ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonated_by" text;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'admin';
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
    `);

    // Foreign keys & Indexes
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_code_settings_updated_by_user_id_fk') THEN
          ALTER TABLE "access_code_settings" ADD CONSTRAINT "access_code_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'two_factor_user_id_user_id_fk') THEN
          ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS "failed_signups_ip_idx" ON "failed_signups" USING btree ("ip_address");
      CREATE INDEX IF NOT EXISTS "failed_signups_created_at_idx" ON "failed_signups" USING btree ("created_at");
      CREATE INDEX IF NOT EXISTS "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");
      CREATE INDEX IF NOT EXISTS "two_factor_secret_idx" ON "two_factor" USING btree ("secret");
      CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user" USING btree ("role");
      CREATE UNIQUE INDEX IF NOT EXISTS "unique_super_admin_idx" ON "user" USING btree ("role") WHERE role = 'super_admin';
    `);

    console.log("✅ Database schema migration complete!");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
