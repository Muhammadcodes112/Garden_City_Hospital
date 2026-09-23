import { and, count, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, patients, user } from "@/db/schema";
import type { FormType } from "@/lib/validators/form-data";

export function buildSearchText(
  patient: { surname: string; firstNames: string; hospitalNumber: string },
  data: Record<string, any>,
  type: FormType,
): string {
  const parts: string[] = [
    patient.surname || "",
    patient.firstNames || "",
    patient.hospitalNumber || "",
  ];

  if (type === "lab") {
    if (data.provisionalDiagnosis) parts.push(data.provisionalDiagnosis);
    if (data.referringDoctor) parts.push(data.referringDoctor);
    if (data.hospitalClinic) parts.push(data.hospitalClinic);
    if (Array.isArray(data.testsSelected)) parts.push(...data.testsSelected);
  } else if (type === "prescription") {
    if (data.wardClinic) parts.push(data.wardClinic);
    if (data.prescriberName) parts.push(data.prescriberName);
    if (data.prescriberDesignation) parts.push(data.prescriberDesignation);
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.drugName) parts.push(item.drugName);
        if (item.strength) parts.push(item.strength);
        if (item.dosageForm) parts.push(item.dosageForm);
        if (item.instructions) parts.push(item.instructions);
      }
    }
  } else if (type === "medical_report") {
    if (data.refNo) parts.push(data.refNo);
    if (data.reportTitle) parts.push(data.reportTitle);
    if (data.addressee) parts.push(data.addressee);
    if (data.doctorName) parts.push(data.doctorName);
    if (data.sections && typeof data.sections === "object") {
      for (const secKey of Object.keys(data.sections)) {
        const sec = data.sections[secKey];
        if (sec && sec.enabled && sec.content) {
          parts.push(sec.content);
        }
      }
    }
  }

  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim();
}

export type SearchRecordsParams = {
  query?: string;
  type?: "all" | FormType;
  status?: "all" | "draft" | "completed";
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  page?: number;
  limit?: number;
  sortBy?: "updatedAt" | "createdAt";
  sortOrder?: "asc" | "desc";
  onlyTrash?: boolean;
};

export type SearchResultRecord = {
  id: string;
  type: FormType;
  status: "draft" | "completed";
  updatedAt: string;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deletedByName?: string | null;
  createdByName: string;
  createdByEmail: string;
  patient: {
    id: string;
    surname: string;
    firstNames: string;
    hospitalNumber: string;
    age: string;
    sex: string;
  };
  summarySnippet: string;
};

export async function searchFormRecords(params: SearchRecordsParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  // Soft delete filter:
  if (params.onlyTrash) {
    conditions.push(isNotNull(formRecords.deletedAt));
  } else {
    conditions.push(isNull(formRecords.deletedAt));
  }

  // Type filter
  if (params.type && params.type !== "all") {
    conditions.push(eq(formRecords.type, params.type));
  }

  // Status filter
  if (params.status && params.status !== "all") {
    conditions.push(eq(formRecords.status, params.status));
  }

  // CreatedBy filter
  if (params.createdBy) {
    conditions.push(eq(formRecords.createdBy, params.createdBy));
  }

  // Date filters
  if (params.startDate) {
    conditions.push(gte(formRecords.createdAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(formRecords.createdAt, end));
  }

  // Text search query
  if (params.query && params.query.trim()) {
    const q = params.query.trim().toLowerCase();
    const searchPattern = `%${q}%`;
    conditions.push(
      or(
        ilike(patients.surname, searchPattern),
        ilike(patients.firstNames, searchPattern),
        ilike(patients.hospitalNumber, searchPattern),
        ilike(formRecords.searchText, searchPattern),
      ),
    );
  }

  const whereClause = and(...conditions);

  const sortCol = params.sortBy === "createdAt" ? formRecords.createdAt : formRecords.updatedAt;
  const orderFn = params.sortOrder === "asc" ? sql`${sortCol} ASC` : desc(sortCol);

  const [countResult] = await db
    .select({ total: count() })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .where(whereClause);

  const total = countResult?.total || 0;

  const rows = await db
    .select({
      id: formRecords.id,
      type: formRecords.type,
      status: formRecords.status,
      data: formRecords.data,
      updatedAt: formRecords.updatedAt,
      createdAt: formRecords.createdAt,
      completedAt: formRecords.completedAt,
      deletedAt: formRecords.deletedAt,
      deletedBy: formRecords.deletedBy,
      createdByName: user.name,
      createdByEmail: user.email,
      patientId: patients.id,
      surname: patients.surname,
      firstNames: patients.firstNames,
      hospitalNumber: patients.hospitalNumber,
      age: patients.age,
      sex: patients.sex,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .innerJoin(user, eq(formRecords.createdBy, user.id))
    .where(whereClause)
    .orderBy(orderFn)
    .limit(limit)
    .offset(offset);

  const items: SearchResultRecord[] = rows.map((row) => {
    const d = row.data as Record<string, any>;
    let snippet = "";
    if (row.type === "lab") {
      snippet = d.provisionalDiagnosis ? `Diagnosis: ${d.provisionalDiagnosis}` : "Lab Request";
    } else if (row.type === "prescription") {
      const itemCount = Array.isArray(d.items) ? d.items.length : 0;
      snippet = `${itemCount} medication item${itemCount === 1 ? "" : "s"}${d.prescriberName ? ` • Dr. ${d.prescriberName}` : ""}`;
    } else if (row.type === "medical_report") {
      snippet = d.refNo ? `Ref: ${d.refNo}` : "Medical Report";
    }

    return {
      id: row.id,
      type: row.type,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedBy: row.deletedBy,
      createdByName: row.createdByName || row.createdByEmail,
      createdByEmail: row.createdByEmail,
      patient: {
        id: row.patientId,
        surname: row.surname,
        firstNames: row.firstNames,
        hospitalNumber: row.hospitalNumber,
        age: row.age || "",
        sex: row.sex || "",
      },
      summarySnippet: snippet,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
