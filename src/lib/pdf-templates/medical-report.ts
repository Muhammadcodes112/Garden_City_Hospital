import { getLogoFullDataUri, getWordmarkDataUri, getBaseFontFaces, getSerifFontFaces } from "@/lib/pdf-assets";
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

// Reserved via the PDF's real margin (see getBaseFontFaces/pdf.ts) so the
// header/footer templates below have room to repeat on every page.
const HEADER_BAND_MM = 40;
const FOOTER_BAND_MM = 24;
const SIDE_MARGIN_MM = 15;

/**
 * Chromium's print-to-PDF does not reliably repeat CSS `position: fixed`
 * content across physical pages (it paints once, at an unpredictable
 * position in the overall flow) — so the repeating header/footer use
 * Puppeteer's own headerTemplate/footerTemplate mechanism instead. These
 * render in a separate, sandboxed context: no external stylesheets or
 * @font-face, just inline styles and data-URI images, sized in px against
 * the page's full width.
 */
function headerTemplateHtml(logoFull: string, wordmark: string): string {
  return `
    <div style="width:100%; box-sizing:border-box; padding:6px ${SIDE_MARGIN_MM}mm 0; display:flex; align-items:flex-start; justify-content:space-between; font-family:Arial,Helvetica,sans-serif;">
      <div style="width:80px; text-align:center; flex-shrink:0;">
        <img src="${logoFull}" style="width:60px; height:auto;" />
      </div>
      <div style="flex:1; text-align:center; padding:0 8px;">
        <img src="${wordmark}" style="height:32px; width:auto;" />
        <div style="font-style:italic; font-size:7px; color:#222222; margin-top:2px;">The Pathway to High-Quality and Affordable Health Care</div>
        <div style="font-size:6.5px; color:#333333; margin-top:2px;">No. 2 Sultan Road, U/Rimi G.R.A., Kaduna.</div>
        <div style="font-size:6.5px; font-weight:bold; color:#101010; margin-top:1px;">Tel: 0807 237 2888, 0802 309 5497, 0807 500 4800</div>
        <div style="font-size:6.5px; font-weight:bold; font-style:italic; color:#1e3a8a; margin-top:1px;">e-mail: gardencityspecialisthospital@yahoo.com</div>
      </div>
      <div style="width:50px; flex-shrink:0; display:flex; justify-content:flex-end;">
        <svg width="34" height="34" viewBox="0 0 64 64" fill="none">
          <rect x="4" y="16" width="44" height="28" rx="4" fill="#b81828" />
          <path d="M48 24h10l4 8v12h-14V24z" fill="#b81828" />
          <circle cx="16" cy="46" r="6" fill="#101010" stroke="#ffffff" stroke-width="2" />
          <circle cx="48" cy="46" r="6" fill="#101010" stroke="#ffffff" stroke-width="2" />
          <rect x="8" y="20" width="12" height="10" fill="#ffffff" rx="1" />
          <path d="M30 24a5 5 0 1 0 6 7 6 6 0 1 1-6-7z" fill="#ffffff" />
        </svg>
      </div>
    </div>
  `;
}

function footerTemplateHtml(): string {
  return `
    <div style="width:100%; box-sizing:border-box; padding:0 ${SIDE_MARGIN_MM}mm 6px; display:flex; flex-direction:column; align-items:stretch; justify-content:flex-end; font-family:Arial,Helvetica,sans-serif;">
      <div style="height:22px; background:linear-gradient(90deg,#101010 50%,#b81828 85%,#e86828 100%); display:flex; align-items:center; justify-content:space-between; padding:0 8px; box-sizing:border-box; color:#ffffff; font-size:7px; font-weight:bold;">
        <span>Dr. Amir Ahmed Ibrahim (CMD), Nigerian</span>
        <span>Dr. Tawassul M. El-Amin (Medical Director), Nigerian</span>
      </div>
    </div>
  `;
}

