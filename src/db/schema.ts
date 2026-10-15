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
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Better Auth tables (email/password only + admin plugin & 2FA plugin).
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["patient", "admin", "super_admin"]);

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: userRole("role").default("patient"),
    phone: text("phone"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    deletedAt: timestamp("deleted_at"),
    // Step 16: role-change audit trail. promotedBy/promotedAt track the most
    // recent role change; the full history lives in activity_logs (see
    // activityLogs.targetUserId/oldRole/newRole/reason below).
    promotedBy: text("promoted_by"),
    promotedAt: timestamp("promoted_at"),
    roleChangedReason: text("role_changed_reason"),
    // Doctor/staff signature image, uploaded once from the account menu and
    // reused automatically on every new form they create (see createLabDraftRecord,
    // createPrescriptionDraftRecord, createMedicalReportDraftRecord).
    signatureUrl: text("signature_url"),
    signatureUpdatedAt: timestamp("signature_updated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_role_idx").on(table.role),
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

// Step 16 D: every sign-up POST (patient or staff, success or failure) logs
// one row here before any account is created, so the rate limit can't be
// bypassed by requests that fail validation downstream.
export const signupAttempts = pgTable(
  "signup_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipAddress: text("ip_address").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("signup_attempts_ip_idx").on(table.ipAddress),
    index("signup_attempts_email_idx").on(table.email),
    index("signup_attempts_created_at_idx").on(table.createdAt),
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
  "soft_deleted",
  "restored",
  "permanently_deleted",
  "super_admin_promoted",
  "super_admin_demoted",
  "message_sent",
  "record_shared_internally",
]);

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  surname: text("surname").notNull(),
  firstNames: text("first_names").notNull(),
  age: text("age").default(""),
  sex: text("sex").default(""),
  dob: text("dob").default(""),
  maritalStatus: text("marital_status").default(""),
  phone: text("phone").default(""),
  address: text("address").default(""),
  hospitalNumber: text("hospital_number").notNull().unique(),
  nextOfKinName: text("next_of_kin_name").default(""),
  nextOfKinRelationship: text("next_of_kin_relationship").default(""),
  nextOfKinPhone: text("next_of_kin_phone").default(""),
  nextOfKinAddress: text("next_of_kin_address").default(""),
  xRayNumber: text("x_ray_number").default(""),
  placeOfOrigin: text("place_of_origin").default(""),
  tribe: text("tribe").default(""),
  occupation: text("occupation").default(""),
  religion: text("religion").default(""),
  bloodGroup: text("blood_group").default(""),
  rhesus: text("rhesus").default(""),
  genotype: text("genotype").default(""),
  allergies: text("allergies").default(""),
  status: text("status").default("Outpatient"),
  doctor: text("doctor").default(""),
  lastVisit: text("last_visit").default(""),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  paymentConfirmedBy: text("payment_confirmed_by").default(""),
  paymentAmount: text("payment_amount").default(""),
  paymentMethod: text("payment_method").default(""),
  paymentReference: text("payment_reference").default(""),
  paymentEvidenceUrl: text("payment_evidence_url").default(""),
  paymentEvidenceName: text("payment_evidence_name").default(""),
  paymentNotes: text("payment_notes").default(""),
  caseFileData: jsonb("case_file_data").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("patients_payment_status_idx").on(table.paymentStatus),
]);

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
    searchText: text("search_text").notNull().default(""),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id),
  },
  (table) => [
    index("form_records_type_idx").on(table.type),
    index("form_records_status_idx").on(table.status),
    index("form_records_patient_id_idx").on(table.patientId),
    index("form_records_updated_at_idx").on(table.updatedAt),
    index("form_records_deleted_at_idx").on(table.deletedAt),
    index("form_records_search_text_idx").on(table.searchText),
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
  conversationId: uuid("conversation_id").references(() => conversations.id),
  action: activityAction("action").notNull(),
  // Step 16 role-change audit fields. Only populated for
  // super_admin_promoted/super_admin_demoted rows; null otherwise.
  targetUserId: text("target_user_id"),
  oldRole: text("old_role"),
  newRole: text("new_role"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Medication"),
    unit: text("unit").default("Tablet"),
    strength: text("strength").default(""),
    dosageForm: text("dosage_form").default("Oral"),
    unitPrice: integer("unit_price").notNull().default(0), // Price in NGN (Naira)
    defaultFrequency: text("default_frequency").default("TDS (3x daily)"),
    defaultDuration: text("default_duration").default("5 days"),
    stockQuantity: integer("stock_quantity").default(100),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("inventory_items_category_idx").on(table.category),
    index("inventory_items_name_idx").on(table.name),
  ]
);

