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
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (email/password only). Shape follows Better Auth's
// default core schema for the email/password credential provider. If
// `npx @better-auth/cli generate` is ever run against src/lib/auth.ts and
// proposes a diff, reconcile it here rather than trusting this file blindly.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
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

// Backs Better Auth's `rateLimit: { storage: "database" }` option (see
// src/lib/auth.ts) — this exact shape (key/count/lastRequest) is what
// Better Auth's database adapter reads and writes for rate limiting.
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  count: integer("count").notNull().default(0),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

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
]);

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  surname: text("surname").notNull(),
  firstNames: text("first_names").notNull(),
  // Text, not int: paper records legitimately hold non-numeric ages
  // ("6 months"), so this must not force-fit a rigid numeric type.
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
    // Form-specific fields (validated per `type` by the matching Zod schema
    // in src/lib/validators — see formDataSchema()), e.g. medications for a
    // prescription or the test checklist for a lab request.
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
  formRecordId: uuid("form_record_id")
    .notNull()
    .references(() => formRecords.id),
  action: activityAction("action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
