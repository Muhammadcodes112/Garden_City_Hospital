import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  integer,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Better Auth tables (email/password only + admin plugin & 2FA plugin).
// ---------------------------------------------------------------------------

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").default("admin"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_role_idx").on(table.role),
    // Enforce at most ONE super_admin in the database
    uniqueIndex("unique_super_admin_idx")
      .on(table.role)
      .where(sql`role = 'super_admin'`),
  ],
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  impersonatedBy: text("impersonated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (table) => [
    index("two_factor_user_id_idx").on(table.userId),
    index("two_factor_secret_idx").on(table.secret),
  ],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  count: integer("count").notNull().default(0),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// Access Code & Security Settings
// ---------------------------------------------------------------------------

export const accessCodeSettings = pgTable("access_code_settings", {
  id: text("id").primaryKey().default("default"),
  periodSeconds: integer("period_seconds").notNull().default(2592000), // 30 days default
  anchorAt: timestamp("anchor_at").notNull().defaultNow(),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").references(() => user.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const failedSignups = pgTable(
  "failed_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipAddress: text("ip_address"),
    email: text("email"),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("failed_signups_ip_idx").on(table.ipAddress),
    index("failed_signups_created_at_idx").on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

export const formType = pgEnum("form_type", ["lab", "prescription", "medical_report"]);
export const formStatus = pgEnum("form_status", ["draft", "completed"]);
export const activityAction = pgEnum("activity_action", [
  "created",
  "completed",
  "downloaded",
  "shared",
  "link_revoked",
  "reopened",
  "account_deleted",
  "admin_created",
  "access_code_regenerated",
  "access_code_updated",
]);

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  surname: text("surname").notNull(),
  firstNames: text("first_names").notNull(),
  age: text("age").default(""),
  sex: text("sex").default(""),
  phone: text("phone").default(""),
  address: text("address").default(""),
  hospitalNumber: text("hospital_number").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const formRecords = pgTable(
  "form_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: formType("type").notNull(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    status: formStatus("status").notNull().default("draft"),
    data: jsonb("data").notNull().default({}),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("form_records_type_idx").on(table.type),
    index("form_records_status_idx").on(table.status),
    index("form_records_patient_id_idx").on(table.patientId),
    index("form_records_updated_at_idx").on(table.updatedAt),
  ],
);

export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  formRecordId: uuid("form_record_id")
    .notNull()
    .references(() => formRecords.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  formRecordId: uuid("form_record_id").references(() => formRecords.id),
  action: activityAction("action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
