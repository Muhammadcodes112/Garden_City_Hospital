import "dotenv/config";
import postgres from "postgres";

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false, connect_timeout: 30, max: 1 });

  console.log("Applying database migrations...");

  try {
    await sql.unsafe(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'account_deleted';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'admin_created';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'access_code_regenerated';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'access_code_updated';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'soft_deleted';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'restored';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'permanently_deleted';

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

      ALTER TABLE "form_records" ADD COLUMN IF NOT EXISTS "search_text" text DEFAULT '' NOT NULL;
      ALTER TABLE "form_records" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
      ALTER TABLE "form_records" ADD COLUMN IF NOT EXISTS "deleted_by" text;

      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "dob" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "marital_status" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "next_of_kin_name" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "next_of_kin_relationship" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "next_of_kin_phone" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "next_of_kin_address" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "x_ray_number" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "place_of_origin" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "tribe" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "occupation" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "religion" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "blood_group" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "rhesus" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "genotype" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "allergies" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'Outpatient';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "doctor" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "last_visit" text DEFAULT '';
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "case_file_data" jsonb DEFAULT '{}'::jsonb;
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

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_records_deleted_by_user_id_fk') THEN
          ALTER TABLE "form_records" ADD CONSTRAINT "form_records_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS "failed_signups_ip_idx" ON "failed_signups" USING btree ("ip_address");
      CREATE INDEX IF NOT EXISTS "failed_signups_created_at_idx" ON "failed_signups" USING btree ("created_at");
      CREATE INDEX IF NOT EXISTS "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");
      CREATE INDEX IF NOT EXISTS "two_factor_secret_idx" ON "two_factor" USING btree ("secret");
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'super_admin_promoted';
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'super_admin_demoted';
      DROP INDEX IF EXISTS "unique_super_admin_idx";

      CREATE INDEX IF NOT EXISTS "form_records_deleted_at_idx" ON "form_records" USING btree ("deleted_at");
      CREATE INDEX IF NOT EXISTS "patients_surname_trgm_idx" ON "patients" USING gin ("surname" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "patients_first_names_trgm_idx" ON "patients" USING gin ("first_names" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "patients_hospital_number_trgm_idx" ON "patients" USING gin ("hospital_number" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "form_records_search_text_trgm_idx" ON "form_records" USING gin ("search_text" gin_trgm_ops);
    `);

    // Backfill search_text for form records
    await sql.unsafe(`
      UPDATE "form_records" fr
      SET "search_text" = LOWER(
        CONCAT_WS(' ',
          p."surname",
          p."first_names",
          p."hospital_number",
          fr."data"->>'provisionalDiagnosis',
          fr."data"->>'referringDoctor',
          fr."data"->>'prescriberName',
          fr."data"->>'refNo',
          fr."data"->>'doctorName',
          fr."data"->>'hospitalClinic',
          fr."data"->>'wardClinic',
          fr."data"::text
        )
      )
      FROM "patients" p
      WHERE fr."patient_id" = p."id" AND (fr."search_text" IS NULL OR fr."search_text" = '');
    `);

    // Internal admin-to-admin messaging
    await sql.unsafe(`
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'message_sent';

      DO $$ BEGIN
        CREATE TYPE "public"."message_attachment_kind" AS ENUM('form_record', 'share_link', 'file');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "dm_key" text UNIQUE,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "last_message_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "conversation_participants" (
        "conversation_id" uuid NOT NULL,
        "user_id" text NOT NULL,
        "last_read_at" timestamp,
        "muted" boolean DEFAULT false NOT NULL,
        PRIMARY KEY ("conversation_id", "user_id")
      );

      CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "conversation_id" uuid NOT NULL,
        "sender_id" text NOT NULL,
        "body" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "edited_at" timestamp,
        "deleted_at" timestamp
      );

      CREATE TABLE IF NOT EXISTS "message_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "message_id" uuid NOT NULL,
        "kind" "public"."message_attachment_kind" NOT NULL,
        "form_record_id" uuid,
        "share_link_id" uuid,
        "file_url" text,
        "file_name" text,
        "file_size" integer,
        "mime_type" text
      );

      ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "conversation_id" uuid;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_conversation_id_conversations_id_fk') THEN
          ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_user_id_user_id_fk') THEN
          ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_conversations_id_fk') THEN
          ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_user_id_fk') THEN
          ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_message_id_messages_id_fk') THEN
          ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_form_record_id_form_records_id_fk') THEN
          ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_form_record_id_form_records_id_fk" FOREIGN KEY ("form_record_id") REFERENCES "public"."form_records"("id") ON DELETE no action ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_share_link_id_share_links_id_fk') THEN
          ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE no action ON UPDATE no action;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_conversation_id_conversations_id_fk') THEN
          ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");
      CREATE INDEX IF NOT EXISTS "conversation_participants_user_id_idx" ON "conversation_participants" USING btree ("user_id");
      CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx" ON "messages" USING btree ("conversation_id", "created_at" desc);

      -- A message must have a body, an attachment, or both. Postgres CHECK
      -- constraints can't reference other tables, so this is enforced with a
      -- deferred constraint trigger checked at transaction commit — this lets
      -- sendMessage() insert the message row then its attachment row(s) in
      -- the same transaction without tripping the check mid-transaction.
      CREATE OR REPLACE FUNCTION messages_require_content() RETURNS trigger AS $BODY$
      BEGIN
        IF NEW.body IS NULL AND NOT EXISTS (
          SELECT 1 FROM message_attachments WHERE message_id = NEW.id
        ) THEN
          RAISE EXCEPTION 'message % must have a body or at least one attachment', NEW.id;
        END IF;
        RETURN NEW;
      END;
      $BODY$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS messages_require_content_trigger ON "messages";
      CREATE CONSTRAINT TRIGGER messages_require_content_trigger
        AFTER INSERT OR UPDATE ON "messages"
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION messages_require_content();
    `);

    // Internal record-sharing (Step 14): log who sent which record to whom.
    await sql.unsafe(`
      ALTER TYPE "public"."activity_action" ADD VALUE IF NOT EXISTS 'record_shared_internally';
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
