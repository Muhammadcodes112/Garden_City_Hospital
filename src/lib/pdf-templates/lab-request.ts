import { getLogoDataUri } from "@/lib/pdf-assets";
import { LAB_FORM_COLUMNS, LAB_TEST_BY_ID } from "@/lib/lab-tests/catalog";
import { formatDate } from "@/lib/date";
import type { LabRequestData } from "@/lib/validators/lab-request";

const BRAND = {
  black: "#111111",
  red: "#e3262b",
  green: "#0b6b3a",
  grey: "#4a4a4a",
  line: "#1a1a1a",
  ink: "#1e3a8a",
};

export type LabPdfPatient = {
  surname: string;
  firstNames: string;
  age: string;
  sex: string;
  hospitalNumber?: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldLine(label: string, value: string, wide = false) {
  const v = escapeHtml(value || "");
  return `<div class="field-row${wide ? " wide" : ""}"><span class="label">${escapeHtml(label)}</span><span class="value">${v}</span><span class="line"></span></div>`;
}

function renderTestRow(label: string, checked: boolean) {
  return `<div class="test-row"><span class="test-label">${escapeHtml(label)}</span><span class="box">${checked ? "✓" : ""}</span></div>`;
}

function renderColumn(blocks: (typeof LAB_FORM_COLUMNS)[0]["blocks"], selected: Set<string>) {
  return blocks
    .map((block) => {
      const title =
        block.kind === "section" && block.title
          ? `<div class="section-title">${escapeHtml(block.title)}</div>`
          : block.kind === "subsection"
            ? `<div class="subsection-title">${escapeHtml(block.title)}</div>`
            : "";
      const tests = block.tests
        .map((t) => renderTestRow(t.label, selected.has(t.id)))
        .join("");
      return `${title}${tests}`;
    })
    .join("");
}

function signatureHtml(sig: LabRequestData["doctorSignature"]) {
  if (!sig?.data) return "";
  if (sig.mode === "draw") {
    return `<img src="${sig.data}" alt="Signature" class="sig-img" />`;
  }
  return escapeHtml(sig.data);
}

export function labRequestPdfHtml(opts: {
  patient: LabPdfPatient;
  data: LabRequestData;
  isDraft: boolean;
}): string {
  const { patient, data, isDraft } = opts;
  const selected = new Set(data.testsSelected);
  const patientName = `${patient.firstNames} ${patient.surname}`.trim();
  const collection =
    [data.collectionDate ? formatDate(data.collectionDate) : "", data.collectionTime]
      .filter(Boolean)
      .join(" ") || "";

  const logo = getLogoDataUri();

  const columns = LAB_FORM_COLUMNS.map(
    (col) => `<div class="col">${renderColumn(col.blocks, selected)}</div>`,
  ).join("");

  const watermark = isDraft
    ? `<div class="watermark">DRAFT</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: ${BRAND.black};
    font-size: 8.5pt;
    line-height: 1.15;
  }
  .page { position: relative; padding: 0; }
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
  .content { position: relative; z-index: 1; }
  .header { text-align: center; margin-bottom: 6px; }
  .header-row { display: flex; align-items: flex-start; justify-content: center; gap: 10px; }
  .logo { width: 52px; height: 52px; object-fit: contain; }
  .wordmark {
    font-size: 22pt;
    font-weight: 900;
    letter-spacing: 0.12em;
    line-height: 1;
  }
  .wordmark .garden { color: ${BRAND.black}; }
  .wordmark .city { color: ${BRAND.red}; }
  .scanning {
    font-size: 11pt;
    font-weight: 800;
    color: ${BRAND.green};
    letter-spacing: 0.06em;
    margin-top: 2px;
  }
  .tagline { font-size: 8pt; font-style: italic; margin-top: 2px; }
  .address { font-size: 7.5pt; margin-top: 3px; }
  .contact { font-size: 7pt; margin-top: 2px; }
  .title-banner {
    margin: 8px auto 6px;
    max-width: 280px;
    background: ${BRAND.grey};
    color: #fff;
    font-weight: 800;
    font-size: 10pt;
    text-align: center;
    padding: 4px 12px;
    border-radius: 999px;
    letter-spacing: 0.04em;
  }
  .field-row {
    position: relative;
    margin-bottom: 5px;
    min-height: 14px;
  }
  .field-row.wide { margin-bottom: 6px; }
  .field-row .label { font-weight: 600; margin-right: 4px; }
  .field-row .value {
    font-family: "Segoe Print", "Comic Sans MS", cursive;
    color: ${BRAND.ink};
    font-size: 9pt;
    position: relative;
    z-index: 1;
  }
  .field-row .line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-bottom: 1px solid ${BRAND.line};
    z-index: 0;
  }
  .rule-thick { border-top: 2.5px solid ${BRAND.line}; margin: 6px 0; }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0;
    min-height: 0;
  }
  .col {
    padding: 0 5px;
    border-right: 2.5px solid ${BRAND.line};
  }
  .col:last-child { border-right: none; }
  .section-title {
    font-weight: 800;
    text-decoration: underline;
    text-transform: uppercase;
    font-size: 7.5pt;
    margin: 4px 0 2px;
  }
  .subsection-title {
    font-weight: 700;
    text-decoration: underline;
    font-size: 7.5pt;
    margin: 3px 0 2px;
  }
  .test-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-bottom: 1px;
    font-size: 7.5pt;
  }
  .test-label { flex: 1; }
  .box {
    width: 9px;
    height: 9px;
    border: 1px solid ${BRAND.line};
    flex-shrink: 0;
    font-size: 8pt;
    font-weight: 800;
    line-height: 7px;
    text-align: center;
  }
  .footer-fields { margin-top: 4px; }
  .sig-img { max-height: 28px; max-width: 120px; vertical-align: middle; }
  .hours-pill {
    margin: 8px auto 2px;
    max-width: 320px;
    background: ${BRAND.black};
    color: #fff;
    text-align: center;
    font-size: 7.5pt;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .emergency {
    text-align: center;
    font-family: "Times New Roman", Times, serif;
    font-weight: 800;
    font-size: 9pt;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <div class="content">
    <header class="header">
      <div class="header-row">
        <img class="logo" src="${logo}" alt="" />
        <div>
          <div class="wordmark"><span class="garden">GARDEN</span> <span class="city">CITY</span></div>
          <div class="scanning">SCANNING &amp; DIAGNOSTIC CENTER</div>
        </div>
      </div>
      <div class="tagline">... Hospitality in Hospital</div>
      <div class="address">NO: 2 Sultan Road Ungwan Rimi G.R.A., Kaduna.</div>
      <div class="contact">Tel: 062293293, 08077062451 E-mail: gardencityspecialisthospital@yahoo.com</div>
    </header>

    <div class="title-banner">LABORATORY REQUEST FORM</div>

    ${fieldLine("Patient's Name:", patientName)}
    ${fieldLine("Age:", patient.age || "")}
    ${fieldLine("Sex:", patient.sex || "")}
    ${fieldLine("Provisional Diagnosis/Clinical Information:", data.provisionalDiagnosis || "", true)}
    ${fieldLine("Time of Collection:", collection, true)}

    <div class="rule-thick"></div>
    <div class="columns">${columns}</div>
    <div class="rule-thick"></div>

    <div class="footer-fields">
      ${fieldLine("Referring Doctor:", data.referringDoctor || "")}
      ${fieldLine("Phone No.:", data.referringPhone || "")}
      <div class="field-row wide">
        <span class="label">Doctor's Signature:</span>
        <span class="value">${signatureHtml(data.doctorSignature)}</span>
        <span class="line"></span>
      </div>
      ${fieldLine("Hospital/Clinic:", data.hospitalClinic || "")}
      ${fieldLine("Date:", data.formDate ? formatDate(data.formDate) : "")}
    </div>

    <div class="hours-pill">WORKING HOURS 8:00AM - 10:00PM (MON-SUN)</div>
    <div class="emergency">24 HOURS EMERGENCY SERVICE</div>
  </div>
</div>
</body>
</html>`;
}

export function labRequestPdfFilename(patient: LabPdfPatient, formDate: string) {
  const name = `${patient.firstNames}_${patient.surname}`.trim().replace(/\s+/g, "_") || "Patient";
  const d = formDate ? formatDate(formDate).replace(/\//g, "-") : formatDate(new Date()).replace(/\//g, "-");
  return `LabRequest_${name}_${d}.pdf`;
}

/** Guard unused import for tree-shaking clarity in strict mode */
void LAB_TEST_BY_ID;
