import { getLogoMarkDataUri, getWordmarkDataUri, getBaseFontFaces } from "@/lib/pdf-assets";
import { pageGeometryCssFlow } from "@/lib/pdf-templates/print-shell";
import { formatDate } from "@/lib/date";
import type { LabPdfPatient } from "@/lib/pdf-templates/lab-request";
import type { PrescriptionData, PrescriptionItem } from "@/lib/validators/prescription";

const BRAND = {
  black: "#101010",
  green: "#086838",
  line: "#1a1a1a",
  ink: "#1e3a8a",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrescriptionItem(item: PrescriptionItem, index: number): string {
  const parts: string[] = [];

  const nameStr = [item.drugName, item.strength, item.dosageForm]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" ");

  if (!nameStr) return "";

  parts.push(`<strong>${index + 1}. ${nameStr}</strong>`);

  const rxDetails: string[] = [];
  if (item.dose) rxDetails.push(escapeHtml(item.dose));
  if (item.route) rxDetails.push(escapeHtml(item.route));
  if (item.frequency) rxDetails.push(escapeHtml(item.frequency));
  if (item.duration) rxDetails.push(`x ${escapeHtml(item.duration)}`);
  if (item.quantity) rxDetails.push(`(Qty: ${escapeHtml(item.quantity)})`);

  if (rxDetails.length > 0) {
    parts.push(rxDetails.join(", "));
  }

  if (item.instructions) {
    parts.push(`<div class="instructions">${escapeHtml(item.instructions)}</div>`);
  }

  return `<li class="rx-item">${parts.join(" — ")}</li>`;
}

function signatureHtml(sig: PrescriptionData["prescriberSignature"]) {
  if (!sig?.data) return "";
  if (sig.mode === "draw") {
    return `<img src="${sig.data}" alt="Signature" class="sig-img" />`;
  }
  return escapeHtml(sig.data);
}