// ---------------------------------------------------------------------------
// Internal admin-to-admin messaging
// ---------------------------------------------------------------------------

export const messageAttachmentKind = pgEnum("message_attachment_kind", [
  "form_record",
  "share_link",
  "file",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dmKey: text("dm_key").unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  },
  (table) => [index("conversations_last_message_at_idx").on(table.lastMessageAt)],
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
    muted: boolean("muted").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_participants_user_id_idx").on(table.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id),
    body: text("body"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("messages_conversation_id_created_at_idx").on(table.conversationId, table.createdAt),
  ],
);

export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  kind: messageAttachmentKind("kind").notNull(),
  formRecordId: uuid("form_record_id").references(() => formRecords.id),
  shareLinkId: uuid("share_link_id").references(() => shareLinks.id),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
});

// ---------------------------------------------------------------------------
// Step 17: append-only activity log.
//
// actorId/actorRoleAtTime/actorLabel are deliberately snapshots, not live
// joins — a later role change or (eventual) account deletion must never
// rewrite what already happened. actorId has no FK: the row must survive
// regardless of what happens to the user table.
// ---------------------------------------------------------------------------

export const activityCategory = pgEnum("activity_category", [
  "auth",
  "records",
  "sharing",
  "messages",
  "appointments",
  "accounts",
]);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorId: text("actor_id"),
    actorRoleAtTime: userRole("actor_role_at_time"),
    actorLabel: text("actor_label"),
    category: activityCategory("category").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").default({}),
  },
  (table) => [
    index("activity_events_occurred_at_idx").on(table.occurredAt.desc()),
    index("activity_events_actor_occurred_idx").on(table.actorId, table.occurredAt.desc()),
    index("activity_events_category_occurred_idx").on(table.category, table.occurredAt.desc()),
    // GIN index on metadata is created via raw SQL in migrate-db.ts —
    // drizzle-kit's declarative index builder doesn't have a clean GIN+jsonb
    // helper in this version; this entry documents its existence.
  ],
);

// ---------------------------------------------------------------------------
// Step 18: Public & Staff Appointments Schema
// ---------------------------------------------------------------------------

export const appointmentStatus = pgEnum("appointment_status", [
  "booked",
  "arrived",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
]);

export const appointmentBookedBy = pgEnum("appointment_booked_by", [
  "patient",
  "staff",
]);

export const doctors = pgTable(
  "doctors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id),
    fullName: text("full_name").notNull(),
    specialty: text("specialty").notNull(),
    active: boolean("active").notNull().default(true),
    slotMinutes: integer("slot_minutes").notNull().default(30),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("doctors_active_idx").on(table.active),
    index("doctors_specialty_idx").on(table.specialty),
  ],
);

export const doctorSchedules = pgTable(
  "doctor_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    startsAt: text("starts_at").notNull(), // "09:00"
    endsAt: text("ends_at").notNull(),     // "17:00"
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("doctor_schedules_doctor_weekday_idx").on(table.doctorId, table.weekday),
  ],
);

export const doctorTimeOff = pgTable(
  "doctor_time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("doctor_time_off_doctor_idx").on(table.doctorId),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientUserId: text("patient_user_id").references(() => user.id),
    patientName: text("patient_name").notNull(),
    patientPhone: text("patient_phone").notNull(),
    patientEmail: text("patient_email"),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("booked"),
    reason: text("reason"),
    note: text("note"),
    bookedBy: appointmentBookedBy("booked_by").notNull().default("patient"),
    bookedByUserId: text("booked_by_user_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),
  },
  (table) => [
    // CRITICAL PARTIAL UNIQUE INDEX PREVENTING DOUBLE-BOOKING AT DB LEVEL
    uniqueIndex("appointments_doctor_slot_unique_idx")
      .on(table.doctorId, table.startsAt)
      .where(sql`status NOT IN ('cancelled', 'no_show')`),
    index("appointments_patient_user_idx").on(table.patientUserId),
    index("appointments_starts_at_idx").on(table.startsAt),
    index("appointments_doctor_status_idx").on(table.doctorId, table.status),
  ],
);

export const smsLogs = pgTable(
  "sms_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipient: text("recipient").notNull(),
    message: text("message").notNull(),
    provider: text("provider").notNull().default("termii"),
    status: text("status").notNull().default("sent"),
    errorMessage: text("error_message"),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sms_logs_created_at_idx").on(table.createdAt),
  ],
);

