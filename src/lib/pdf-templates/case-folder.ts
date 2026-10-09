import {
  getLogoMarkDataUri,
  getWordmarkGardenCityDataUri,
  getLogoFullDataUri,
  getBaseFontFaces,
} from "@/lib/pdf-assets";
import { formatDate } from "@/lib/date";

export type CaseFilePatientData = {
  surname: string;
  firstNames: string;
  hospitalNumber: string;
  age?: string;
  sex?: string;
  dob?: string;
  maritalStatus?: string;
  phone?: string;
  address?: string;
  nextOfKinName?: string;
  nextOfKinRelationship?: string;
  nextOfKinPhone?: string;
  nextOfKinAddress?: string;
  xRayNumber?: string;
  placeOfOrigin?: string;
  tribe?: string;
  occupation?: string;
  religion?: string;
  bloodGroup?: string;
  rhesus?: string;
  genotype?: string;
  allergies?: string;
  status?: string;
  doctor?: string;
  caseFolderPreparedBy?: string;
  hasOperations?: boolean;
  hospitalHistory?: {
    dateAttended?: string;
    referredBy?: string;
    physician?: string;
    wardClinic?: string;
    dateDischarged?: string;
    disposal?: string;
    assetpay?: string;
  }[];
  clinicalNotes?: {
    date?: string;
    note?: string;
  }[];
  diagnoses?: {
    date?: string;
    diagnosis?: string;
    code?: string;
  }[];
  operations?: {
    date?: string;
    operation?: string;
    code?: string;
  }[];
  operationConsents?: {
    surgeonName?: string;
    procedureName?: string;
    consentDate?: string;
    patientSignature?: string;
    witnessName?: string;
    witnessSignature?: string;
  }[];
};

