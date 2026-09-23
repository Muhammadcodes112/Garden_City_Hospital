import fs from "fs";
import path from "path";
import { renderPdf } from "../src/lib/pdf";
import { labRequestPdfHtml } from "../src/lib/pdf-templates/lab-request";
import { prescriptionPdfHtml } from "../src/lib/pdf-templates/prescription";
import { medicalReportPdfHtml } from "../src/lib/pdf-templates/medical-report";
import { ALL_LAB_TESTS } from "../src/lib/lab-tests/catalog";
import type { LabRequestData } from "../src/lib/validators/lab-request";
import type { PrescriptionData } from "../src/lib/validators/prescription";
import type { MedicalReportData } from "../src/lib/validators/medical-report";

const OUTPUT_DIR = path.join(process.cwd(), "public", "pdf-checks");

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Generating test PDFs and rendering PNGs in ${OUTPUT_DIR}...`);

  // ---------------------------------------------------------
  // 1. LAB REQUEST - MINIMAL & MAXIMUM
  // ---------------------------------------------------------
  const labPatientMin = {
    surname: "Yusuf",
    firstNames: "Aliyu",
    age: "28",
    sex: "Male",
  };

  const labDataMin: LabRequestData = {
    testsSelected: ["fbc"],
    provisionalDiagnosis: "Fever for evaluation",
    collectionDate: "2026-09-22",
    collectionTime: "09:30 AM",
    referringDoctor: "Dr. Kabir",
    referringPhone: "08031234567",
    hospitalClinic: "Garden City Specialist Hospital",
    formDate: "2026-09-22",
    doctorSignature: { mode: "type", data: "Dr. Kabir" },
  };

  const allTestIds = ALL_LAB_TESTS.map((t) => t.id);

  const labPatientMax = {
    surname: "Muhammed",
    firstNames: "Ismaila Jibrin",
    age: "45 Yrs",
    sex: "Male",
    hospitalNumber: "GCSH/2026/8892",
  };

  const labDataMax: LabRequestData = {
    testsSelected: allTestIds,
    provisionalDiagnosis: "Severe Polyuria, Generalized Body Weakness & Pyrexia of Unknown Origin",
    collectionDate: "2026-09-22",
    collectionTime: "08:15 AM",
    referringDoctor: "Dr. Amir Ahmed Ibrahim (CMD)",
    referringPhone: "08072372888",
    hospitalClinic: "Garden City Specialist Hospital & Scanning Center",
    formDate: "2026-09-22",
    doctorSignature: { mode: "type", data: "Dr. Amir Ibrahim" },
  };

  const labMinHtml = labRequestPdfHtml({ patient: labPatientMin, data: labDataMin, isDraft: false });
  const labMaxHtml = labRequestPdfHtml({ patient: labPatientMax, data: labDataMax, isDraft: false });

  await savePdfAndPng("lab_minimal", labMinHtml);
  await savePdfAndPng("lab_maximum", labMaxHtml);

  // ---------------------------------------------------------
  // 2. PRESCRIPTION - MINIMAL & MAXIMUM
  // ---------------------------------------------------------
  const rxPatientMin = {
    surname: "Bello",
    firstNames: "Aisha",
    age: "32",
    sex: "Female",
    hospitalNumber: "GCSH/9912",
  };

  const rxDataMin: PrescriptionData = {
    items: [
      {
        drugName: "Paracetamol",
        strength: "500mg",
        dosageForm: "Tablet",
        dose: "2 tabs",
        route: "Oral",
        frequency: "TDS",
        duration: "5 days",
        quantity: "30",
        instructions: "Take after meals",
      },
    ],
    prescriberName: "Dr. Tawassul El-Amin",
    prescriberDate: "2026-09-22",
    pharmacistName: "Pharm. Sani",
    pharmacistDate: "2026-09-22",
  };

  const rxPatientMax = {
    surname: "Abubakar",
    firstNames: "Fatima Zarah",
    age: "58 Yrs",
    sex: "Female",
    hospitalNumber: "GCSH/2026/4410",
  };

  const maxRxItems = Array.from({ length: 15 }, (_, i) => ({
    drugName: [
      "Amoxicillin/Clavulanate",
      "Omeprazole",
      "Metformin",
      "Amlodipine",
      "Atorvastatin",
      "Ciprofloxacin",
      "Metronidazole",
      "Ibuprofen",
      "Losartan",
      "Hydrochlorothiazide",
      "Multivitamin Synergy",
      "Azithromycin",
      "Tramadol HCl",
      "Cetirizine HCl",
      "Arthemeter/Lumefantrine",
    ][i]!,
    strength: ["1g", "20mg", "500mg", "10mg", "20mg", "500mg", "400mg", "400mg", "50mg", "12.5mg", "1 tab", "500mg", "50mg", "10mg", "80/480mg"][i]!,
    dosageForm: ["Tablet", "Capsule", "Tablet", "Tablet", "Tablet", "Tablet", "Tablet", "Tablet", "Tablet", "Tablet", "Tablet", "Tablet", "Capsule", "Tablet", "Tablet"][i]!,
    dose: "1 unit",
    route: "Oral",
    frequency: "BD",
    duration: "7 days",
    quantity: "14",
    instructions: `Specific instruction for item #${i + 1}: Take with plenty of water.`,
  }));

  const rxDataMax: PrescriptionData = {
    items: maxRxItems,
    prescriberName: "Dr. Amir Ahmed Ibrahim (CMD)",
    prescriberDate: "2026-09-22",
    prescriberSignature: { mode: "type", data: "Dr. Amir Ibrahim" },
    pharmacistName: "Pharm. Usman Mohammed",
    pharmacistDate: "2026-09-22",
    pharmacistSignature: { mode: "type", data: "Pharm. U. Mohammed" },
  };

  const rxMinHtml = prescriptionPdfHtml({ patient: rxPatientMin, data: rxDataMin, isDraft: false });
  const rxMaxHtml = prescriptionPdfHtml({ patient: rxPatientMax, data: rxDataMax, isDraft: false });

  await savePdfAndPng("prescription_minimal", rxMinHtml);
  await savePdfAndPng("prescription_maximum", rxMaxHtml);

  // ---------------------------------------------------------
  // 3. MEDICAL REPORT - MINIMAL & MAXIMUM (3-PAGE)
  // ---------------------------------------------------------
  const reportPatientMin = {
    surname: "Okonkwo",
    firstNames: "Emeka",
    age: "40",
    sex: "Male",
    address: "Kaduna, Nigeria",
    hospitalNumber: "GCSH/7721",
  };

  const reportDataMin: MedicalReportData = {
    refNo: "GCSH/MR/2026/001",
    reportDate: "2026-09-22",
    addressee: "The Medical Director, ABUTH Zaria",
    reportTitle: "MEDICAL SUMMARY REPORT",
    admissionDate: "",
    dischargeDate: "",
    doctorName: "Dr. Tawassul M. El-Amin",
    doctorDesignation: "Consultant Physician",
    doctorSignature: { mode: "draw", data: "" },
    hospitalStamp: "",
    sections: {
      presentingComplaint: {
        enabled: true,
        content: "Patient presented with a 3-day history of high-grade fever, chills, and body aches. Physical examination revealed mild pallor and abdominal tenderness.",
      },
      examinationFindings: { enabled: false, content: "" },
      investigationsResults: { enabled: false, content: "" },
      diagnosis: { enabled: false, content: "" },
      treatmentManagement: { enabled: false, content: "" },
      currentConditionPrognosis: { enabled: false, content: "" },
      recommendations: { enabled: false, content: "" },
    },
  };

  const reportPatientMax = {
    surname: "Danladi",
    firstNames: "Ibrahim Garba",
    age: "62 Yrs",
    sex: "Male",
    address: "Plot 14, Ahmadu Bello Way, GRA, Kaduna State",
    hospitalNumber: "GCSH/2026/1092",
  };

  const longParagraph = (title: string) =>
    `PARAGRAPH 1 FOR ${title}: The above-named patient was admitted to our facility under our medical team care. Upon detailed clinical evaluation and diagnostic workup, several key clinical features were noted. Comprehensive baseline investigations were conducted including complete blood count, kidney function tests, liver enzyme profiling, abdominal ultrasonography, and chest radiography.\n\nPARAGRAPH 2 FOR ${title}: During the hospital stay, patient received intensive supportive care, intravenous antimicrobial therapy, tight glycemic control, and serial monitoring of vital signs. The patient responded favorably to treatment, showing progressive resolution of symptoms and stabilization of biochemical parameters.\n\nPARAGRAPH 3 FOR ${title}: Outpatient follow-up plans were formulated with clear instructions on lifestyle modification, medication adherence, and warning signs requiring immediate emergency review. Periodic laboratory reassessment is recommended in 4 weeks time.`;

  const reportDataMax: MedicalReportData = {
    refNo: "GCSH/MR/2026/088",
    reportDate: "2026-09-22",
    addressee: "To Whom It May Concern / Embassy Medical Board",
    reportTitle: "COMPREHENSIVE MEDICAL & SURGICAL EVALUATION REPORT",
    admissionDate: "2026-09-01",
    dischargeDate: "2026-09-15",
    doctorName: "Dr. Amir Ahmed Ibrahim",
    doctorDesignation: "Chief Medical Director & Senior Consultant Surgeon",
    doctorSignature: { mode: "type", data: "Dr. Amir A. Ibrahim" },
    hospitalStamp: "",
    sections: {
      presentingComplaint: { enabled: true, content: longParagraph("PRESENTING COMPLAINT / HISTORY") },
      examinationFindings: { enabled: true, content: longParagraph("PHYSICAL EXAMINATION FINDINGS") },
      investigationsResults: { enabled: true, content: longParagraph("INVESTIGATIONS & RESULTS") },
      diagnosis: { enabled: true, content: longParagraph("FINAL DIAGNOSIS & STAGING") },
      treatmentManagement: { enabled: true, content: longParagraph("TREATMENT / MANAGEMENT") },
      currentConditionPrognosis: { enabled: true, content: longParagraph("CURRENT CONDITION / PROGNOSIS") },
      recommendations: { enabled: true, content: longParagraph("RECOMMENDATIONS") },
    },
  };

  const reportMinHtml = medicalReportPdfHtml({ patient: reportPatientMin, data: reportDataMin, isDraft: false });
  const reportMaxHtml = medicalReportPdfHtml({ patient: reportPatientMax, data: reportDataMax, isDraft: false });

  await savePdfAndPng("medical_report_minimal", reportMinHtml);
  await savePdfAndPng("medical_report_maximum", reportMaxHtml);

  console.log("All PDF checks generated and rendered successfully!");
}

async function savePdfAndPng(baseName: string, html: string) {
  const pdfBuffer = await renderPdf(html);
  const pdfPath = path.join(OUTPUT_DIR, `${baseName}.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);

  const puppeteer = await import("puppeteer-core");
  let execPath = process.env.CHROME_EXECUTABLE_PATH;
  if (!execPath && process.platform === "win32") {
    const winPaths = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) {
        execPath = p;
        break;
      }
    }
  }
  if (!execPath) {
    const chromium = (await import("@sparticuz/chromium")).default;
    execPath = await chromium.executablePath();
  }

  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) => img.decode().catch(() => undefined))
      );
    });

    const pngPath = path.join(OUTPUT_DIR, `${baseName}.png`);
    await page.screenshot({ path: pngPath, fullPage: false });

    if (baseName.includes("maximum")) {
      const fullPngPath = path.join(OUTPUT_DIR, `${baseName}_full.png`);
      await page.screenshot({ path: fullPngPath, fullPage: true });
    }

    console.log(`Saved: ${baseName}.pdf and ${baseName}.png`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Error in verification script:", err);
  process.exit(1);
});
