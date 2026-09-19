import { getLogoDataUri } from "@/lib/pdf-assets";
import { formatDate } from "@/lib/date";
import type { LabPdfPatient } from "@/lib/pdf-templates/lab-request";
import {
  MEDICAL_REPORT_SECTIONS,
  type MedicalReportData,
} from "@/lib/validators/medical-report";

function escapeHtml(s: string) {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

function signatureHtml(sig: MedicalReportData["doctorSignature"]) {
  if (!sig?.data) return "";
  if (sig.mode === "draw") {
    return `<img src="${sig.data}" alt="Signature" class="sig-img" />`;
  }
  return `<span class="sig-text">${escapeHtml(sig.data)}</span>`;
}

export function medicalReportPdfHtml(opts: {
  patient: LabPdfPatient & { address?: string };
  data: MedicalReportData;
  isDraft: boolean;
}): string {
  const { patient, data, isDraft } = opts;
  const logo = getLogoDataUri();
  const watermark = isDraft ? `<div class="watermark">DRAFT</div>` : "";

  const enabledSectionsHtml = MEDICAL_REPORT_SECTIONS.map(({ key, label }) => {
    const sec = data.sections?.[key];
    if (!sec || !sec.enabled || !sec.content.trim()) return "";
    return `<div class="section-block">
      <h3 class="section-heading">${escapeHtml(label)}</h3>
      <div class="section-body">${escapeHtml(sec.content)}</div>
    </div>`;
  })
    .filter(Boolean)
    .join("\n");

  const formattedDate = data.reportDate ? formatDate(data.reportDate) : formatDate(new Date());

  const patientName = `${patient.surname} ${patient.firstNames}`.trim() || "Unnamed Patient";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: Georgia, "Times New Roman", Times, serif;
    color: #111111;
    font-size: 10.5pt;
    line-height: 1.45;
    background: #ffffff;
  }
  .page {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 15mm 20mm 15mm;
    display: flex;
    flex-direction: column;
  }
  .watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 80pt;
    font-weight: bold;
    color: rgba(227, 38, 43, 0.08);
    transform: rotate(-35deg);
    pointer-events: none;
    z-index: 0;
  }
  .stethoscope-watermark {
    position: fixed;
    top: 35%;
    left: 20%;
    width: 60%;
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
  }
  .content { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }

  /* HEADER STYLING REPLICATING LETTERHEAD EXACTLY */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
  }
  .header-left {
    width: 80px;
    text-align: center;
  }
  .logo-img { width: 64px; height: 64px; object-fit: contain; }
  .rc-number {
    font-family: Arial, sans-serif;
    font-size: 8pt;
    font-weight: bold;
    color: #333;
    margin-top: 4px;
  }

  .header-center {
    flex: 1;
    text-align: center;
    padding: 0 10px;
  }
  .wordmark {
    font-family: Arial, sans-serif;
    font-size: 24pt;
    font-weight: 900;
    letter-spacing: 0.12em;
    line-height: 1;
  }
  .wordmark .garden { color: #111111; }
  .wordmark .city { color: #e3262b; }
  .subtitle {
    font-family: Arial, sans-serif;
    font-size: 12pt;
    font-weight: 800;
    color: #0b6b3a;
    letter-spacing: 0.12em;
    margin-top: 3px;
  }
  .tagline {
    font-style: italic;
    font-size: 9pt;
    color: #222222;
    margin-top: 3px;
  }
  .contact-address {
    font-family: Arial, sans-serif;
    font-size: 8pt;
    color: #333333;
    margin-top: 2px;
  }
  .contact-tel {
    font-family: Arial, sans-serif;
    font-size: 8pt;
    font-weight: 600;
    color: #111111;
    margin-top: 1px;
  }
  .contact-email {
    font-family: Arial, sans-serif;
    font-size: 8pt;
    font-weight: bold;
    font-style: italic;
    color: #1e3a8a;
    margin-top: 1px;
  }

  .header-right {
    width: 60px;
    display: flex;
    justify-content: flex-end;
  }
  .ambulance-icon {
    width: 48px;
    height: 48px;
  }

  /* REPORT METADATA & TITLE */
  .meta-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: Arial, sans-serif;
    font-size: 9pt;
    font-weight: 600;
    margin-top: 10px;
    margin-bottom: 12px;
  }
  .addressee {
    font-family: Arial, sans-serif;
    font-size: 10pt;
    font-weight: bold;
    margin-bottom: 14px;
  }
  .report-title-header {
    text-align: center;
    font-family: Arial, sans-serif;
    font-size: 13pt;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-decoration: underline;
    margin-bottom: 18px;
    color: #111111;
  }

  /* PATIENT INFORMATION BOX */
  .patient-box {
    border: 1px solid #1a1a1a;
    background-color: #fafafa;
    padding: 10px 14px;
    margin-bottom: 20px;
    border-radius: 2px;
    font-family: Arial, sans-serif;
    font-size: 9pt;
  }
  .patient-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
  }
  .patient-field {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .patient-label {
    font-weight: bold;
    color: #444444;
    min-width: 95px;
  }
  .patient-val {
    color: #111111;
    font-weight: 600;
  }

  /* REPORT SECTIONS */
  .sections-container {
    flex: 1;
  }
  .section-block {
    margin-bottom: 16px;
  }
  .section-heading {
    font-family: Arial, sans-serif;
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #0b6b3a;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 2px;
    margin: 0 0 6px 0;
  }
  .section-body {
    font-size: 10pt;
    color: #1a1a1a;
    text-align: justify;
  }

  /* SIGN OFF SECTION */
  .signoff-section {
    margin-top: 24px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .doctor-box {
    min-width: 220px;
  }
  .sig-img {
    max-height: 48px;
    max-width: 180px;
    display: block;
    margin-bottom: 6px;
  }
  .sig-text {
    font-family: "Segoe Print", "Comic Sans MS", cursive;
    font-size: 12pt;
    color: #1e3a8a;
    display: block;
    margin-bottom: 6px;
  }
  .doctor-name {
    font-family: Arial, sans-serif;
    font-size: 10.5pt;
    font-weight: bold;
    color: #111111;
  }
  .doctor-title {
    font-family: Arial, sans-serif;
    font-size: 9pt;
    color: #555555;
  }
  .stamp-box {
    width: 110px;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stamp-img {
    max-width: 100px;
    max-height: 65px;
    object-fit: contain;
    opacity: 0.85;
  }

  /* FOOTER BAR STYLING */
  .footer-spacer {
    height: 40px;
  }
  .footer-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 28px;
    background: linear-gradient(90deg, #111111 50%, #e3262b 85%, #f97316 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 15mm;
    color: #ffffff;
    font-family: Arial, sans-serif;
    font-size: 7.5pt;
    font-weight: bold;
  }
  .stethoscope-icon-bottom {
    position: absolute;
    bottom: 30px;
    right: 15mm;
    width: 42px;
    opacity: 0.9;
  }
</style>
</head>
<body>
<div class="page">
  ${watermark}
  
  <!-- Stethoscope watermark SVG -->
  <svg class="stethoscope-watermark" viewBox="0 0 100 100" fill="none" stroke="#111111" stroke-width="1.5">
    <path d="M30,20 C30,40 45,55 50,70 C55,55 70,40 70,20 M30,20 L30,10 M70,20 L70,10 M50,70 C50,82 65,82 65,70 C65,65 60,65 60,70" />
    <circle cx="65" cy="70" r="4" fill="#111111" />
  </svg>

  <div class="content">
    <header class="header">
      <div class="header-left">
        <img class="logo-img" src="${logo}" alt="Logo" />
        <div class="rc-number">RC: 957820</div>
      </div>
      <div class="header-center">
        <div class="wordmark"><span class="garden">GARDEN</span> <span class="city">CITY</span></div>
        <div class="subtitle">SPECIALIST HOSPITAL</div>
        <div class="tagline">The Pathway to High-Quality and Affordable Health Care</div>
        <div class="contact-address">No. 2 Sultan Road, U/Rimi G.R.A., Kaduna.</div>
        <div class="contact-tel">Tel: 0807 237 2888, 0802 309 5497, 0807 500 4800</div>
        <div class="contact-email">e-mail: gardencityspecialisthospital@yahoo.com</div>
      </div>
      <div class="header-right">
        <!-- SVG Ambulance Icon with Crescent -->
        <svg class="ambulance-icon" viewBox="0 0 64 64" fill="none">
          <rect x="4" y="16" width="44" height="28" rx="4" fill="#e3262b" />
          <path d="M48 24h10l4 8v12h-14V24z" fill="#e3262b" />
          <circle cx="16" cy="46" r="6" fill="#111111" stroke="#ffffff" stroke-width="2" />
          <circle cx="48" cy="46" r="6" fill="#111111" stroke="#ffffff" stroke-width="2" />
          <rect x="8" y="20" width="12" height="10" fill="#ffffff" rx="1" />
          <!-- White Crescent -->
          <path d="M30 24a5 5 0 1 0 6 7 6 6 0 1 1-6-7z" fill="#ffffff" />
        </svg>
      </div>
    </header>

    <div class="meta-bar">
      <div>Ref: <strong>${escapeHtml(data.refNo || "GCSH/MR/DRAFT")}</strong></div>
      <div>Date: <strong>${formattedDate}</strong></div>
    </div>

    <div class="addressee">${escapeHtml(data.addressee || "To Whom It May Concern")},</div>

    <div class="report-title-header">${escapeHtml(data.reportTitle || "MEDICAL REPORT")}</div>

    <div class="patient-box">
      <div class="patient-grid">
        <div class="patient-field">
          <span class="patient-label">Patient Name:</span>
          <span class="patient-val">${escapeHtml(patientName)}</span>
        </div>
        <div class="patient-field">
          <span class="patient-label">Hospital No:</span>
          <span class="patient-val">${escapeHtml(patient.hospitalNumber || "")}</span>
        </div>
        <div class="patient-field">
          <span class="patient-label">Age / Sex:</span>
          <span class="patient-val">${escapeHtml(patient.age || "N/A")} / ${escapeHtml(patient.sex || "N/A")}</span>
        </div>
        <div class="patient-field">
          <span class="patient-label">Address:</span>
          <span class="patient-val">${escapeHtml(patient.address || "N/A")}</span>
        </div>
        ${
          data.admissionDate
            ? `<div class="patient-field">
                <span class="patient-label">First Visit / Adm:</span>
                <span class="patient-val">${formatDate(data.admissionDate)}</span>
              </div>`
            : ""
        }
        ${
          data.dischargeDate
            ? `<div class="patient-field">
                <span class="patient-label">Discharge Date:</span>
                <span class="patient-val">${formatDate(data.dischargeDate)}</span>
              </div>`
            : ""
        }
      </div>
    </div>

    <div class="sections-container">
      ${
        enabledSectionsHtml ||
        `<p style="font-style: italic; color: #888888;">No report sections populated.</p>`
      }
    </div>

    <div class="signoff-section">
      <div class="doctor-box">
        ${signatureHtml(data.doctorSignature)}
        <div class="doctor-name">${escapeHtml(data.doctorName || "Dr. Medical Officer")}</div>
        <div class="doctor-title">${escapeHtml(data.doctorDesignation || "Medical Officer")}</div>
      </div>
      ${
        data.hospitalStamp
          ? `<div class="stamp-box">
              <img class="stamp-img" src="${data.hospitalStamp}" alt="Stamp" />
            </div>`
          : ""
      }
    </div>

    <div class="footer-spacer"></div>
  </div>

  <!-- Bottom Stethoscope Icon -->
  <svg class="stethoscope-icon-bottom" viewBox="0 0 50 50" fill="none" stroke="#111111" stroke-width="2">
    <path d="M15,10 C15,25 22,32 25,40 C28,32 35,25 35,10" />
    <circle cx="25" cy="42" r="5" fill="#111111" />
  </svg>

  <footer class="footer-bar">
    <div>Dr. Amir Ahmed Ibrahim (CMD), Nigerian</div>
    <div>Dr. Tawassul M. El-Amin (Medical Director), Nigerian</div>
  </footer>
</div>
</body>
</html>`;
}

export function medicalReportPdfFilename(patient: LabPdfPatient, date: string) {
  const name = patient.surname ? patient.surname.trim().replace(/\s+/g, "_") : "Patient";
  const d = date ? formatDate(date).replace(/\//g, "-") : formatDate(new Date()).replace(/\//g, "-");
  return `MedicalReport_${name}_${d}.pdf`;
}