export function medicalReportPdfHtml(opts: {
  patient: LabPdfPatient & { address?: string };
  data: MedicalReportData;
  isDraft: boolean;
}): string {
  const { patient, data, isDraft } = opts;
  const logoFull = getLogoFullDataUri();
  const wordmark = getWordmarkDataUri();
  const watermark = isDraft ? `<div class="watermark">DRAFT</div>` : "";
  const headerB64 = Buffer.from(headerTemplateHtml(logoFull, wordmark), "utf8").toString("base64");
  const footerB64 = Buffer.from(footerTemplateHtml(), "utf8").toString("base64");

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
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="pdf-margin" content="${HEADER_BAND_MM}mm ${SIDE_MARGIN_MM}mm ${FOOTER_BAND_MM}mm ${SIDE_MARGIN_MM}mm" />
<meta name="pdf-header-b64" content="${headerB64}" />
<meta name="pdf-footer-b64" content="${footerB64}" />
<style>
  ${getBaseFontFaces()}
  ${getSerifFontFaces()}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Lora", Georgia, serif;
    color: #101010;
    font-size: 10.5pt;
    line-height: 1.45;
    background: #ffffff;
  }
  .page { position: relative; }
  .watermark {
    position: absolute;
    top: 120mm;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 80pt;
    font-weight: bold;
    color: rgba(184, 24, 40, 0.08);
    transform: rotate(-35deg);
    pointer-events: none;
    z-index: 0;
  }
  .stethoscope-watermark {
    position: absolute;
    top: 90mm;
    left: 20%;
    width: 60%;
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
  }
  .content { position: relative; z-index: 1; }

  /* REPORT METADATA & TITLE */
  .meta-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: "Inter", Arial, sans-serif;
    font-size: 9pt;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .addressee {
    font-family: "Inter", Arial, sans-serif;
    font-size: 10pt;
    font-weight: bold;
    margin-bottom: 14px;
  }
  .report-title-header {
    text-align: center;
    font-family: "Inter", Arial, sans-serif;
    font-size: 13pt;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-decoration: underline;
    margin-bottom: 18px;
    color: #101010;
  }

  /* PATIENT INFORMATION BOX */
  .patient-box {
    border: 1px solid #1a1a1a;
    background-color: #fafafa;
    padding: 10px 14px;
    margin-bottom: 20px;
    border-radius: 2px;
    font-family: "Inter", Arial, sans-serif;
    font-size: 9pt;
    break-inside: avoid-page;
    page-break-inside: avoid;
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
    color: #101010;
    font-weight: 600;
  }

  /* REPORT SECTIONS */
  .section-block {
    margin-bottom: 16px;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  .section-heading {
    font-family: "Inter", Arial, sans-serif;
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #086838;
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
    break-inside: avoid-page;
    page-break-inside: avoid;
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
    font-family: "Caveat", cursive;
    font-weight: 600;
    font-size: 15pt;
    color: #1e3a8a;
    display: block;
    margin-bottom: 6px;
  }
  .doctor-name {
    font-family: "Inter", Arial, sans-serif;
    font-size: 10.5pt;
    font-weight: bold;
    color: #101010;
  }
  .doctor-title {
    font-family: "Inter", Arial, sans-serif;
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
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <svg class="stethoscope-watermark" viewBox="0 0 100 100" fill="none" stroke="#101010" stroke-width="1.5">
    <path d="M30,20 C30,40 45,55 50,70 C55,55 70,40 70,20 M30,20 L30,10 M70,20 L70,10 M50,70 C50,82 65,82 65,70 C65,65 60,65 60,70" />
    <circle cx="65" cy="70" r="4" fill="#101010" />
  </svg>

  <div class="content">
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
  </div>
</div>
</body>
</html>`;
}

export function medicalReportPdfFilename(patient: LabPdfPatient, date: string) {
  const name = patient.surname ? patient.surname.trim().replace(/\s+/g, "_") : "Patient";
  const d = date ? formatDate(date).replace(/\//g, "-") : formatDate(new Date()).replace(/\//g, "-");
  return `MedicalReport_${name}_${d}.pdf`;
}
