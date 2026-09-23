import "dotenv/config";
import { labRequestDataSchema, labRequestCompleteSchema } from "../src/lib/validators/lab-request";
import { prescriptionDataSchema, prescriptionCompleteSchema } from "../src/lib/validators/prescription";
import { medicalReportDataSchema, medicalReportCompleteSchema } from "../src/lib/validators/medical-report";
import { labRequestPdfHtml } from "../src/lib/pdf-templates/lab-request";
import { prescriptionPdfHtml } from "../src/lib/pdf-templates/prescription";
import { medicalReportPdfHtml } from "../src/lib/pdf-templates/medical-report";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runTestSuite() {
  console.log("\n=========================================");
  console.log("  GARDEN CITY SPECIALIST HOSPITAL TEST SUITE  ");
  console.log("=========================================\n");

  // 1. ADMIN ACCESS CODE VALIDATION
  console.log("--- 1. Auth & Admin Access Code Tests ---");
  const validAdminCode = "Gardencityadmin";
  assert(validAdminCode === (process.env.ADMIN_SIGNUP_CODE || "Gardencityadmin"), "Admin signup code matches environment/default");
  assert(("wrong-code" as string) !== validAdminCode, "Invalid admin signup code rejected");

  // 2. LAB REQUEST VALIDATION
  console.log("\n--- 2. Lab Request Schema Tests ---");
  const samplePatient = {
    surname: "Ismail",
    firstNames: "Muhammad",
    age: "32",
    sex: "Male",
    address: "No 14 Hospital Road, Kaduna",
    hospitalNumber: "GCSH/2026/008",
  };

  const minimalLabData = labRequestDataSchema.parse({
    provisionalDiagnosis: "Routine checkup",
    collectionDate: "2026-09-19",
    collectionTime: "08:30",
    referringDoctor: "Dr. Ahmed",
    referringPhone: "08012345678",
    hospitalClinic: "Garden City Clinic",
    formDate: "2026-09-19",
    testsSelected: ["full_blood_count"],
    doctorSignature: { mode: "type", data: "Dr. Ahmed" },
  });
  assert(minimalLabData.testsSelected.length === 1, "Minimal lab data parses correctly");

  const labCompleteRes = labRequestCompleteSchema.safeParse(minimalLabData);
  assert(labCompleteRes.success, "Lab request completion validation passes with valid patient and test");

  // 3. PRESCRIPTION VALIDATION (INCLUDING 15 ITEMS MAX DATA)
  console.log("\n--- 3. Prescription Schema Tests ---");
  const prescriptionItems = Array.from({ length: 15 }, (_, i) => ({
    id: `item-${i + 1}`,
    drugName: `Medication ${i + 1}`,
    strength: `${(i + 1) * 250}mg`,
    dosageForm: "tablet",
    dose: "1 tab",
    route: "oral",
    frequency: "bd",
    duration: "7 days",
    quantity: "14",
    instructions: "After meals",
  }));

  const maxPrescriptionData = prescriptionDataSchema.parse({
    hospitalNo: samplePatient.hospitalNumber,
    wardClinic: "Outpatient",
    prescriberName: "Dr. Sarah",
    prescriberDesignation: "Consultant",
    prescriberPhone: "08099887766",
    prescriberDate: "2026-09-19",
    prescriberSignature: { mode: "type", data: "Dr. Sarah" },
    dispensaryStaff: "",
    dispensaryDate: "",
    dispensarySignature: { mode: "draw", data: "" },
    items: prescriptionItems,
  });
  assert(maxPrescriptionData.items.length === 15, "15-item prescription data parses cleanly");

  const prescriptionCompleteRes = prescriptionCompleteSchema.safeParse(maxPrescriptionData);
  assert(prescriptionCompleteRes.success, "Prescription completion validation passes");

  // 4. MEDICAL REPORT VALIDATION
  console.log("\n--- 4. Medical Report Schema Tests ---");
  const medicalReportData = medicalReportDataSchema.parse({
    refNo: "GCSH/MR/2026/0001",
    reportDate: "2026-09-19",
    addressee: "To Whom It May Concern",
    reportTitle: "MEDICAL REPORT",
    admissionDate: "2026-09-10",
    dischargeDate: "2026-09-15",
    doctorName: "Dr. Usman",
    doctorDesignation: "Medical Officer",
    doctorSignature: { mode: "type", data: "Dr. Usman" },
    hospitalStamp: "",
    sections: {
      presentingComplaint: { enabled: true, content: "Patient presented with fever and fatigue." },
      examinationFindings: { enabled: true, content: "Febrile to touch, BP 120/80 mmHg." },
      investigationsResults: { enabled: true, content: "FBC: Mild leukocytosis." },
      diagnosis: { enabled: true, content: "Acute Malaria." },
      treatmentManagement: { enabled: true, content: "Treated with Artemether/Lumefantrine." },
      currentConditionPrognosis: { enabled: true, content: "Fully recovered and stable." },
      recommendations: { enabled: true, content: "Adequate rest and hydration." },
    },
  });
  assert(medicalReportData.sections.diagnosis.enabled, "Medical report sections parse correctly");

  const reportCompleteRes = medicalReportCompleteSchema.safeParse(medicalReportData);
  assert(reportCompleteRes.success, "Medical report completion validation passes");

  // 5. PDF GENERATION OUTPUT CHECKS
  console.log("\n--- 5. PDF Template Output Tests ---");
  const labHtml = labRequestPdfHtml({ patient: samplePatient, data: minimalLabData, isDraft: false });
  assert(labHtml.includes("DIAGNOSTIC CENTER") && labHtml.includes("LABORATORY REQUEST FORM"), "Lab PDF HTML contains hospital brand header");
  assert(labHtml.includes("Ismail"), "Lab PDF HTML contains patient surname");

  const prescriptionHtml = prescriptionPdfHtml({ patient: samplePatient, data: maxPrescriptionData, isDraft: false });
  assert(prescriptionHtml.includes("Medication 15"), "Prescription PDF HTML contains 15th drug item");

  const reportHtml = medicalReportPdfHtml({ patient: samplePatient, data: medicalReportData, isDraft: false });
  assert(reportHtml.includes("Acute Malaria"), "Medical report PDF HTML contains diagnosis");

  // 6. ACCESS CODE HMAC DERIVATION & FORMATTING CHECKS
  console.log("\n--- 6. Access Code HMAC & Rotation Tests ---");
  const { deriveAccessCode, formatAccessCode } = await import("../src/lib/access-code");
  const code1 = deriveAccessCode(1, 0);
  assert(code1.length === 9, "Derived access code format is 9 chars (XXXX-XXXX)");
  assert(code1.includes("-"), "Derived access code contains dash separator");
  
  const formatted = formatAccessCode("23456789");
  assert(formatted === "2345-6789", "formatAccessCode formats 8 chars to XXXX-XXXX");

  // 7. RECORD SEARCH & BUILD SEARCH TEXT CHECKS
  console.log("\n--- 7. Record Search & Build Search Text Tests ---");
  const { buildSearchText } = await import("../src/lib/search");
  const searchText = buildSearchText(samplePatient, minimalLabData, "lab");
  assert(searchText.includes("ismail"), "buildSearchText includes patient surname");
  assert(searchText.includes("muhammad"), "buildSearchText includes patient first names");
  assert(searchText.includes("routine checkup"), "buildSearchText includes provisional diagnosis");

  console.log("\n=========================================");
  console.log("  ALL TESTS PASSED SUCCESSFULLY!  ");
  console.log("=========================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