export function prescriptionPdfHtml(opts: {
  patient: LabPdfPatient;
  data: PrescriptionData;
  isDraft: boolean;
}): string {
  const { patient, data, isDraft } = opts;
  const logoMark = getLogoMarkDataUri();
  const wordmark = getWordmarkDataUri();

  const formattedItems = (data.items || [])
    .map((item, idx) => formatPrescriptionItem(item, idx))
    .filter(Boolean)
    .join("\n");

  const watermark = isDraft ? `<div class="watermark">DRAFT</div>` : "";

  const prescriberSignDate = [
    signatureHtml(data.prescriberSignature),
    data.prescriberDate ? formatDate(data.prescriberDate) : "",
  ]
    .filter(Boolean)
    .join(" / ");

  const pharmacistSignDate = [
    signatureHtml(data.pharmacistSignature),
    data.pharmacistDate ? formatDate(data.pharmacistDate) : "",
  ]
    .filter(Boolean)
    .join(" / ");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${getBaseFontFaces()}
  ${pageGeometryCssFlow("10mm 12mm 10mm 20mm")}
  body {
    font-family: "Inter", Arial, sans-serif;
    color: ${BRAND.black};
    font-size: 9.5pt;
    line-height: 1.3;
  }
  .watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 72pt;
    font-weight: bold;
    color: rgba(0,0,0,0.08);
    transform: rotate(-35deg);
    pointer-events: none;
    z-index: 0;
  }
  .content { position: relative; z-index: 1; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .margin-rule {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -10mm;
    width: 0.75pt;
    background: ${BRAND.black};
  }

  .header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
  .header-left { width: 56px; flex-shrink: 0; }
  .logo { width: 56px; height: 56px; object-fit: contain; }
  .header-center { flex: 1; text-align: center; }
  .wordmark { height: 40px; width: auto; }
  .address { font-size: 8pt; margin-top: 3px; }
  .contact { font-size: 7.5pt; margin-top: 2px; }
  .email { font-size: 7.5pt; font-style: italic; margin-top: 1px; }

  .title {
    text-align: center;
    font-weight: 800;
    font-size: 11pt;
    letter-spacing: 0.05em;
    margin: 10px 0 8px;
    text-decoration: underline;
  }

  .patient-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  .patient-table td {
    border: 1px solid ${BRAND.line};
    width: 25%;
    padding: 4px 6px 6px;
    vertical-align: top;
    height: 38px;
  }
  .patient-table .cell-label {
    font-size: 7pt;
    font-weight: 600;
    color: #4a4a4a;
    display: block;
  }
  .patient-table .cell-value {
    font-family: "Caveat", cursive;
    font-weight: 600;
    color: ${BRAND.ink};
    font-size: 9.5pt;
    margin-top: 2px;
  }

  .rx-body {
    flex: 1;
    min-height: 0;
  }
  .rx-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .rx-item {
    margin-bottom: 12px;
    font-size: 10pt;
    line-height: 1.4;
  }
  .rx-item .instructions {
    font-style: italic;
    font-size: 8.5pt;
    color: #444;
    margin-top: 2px;
    margin-left: 16px;
  }

  .footer-section {
    margin-top: auto;
    padding-top: 12px;
  }
  .footer-row {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 12px;
    min-height: 24px;
  }
  .footer-row .field {
    flex: 1;
    position: relative;
    padding-bottom: 2px;
  }
  .footer-row .label { font-weight: 600; font-size: 8.5pt; margin-right: 6px; }
  .footer-row .value {
    font-family: "Caveat", cursive;
    font-weight: 600;
    color: ${BRAND.ink};
    font-size: 9.5pt;
  }
  .footer-row .line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-bottom: 1px solid ${BRAND.line};
  }
  .sig-img { max-height: 26px; max-width: 120px; vertical-align: middle; }
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <div class="content">
    <div class="margin-rule"></div>
    <header class="header">
      <div class="header-left">
        <img class="logo" src="${logoMark}" alt="" />
      </div>
      <div class="header-center">
        <img class="wordmark" src="${wordmark}" alt="Garden City Specialist Hospital" />
        <div class="address">No. 2 Sultan Road, U/Rimi G.R.A., Kaduna.</div>
        <div class="contact">Tel: 0807 237 2888, 0802 309 5497, 0807 500 4800</div>
        <div class="email">e-mail: gardencityspecialisthospital@yahoo.com</div>
      </div>
    </header>

    <div class="title">PRESCRIPTION FORM</div>

    <table class="patient-table">
      <tr>
        <td>
          <span class="cell-label">Surname</span>
          <div class="cell-value">${escapeHtml(patient.surname || "")}</div>
        </td>
        <td>
          <span class="cell-label">First name(s)</span>
          <div class="cell-value">${escapeHtml(patient.firstNames || "")}</div>
        </td>
        <td>
          <span class="cell-label">Age</span>
          <div class="cell-value">${escapeHtml(patient.age || "")}</div>
        </td>
        <td>
          <span class="cell-label">Hospital No.</span>
          <div class="cell-value">${escapeHtml(patient.hospitalNumber || "")}</div>
        </td>
      </tr>
    </table>

    <div class="rx-body">
      ${
        formattedItems
          ? `<ul class="rx-list">${formattedItems}</ul>`
          : `<p style="color: #888; font-style: italic;">No drugs prescribed.</p>`
      }
    </div>

    <div class="footer-section">
      <div class="footer-row">
        <div class="field">
          <span class="label">Prescriber's Name:</span>
          <span class="value">${escapeHtml(data.prescriberName || "")}</span>
          <span class="line"></span>
        </div>
        <div class="field" style="max-width: 260px; margin-left: 20px;">
          <span class="label">Sign/Date:</span>
          <span class="value">${prescriberSignDate}</span>
          <span class="line"></span>
        </div>
      </div>

      <div class="footer-row">
        <div class="field">
          <span class="label">Pharmacist:</span>
          <span class="value">${escapeHtml(data.pharmacistName || "")}</span>
          <span class="line"></span>
        </div>
        <div class="field" style="max-width: 260px; margin-left: 20px;">
          <span class="label">Sign/Date:</span>
          <span class="value">${pharmacistSignDate}</span>
          <span class="line"></span>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export function prescriptionPdfFilename(patient: LabPdfPatient, date: string) {
  const name = patient.surname ? patient.surname.trim().replace(/\s+/g, "_") : "Patient";
  const d = date ? formatDate(date).replace(/\//g, "-") : formatDate(new Date()).replace(/\//g, "-");
  return `Prescription_${name}_${d}.pdf`;
}