function escapeHtml(s?: string) {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function caseFolderPdfHtml(opts: {
  patient: CaseFilePatientData;
}): string {
  const { patient } = opts;
  const logoMark = getLogoMarkDataUri();
  const wordmarkGardenCity = getWordmarkGardenCityDataUri();
  const logoFull = getLogoFullDataUri();

  const patientName = `${patient.surname} ${patient.firstNames}`.trim() || "Unnamed Patient";
  const hasOps = Boolean(patient.hasOperations || (patient.operations && patient.operations.length > 0) || (patient.operationConsents && patient.operationConsents.length > 0));

  const historyRows = (patient.hospitalHistory || [])
    .map(
      (h) => `
      <tr>
        <td>${escapeHtml(h.dateAttended ? formatDate(h.dateAttended) : "")}</td>
        <td>${escapeHtml(h.referredBy)}</td>
        <td>${escapeHtml(h.physician)}</td>
        <td>${escapeHtml(h.wardClinic)}</td>
        <td>${escapeHtml(h.dateDischarged ? formatDate(h.dateDischarged) : "")}</td>
        <td>${escapeHtml(h.disposal)}</td>
        <td>${escapeHtml(h.assetpay)}</td>
      </tr>
    `,
    )
    .join("");

  const clinicalNoteRows = (patient.clinicalNotes || [])
    .map(
      (n) => `
      <tr>
        <td style="width: 20%;">${escapeHtml(n.date ? formatDate(n.date) : "")}</td>
        <td style="white-space: pre-wrap;">${escapeHtml(n.note)}</td>
      </tr>
    `,
    )
    .join("");

  const diagnosisRows = (patient.diagnoses || [])
    .map(
      (d) => `
      <tr>
        <td>${escapeHtml(d.date ? formatDate(d.date) : "")}</td>
        <td>${escapeHtml(d.diagnosis)}</td>
        <td class="code">${escapeHtml(d.code)}</td>
      </tr>
    `,
    )
    .join("");

  const operationRows = (patient.operations || [])
    .map(
      (o) => `
      <tr>
        <td>${escapeHtml(o.date ? formatDate(o.date) : "")}</td>
        <td>${escapeHtml(o.operation)}</td>
        <td class="code">${escapeHtml(o.code)}</td>
      </tr>
    `,
    )
    .join("");

  const consentBlocks = (patient.operationConsents && patient.operationConsents.length > 0
    ? patient.operationConsents
    : [{}, {}, {}]
  ).slice(0, 3).map((c, idx) => `
    <div class="consent-block">
      <div class="consent-title">CONSENT OF OPERATION</div>
      <p class="consent-body">
        To the Medical Staff and Committee Management of <strong>Garden City Specialist Hospital</strong> I 
        <span class="fill-line inline-block min-w-[140px]">${escapeHtml(patientName)}</span> 
        hereby consent to undergo the operation of 
        <span class="fill-line inline-block min-w-[160px]">${escapeHtml(c.procedureName || "__________________")}</span> 
        the effect and nature of which has been explained to me by 
        <span class="fill-line inline-block min-w-[140px]">${escapeHtml(c.surgeonName || "__________________")}</span>.<br/>
        I also consent to such further alternative operation measures as may be found to be necessary during the course of such operation and to the administration of a local or other anaesthetic or any of the foregoing purposes.<br/>
        I understand an assurance has not been given and that the operation will be performed by a particular surgeon.
      </p>
      <div class="consent-footer">
        <div>Dated this <span class="fill-line min-w-[40px] text-center inline-block">${c.consentDate ? new Date(c.consentDate).getDate() : "__"}</span> day of <span class="fill-line min-w-[70px] text-center inline-block">${c.consentDate ? new Date(c.consentDate).toLocaleString("en-US", { month: "long" }) : "______"}</span> 20<span class="fill-line min-w-[30px] inline-block">${c.consentDate ? new Date(c.consentDate).getFullYear().toString().slice(-2) : "__"}</span></div>
        <div class="sig-row">
          <div>Sign: <span class="fill-line min-w-[100px] inline-block">${escapeHtml(c.patientSignature || "")}</span> <span class="subtext">(Pt/Next of Kin)</span></div>
          <div>Witness Sign: <span class="fill-line min-w-[100px] inline-block">${escapeHtml(c.witnessSignature || "")}</span></div>
          <div>Name: <span class="fill-line min-w-[90px] inline-block">${escapeHtml(c.witnessName || "")}</span> <span class="subtext">(Witness)</span></div>
        </div>
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  ${getBaseFontFaces()}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; font-family: "Inter", Arial, sans-serif; color: #101010; }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
    background: #ffdede; /* Physical Pink Case Folder Color */
    padding: 12mm 15mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
    box-sizing: border-box;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  /* PAGE 1: COVER PAGE */
  .cover-header-box {
    border: 2px solid #101010;
    display: grid;
    grid-template-columns: 1fr 1.5fr 1fr;
    border-collapse: collapse;
    background: #fff0f0;
  }
  .cover-header-cell {
    border-right: 2px solid #101010;
    padding: 8px 12px;
    height: 65px;
  }
  .cover-header-cell:last-child { border-right: none; }
  .cell-label { font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #333; }
  .cell-val { font-size: 13pt; font-weight: 900; font-family: "Inter", sans-serif; color: #101010; margin-top: 4px; }

  .confidential-title {
    text-align: center;
    font-size: 32pt;
    font-weight: 900;
    letter-spacing: 0.18em;
    font-family: "Times New Roman", Times, serif;
    margin: 25px 0 15px;
    color: #101010;
  }

  .cover-logo-center {
    text-align: center;
    margin: 10px 0 20px;
  }
  .logo-square {
    width: 140px;
    height: 140px;
    margin: 0 auto;
    object-fit: contain;
  }
  .hospital-brand-title {
    font-size: 26pt;
    font-weight: 900;
    letter-spacing: 0.04em;
    color: #101010;
    margin-top: 10px;
  }
  .hospital-sub-title {
    font-size: 14pt;
    font-weight: 800;
    background: #101010;
    color: #ffffff;
    padding: 4px 16px;
    display: inline-block;
    border-radius: 4px;
    margin-top: 4px;
    letter-spacing: 0.06em;
  }
  .tagline-text {
    font-style: italic;
    font-size: 10.5pt;
    margin-top: 8px;
    color: #444;
  }
  .contact-footer-block {
    text-align: center;
    font-size: 9.5pt;
    font-weight: 600;
    line-height: 1.5;
    margin-top: 15px;
  }
  .prepared-by-line {
    font-size: 10pt;
    font-weight: 800;
    margin-top: 40px;
    border-top: 1.5px solid #101010;
    padding-top: 6px;
  }

  /* PAGE 2: DEMOGRAPHICS & CLINICAL HISTORY */
  .p2-header-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #101010;
    background: #ffffff;
    font-size: 8.5pt;
    margin-bottom: 10px;
  }
  .p2-header-table td {
    border: 1px solid #101010;
    padding: 3px 6px;
    vertical-align: top;
  }
  .p2-lbl { font-size: 7.5pt; font-weight: 700; color: #444; text-transform: uppercase; }
  .p2-val { font-size: 9.5pt; font-weight: 800; color: #101010; }

  .section-table-title {
    font-size: 9pt;
    font-weight: 900;
    text-transform: uppercase;
    margin: 8px 0 3px;
    letter-spacing: 0.05em;
  }

  .grid-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #101010;
    background: #ffffff;
    font-size: 8pt;
    margin-bottom: 8px;
  }
  .grid-table th {
    border: 1px solid #101010;
    background: #f0c8c8;
    padding: 4px;
    font-weight: 800;
    text-align: left;
  }
  .grid-table td {
    border: 1px solid #101010;
    padding: 3px 4px;
    height: 20px;
  }
  .grid-table td.code { font-family: monospace; font-weight: 700; }

  .bottom-box-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  .alert-box {
    border: 2px solid #b81828;
    background: #fff5f5;
    padding: 6px;
    border-radius: 2px;
    font-size: 8pt;
  }
  .alert-box .lbl { font-weight: 800; color: #b81828; text-transform: uppercase; }
  .alert-box .val { font-weight: 800; font-size: 9pt; color: #101010; margin-top: 2px; }

  .blood-box {
    border: 1.5px solid #101010;
    background: #ffffff;
    padding: 6px;
    font-size: 8pt;
  }

  /* PAGE 3: OPERATION CONSENTS & FILING ORDER */
  .p3-layout {
    display: grid;
    grid-template-columns: 1fr 190px;
    gap: 12px;
    height: 100%;
  }
  .consents-column {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .consent-block {
    border: 1.5px solid #101010;
    background: #ffffff;
    padding: 10px;
    font-size: 7.5pt;
    line-height: 1.35;
  }
  .consent-title {
    text-align: center;
    font-weight: 900;
    font-size: 9pt;
    text-decoration: underline;
    margin-bottom: 6px;
  }
  .fill-line { border-bottom: 1px solid #101010; padding: 0 4px; font-weight: 700; }
  .consent-footer { margin-top: 8px; font-size: 7.5pt; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-top: 6px; }
  .subtext { font-size: 6.5pt; color: #555; }

  .filing-sidebar {
    border: 1.5px solid #101010;
    background: #ffffff;
    padding: 10px 8px;
    font-size: 7pt;
  }
  .filing-sidebar h4 {
    font-weight: 900;
    font-size: 7.5pt;
    text-transform: uppercase;
    margin: 0 0 8px;
    border-bottom: 1px solid #101010;
    padding-bottom: 3px;
  }
  .filing-sidebar ol { margin: 0; padding-left: 14px; }
  .filing-sidebar li { margin-bottom: 6px; font-weight: 700; }
</style>
</head>
<body>

<!-- PAGE 1: CASE FOLDER COVER PAGE (IMAGE 1) -->
<div class="page">
  <div>
    <div class="cover-header-box">
      <div class="cover-header-cell">
        <div class="cell-label">SURNAME</div>
        <div class="cell-val">${escapeHtml(patient.surname)}</div>
      </div>
      <div class="cover-header-cell">
        <div class="cell-label">FIRST NAME(S)</div>
        <div class="cell-val">${escapeHtml(patient.firstNames)}</div>
      </div>
      <div class="cover-header-cell">
        <div class="cell-label">HOSPITAL NUMBER</div>
        <div class="cell-val">${escapeHtml(patient.hospitalNumber)}</div>
      </div>
    </div>

    <div class="confidential-title">CONFIDENTIAL</div>

    <div class="cover-logo-center">
      <img src="${logoMark}" class="logo-square" alt="Garden City Logo" />
      <div class="hospital-brand-title">GARDEN CITY</div>
      <div class="hospital-sub-title">SPECIALIST HOSPITAL</div>
      <div class="tagline-text">The Pathway to High-Quality and Affordable Health Care</div>
    </div>

    <div class="contact-footer-block">
      No: 2 Sultan Road Ungwan Rimi G.R.A., Kaduna.<br/>
      Tel: 062-293293, 08077062451, Email: gardencityspecialisthospital@yahoo.com
    </div>
  </div>

  <div class="prepared-by-line">
    CASE FOLDER PREPARED BY: <span class="fill-line inline-block min-w-[300px]">${escapeHtml(patient.caseFolderPreparedBy || "Medical Records Officer")}</span>
  </div>
</div>

<!-- PAGE 2: DEMOGRAPHICS, HISTORY, DIAGNOSES & BLOOD/ALLERGIES (IMAGE 2) -->
<div class="page">
  <div>
    <table class="p2-header-table">
      <tr>
        <td style="width: 30%;">
          <div class="p2-lbl">Surname</div>
          <div class="p2-val">${escapeHtml(patient.surname)}</div>
        </td>
        <td style="width: 40%;">
          <div class="p2-lbl">Firstname</div>
          <div class="p2-val">${escapeHtml(patient.firstNames)}</div>
        </td>
        <td style="width: 30%;">
          <div class="p2-lbl">Number</div>
          <div class="p2-val">${escapeHtml(patient.hospitalNumber)}</div>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="p2-lbl">House Address</div>
          <div class="p2-val">${escapeHtml(patient.address || "N/A")}</div>
        </td>
        <td>
          <div class="p2-lbl">Date of Birth / Sex / Marital</div>
          <div class="p2-val">${escapeHtml(patient.dob || patient.age || "N/A")} · ${escapeHtml(patient.sex || "")} · ${escapeHtml(patient.maritalStatus || "")}</div>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="p2-lbl">Name of Next of Kin (${escapeHtml(patient.nextOfKinRelationship)})</div>
          <div class="p2-val">${escapeHtml(patient.nextOfKinName || "N/A")} ${patient.nextOfKinPhone ? `(${patient.nextOfKinPhone})` : ""}</div>
        </td>
        <td>
          <div class="p2-lbl">Address of Next of Kin</div>
          <div class="p2-val">${escapeHtml(patient.nextOfKinAddress || "Same as patient")}</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="p2-lbl">Place of Origin</div>
          <div class="p2-val">${escapeHtml(patient.placeOfOrigin || "Kaduna")}</div>
        </td>
        <td>
          <div class="p2-lbl">Tribe / Occupation / Religion</div>
          <div class="p2-val">${escapeHtml(patient.tribe || "")} · ${escapeHtml(patient.occupation || "")} · ${escapeHtml(patient.religion || "")}</div>
        </td>
        <td>
          <div class="p2-lbl">X-Ray Number</div>
          <div class="p2-val">${escapeHtml(patient.xRayNumber || "N/A")}</div>
        </td>
      </tr>
    </table>

    <div class="section-table-title">HOSPITAL HISTORY</div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 14%;">Date Attended</th>
          <th style="width: 16%;">Referred By</th>
          <th style="width: 18%;">Physician / Surgeon</th>
          <th style="width: 14%;">Ward / Clinic</th>
          <th style="width: 14%;">Discharged</th>
          <th style="width: 12%;">Disposal</th>
          <th style="width: 12%;">Assetpay</th>
        </tr>
      </thead>
      <tbody>
        ${historyRows || `<tr><td colspan="7" style="text-align:center; color:#888; font-style:italic;">No hospital visits recorded</td></tr>`}
      </tbody>
    </table>

    <div class="section-table-title">CLINICAL NOTES / EXAMINATION FINDINGS</div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 20%;">Date</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        ${clinicalNoteRows || `<tr><td colspan="2" style="text-align:center; color:#888; font-style:italic;">No clinical notes recorded</td></tr>`}
      </tbody>
    </table>

    <div class="section-table-title">DIAGNOSIS</div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 20%;">Date</th>
          <th>Diagnosis</th>
          <th style="width: 25%;">Code Number</th>
        </tr>
      </thead>
      <tbody>
        ${diagnosisRows || `<tr><td colspan="3" style="text-align:center; color:#888; font-style:italic;">No diagnosis recorded</td></tr>`}
      </tbody>
    </table>

    <div class="section-table-title">OPERATIONS</div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 20%;">Date</th>
          <th>Operation</th>
          <th style="width: 25%;">Code Number</th>
        </tr>
      </thead>
      <tbody>
        ${operationRows || `<tr><td colspan="3" style="text-align:center; color:#888; font-style:italic;">No surgical operations recorded</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="bottom-box-grid">
    <div class="alert-box">
      <div class="lbl">IMPORTANT: Sensitive / Allergic to:</div>
      <div class="val">${escapeHtml(patient.allergies || "No Known Medical Allergies (NKDA)")}</div>
    </div>
    <div class="blood-box">
      <div class="p2-lbl">Blood Group / Rhesus</div>
      <div class="p2-val">${escapeHtml(patient.bloodGroup || "N/A")} (${escapeHtml(patient.rhesus || "")})</div>
    </div>
    <div class="blood-box">
      <div class="p2-lbl">Hb / Genotype</div>
      <div class="p2-val">${escapeHtml(patient.genotype || "N/A")}</div>
    </div>
  </div>
</div>

<!-- PAGE 3: OPERATION CONSENTS & ORDER OF FILING (IMAGE 3 - ONLY WHEN PATIENT HAS OPERATIONS) -->
${
  hasOps
    ? `
<div class="page">
  <div class="p3-layout">
    <div class="consents-column">
      ${consentBlocks}
    </div>

    <div class="filing-sidebar">
      <h4>ORDER OF FILING OF CONTENT OF CASE FOLDER</h4>
      <ol>
        <li>CASE SUMMARY</li>
        <li>OUT-PATIENT NOTES-BY DATE</li>
        <li>IN-PATIENT NOTES-BY DATE</li>
        <li>LAB. MOUNT SHEET</li>
        <li>OTHER REPORTS</li>
        <li>OPERATION NOTES</li>
        <li>ANAESTHESIA SHEET</li>
        <li>LABOUR RECORD</li>
        <li>TREATMENT SHEET-BY DATE</li>
        <li>FLUID BALANCE SHEET-BY DATE</li>
        <li>OBSERVATION NOTE-BY DATE</li>
        <li>OTHERS CORRESPONDENCE</li>
        <li>CERTIFICATES ETC</li>
      </ol>
    </div>
  </div>
</div>
`
    : ""
}

</body>
</html>`;
}

export function caseFolderPdfFilename(patient: { surname: string; firstNames: string; hospitalNumber: string }) {
  const name = `${patient.firstNames}_${patient.surname}`.trim().replace(/\s+/g, "_") || "Patient";
  return `PatientCaseFolder_${name}_${patient.hospitalNumber}.pdf`;
}
