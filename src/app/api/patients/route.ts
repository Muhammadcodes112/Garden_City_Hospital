import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { db } from "@/db";
import { patients, formRecords } from "@/db/schema";
import { eq, ilike, or, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  await requireStaff();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const statusFilter = searchParams.get("status") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const offset = (page - 1) * limit;

  try {
    let baseQuery = db.select().from(patients);
    let conditions = [];

    if (q) {
      conditions.push(
        or(
          ilike(patients.surname, `%${q}%`),
          ilike(patients.firstNames, `%${q}%`),
          ilike(patients.hospitalNumber, `%${q}%`),
          ilike(patients.phone, `%${q}%`),
          ilike(patients.doctor, `%${q}%`),
        ),
      );
    }

    if (statusFilter !== "all") {
      if (statusFilter === "inpatient") {
        conditions.push(ilike(patients.status, "%Inpatient%") || ilike(patients.status, "%Admitted%"));
      } else if (statusFilter === "outpatient") {
        conditions.push(ilike(patients.status, "%Outpatient%"));
      } else if (statusFilter === "discharged") {
        conditions.push(ilike(patients.status, "%Discharged%"));
      }
    }

    const patientList = await db
      .select()
      .from(patients)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
      .orderBy(desc(patients.updatedAt))
      .limit(limit)
      .offset(offset);

    const [totalCountObj] = await db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined);

    const total = Number(totalCountObj?.count || 0);

    return NextResponse.json({
      items: patientList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("Failed to fetch patients:", err);
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await requireStaff();

  try {
    const body = await req.json();
    const {
      surname,
      firstNames,
      age,
      sex,
      dob,
      maritalStatus,
      phone,
      address,
      hospitalNumber,
      nextOfKinName,
      nextOfKinRelationship,
      nextOfKinPhone,
      nextOfKinAddress,
      xRayNumber,
      placeOfOrigin,
      tribe,
      occupation,
      religion,
      bloodGroup,
      rhesus,
      genotype,
      allergies,
      status,
      doctor,
      caseFileData,
    } = body;

    if (!surname || !firstNames) {
      return NextResponse.json({ error: "Surname and First Name are required" }, { status: 400 });
    }

    // Auto-generate Hospital Number if not provided
    let mrn = hospitalNumber?.trim();
    if (!mrn) {
      const year = new Date().getFullYear();
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      mrn = `GCSH/${year}/${randomDigits}`;
    }

    const [newPatient] = await db
      .insert(patients)
      .values({
        surname: surname.trim(),
        firstNames: firstNames.trim(),
        age: age || "",
        sex: sex || "",
        dob: dob || "",
        maritalStatus: maritalStatus || "",
        phone: phone || "",
        address: address || "",
        hospitalNumber: mrn,
        nextOfKinName: nextOfKinName || "",
        nextOfKinRelationship: nextOfKinRelationship || "",
        nextOfKinPhone: nextOfKinPhone || "",
        nextOfKinAddress: nextOfKinAddress || "",
        xRayNumber: xRayNumber || "",
        placeOfOrigin: placeOfOrigin || "",
        tribe: tribe || "",
        occupation: occupation || "",
        religion: religion || "",
        bloodGroup: bloodGroup || "",
        rhesus: rhesus || "",
        genotype: genotype || "",
        allergies: allergies || "",
        status: status || "Outpatient",
        doctor: doctor || "",
        lastVisit: new Date().toISOString().split("T")[0],
        caseFileData: caseFileData || {
          hospitalHistory: [],
          diagnoses: [],
          operations: [],
          vitals: { bp: "120/80", pulse: "75", temp: "36.8°C", spo2: "98%" },
          prescriptions: [],
          consent: { agreed: true, date: new Date().toISOString().split("T")[0] },
        },
      })
      .returning();

    return NextResponse.json(newPatient, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create patient:", err);
    if (err?.code === "23505") {
      return NextResponse.json({ error: "Hospital Number already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create patient file" }, { status: 500 });
  }
}
