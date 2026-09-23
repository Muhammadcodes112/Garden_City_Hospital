import {
  getLogoMarkDataUri,
  getWordmarkGardenCityDataUri,
  getRussoOneFontFace,
  getBaseFontFaces,
} from "@/lib/pdf-assets";
import { pageGeometryCssFixed } from "@/lib/pdf-templates/print-shell";
import { LAB_FORM_COLUMNS, LAB_TEST_BY_ID } from "@/lib/lab-tests/catalog";
import { formatDate } from "@/lib/date";
import type { LabRequestData } from "@/lib/validators/lab-request";

const BRAND = {
  black: "#101010",
  green: "#086838",
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

type FieldSeg = { label: string; value: string; flex: number; html?: string };

function fieldGroup(fields: FieldSeg[]): string {
  const segs = fields
    .map(
      (f) => `
        <div class="field-seg" style="flex:${f.flex}">
          <span class="label">${escapeHtml(f.label)}</span>
          <span class="value">${f.html ?? escapeHtml(f.value)}</span>
          <span class="line"></span>
        </div>
      `,
    )
    .join("");
  return `<div class="field-group">${segs}</div>`;
}

function renderTestRow(label: string, checked: boolean) {
  return `<div class="test-row"><span class="test-label">${escapeHtml(label)}</span><span class="box">${checked ? "&#10003;" : ""}</span></div>`;
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

  const logoMark = getLogoMarkDataUri();
  const wordmarkGardenCity = getWordmarkGardenCityDataUri();

  const columns = LAB_FORM_COLUMNS.map(
    (col) => `<div class="col">${renderColumn(col.blocks, selected)}</div>`,
  ).join("");

  const watermark = isDraft ? `<div class="watermark">DRAFT</div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${getBaseFontFaces()}
  ${getRussoOneFontFace()}
  ${pageGeometryCssFixed("10mm 12mm")}
  body {
    font-family: "Inter", Arial, sans-serif;
    color: ${BRAND.black};
    font-size: 8.5pt;
    line-height: 1.15;
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
  .autofit-inner {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; flex-shrink: 0; }
  .header-left { width: 52px; flex-shrink: 0; }
  .logo { width: 52px; height: 52px; object-fit: contain; }
  .header-center { flex: 1; text-align: center; }
  .wordmark-block { display: inline-block; width: 230px; }
  .wordmark { display: block; width: 100%; height: auto; }
  .scanning {
    display: block;
    width: 100%;
    margin-top: 2px;
    font-family: "Russo One", Arial, sans-serif;
    font-size: 12.5pt;
    font-weight: 400;
    color: ${BRAND.green};
    letter-spacing: 0.02em;
    text-align: center;
    white-space: nowrap;
  }
  .tagline { font-size: 8pt; font-style: italic; margin-top: 2px; }
  .address { font-size: 7.5pt; margin-top: 3px; }
  .contact { font-size: 7pt; margin-top: 2px; }
  .title-banner {
    flex-shrink: 0;
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
  .field-group {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 6px;
    flex-shrink: 0;
  }
  .field-seg {
    position: relative;
    min-width: 0;
    padding-bottom: 2px;
  }
  .field-seg .label { font-weight: 600; margin-right: 4px; white-space: nowrap; }
  .field-seg .value {
    font-family: "Caveat", cursive;
    font-weight: 600;
    color: ${BRAND.ink};
    font-size: 11pt;
    display: inline-block;
    max-width: calc(100% - 2px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
  }
  .field-seg .line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    border-bottom: 1px solid ${BRAND.line};
    z-index: 0;
  }
  .rule-thick { border-top: 2.5px solid ${BRAND.line}; margin: 6px 0; flex-shrink: 0; }
  .columns {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0;
  }
  .col {
    min-width: 0;
    padding: 0 6px;
    border-right: 2.5px solid ${BRAND.line};
  }
  .col:first-child { padding-left: 0; }
  .col:last-child { padding-right: 0; border-right: none; }
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
  .test-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
  .footer-fields { margin-top: 4px; flex-shrink: 0; }
  .footer-fields .field-group:last-child { margin-bottom: 0; }
  .sig-img { max-height: 26px; max-width: 140px; vertical-align: bottom; }
  .hours-pill {
    flex-shrink: 0;
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
    flex-shrink: 0;
    text-align: center;
    font-family: "Lora", "Times New Roman", serif;
    font-weight: 700;
    font-style: italic;
    font-size: 9pt;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }
</style>
</head>
<body>
<div class="page" data-autofit>
  ${watermark}
  <div class="autofit-inner">
    <header class="header">
      <div class="header-left">
        <img class="logo" src="${logoMark}" alt="" />
      </div>
      <div class="header-center">
        <div class="wordmark-block">
          <img class="wordmark" src="${wordmarkGardenCity}" alt="Garden City" />
          <div class="scanning">SCANNING &amp; DIAGNOSTIC CENTER</div>
        </div>
        <div class="tagline">... Hospitality in Hospital</div>
        <div class="address">NO: 2 Sultan Road Ungwan Rimi G.R.A., Kaduna.</div>
        <div class="contact">Tel: 062293293, 08077062451 E-mail: gardencityspecialisthospital@yahoo.com</div>
      </div>
    </header>

    <div class="title-banner">LABORATORY REQUEST FORM</div>

    ${fieldGroup([
      { label: "Patient's Name:", value: patientName, flex: 3 },
      { label: "Age:", value: patient.age || "", flex: 1 },
      { label: "Sex:", value: patient.sex || "", flex: 1 },
    ])}
    ${fieldGroup([
      {
        label: "Provisional Diagnosis/Clinical Information:",
        value: data.provisionalDiagnosis || "",
        flex: 3,
      },
      { label: "Time of Collection:", value: collection, flex: 1.5 },
    ])}

    <div class="rule-thick"></div>
    <div class="columns">${columns}</div>
    <div class="rule-thick"></div>

    <div class="footer-fields">
      ${fieldGroup([
        { label: "Referring Doctor:", value: data.referringDoctor || "", flex: 2 },
        { label: "Phone No.:", value: data.referringPhone || "", flex: 1 },
      ])}
      ${fieldGroup([
        {
          label: "Doctor's Signature:",
          value: "",
          html: signatureHtml(data.doctorSignature),
          flex: 1,
        },
      ])}
      ${fieldGroup([
        { label: "Hospital/Clinic:", value: data.hospitalClinic || "", flex: 2 },
        { label: "Date:", value: data.formDate ? formatDate(data.formDate) : "", flex: 1 },
      ])}
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
