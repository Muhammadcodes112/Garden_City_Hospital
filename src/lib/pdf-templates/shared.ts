import { getLogoMarkDataUri, getWordmarkDataUri } from "@/lib/pdf-assets";
import { formatDate } from "@/lib/date";

export const BRAND = {
  black: "#101010",
  red: "#b81828",
  green: "#086838",
  orange: "#e86828",
  yellow: "#f8e868",
};

const HOSPITAL_ADDRESS = "No. 2 Sultan Road, U/Rimi G.R.A., Kaduna";
const HOSPITAL_TEL = "0807 237 2888, 0802 309 5497, 0807 500 4800";
const HOSPITAL_EMAIL = "gardencityspecialisthospital@yahoo.com";
const HOSPITAL_RC = "RC 957820";

const SCANNING_TEL = "062293293, 08077062451";
const SCANNING_TAGLINE = "... Hospitality in Hospital";

type LetterheadVariant = "hospital" | "scanning-center";

function letterheadHtml(variant: LetterheadVariant): string {
  const logo = getLogoMarkDataUri();
  const wordmark = getWordmarkDataUri();

  const tagline =
    variant === "hospital"
      ? "The Pathway to High-Quality and Affordable Health Care"
      : SCANNING_TAGLINE;

  const contactLines =
    variant === "hospital"
      ? `${HOSPITAL_ADDRESS} &nbsp;|&nbsp; Tel: ${HOSPITAL_TEL} &nbsp;|&nbsp; ${HOSPITAL_EMAIL} &nbsp;|&nbsp; ${HOSPITAL_RC}`
      : `${HOSPITAL_ADDRESS} &nbsp;|&nbsp; Tel: ${SCANNING_TEL}`;

  return `
    <header class="letterhead">
      <div class="letterhead-row">
        <img src="${logo}" alt="Garden City" class="logo" />
        <div class="wordmark-block">
          <img src="${wordmark}" alt="Garden City Specialist Hospital" class="wordmark" />
          <div class="tagline">${tagline}</div>
        </div>
      </div>
      <div class="contact-line">${contactLines}</div>
      <div class="letterhead-rule"></div>
    </header>
  `;
}

function footerHtml(): string {
  return `<footer class="footer-bar"></footer>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: ${BRAND.black};
    font-size: 11px;
  }
  .page {
    padding: 28px 40px 20px 40px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .letterhead-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo { width: 56px; height: 56px; object-fit: contain; }
  .wordmark { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; font-family: Arial, sans-serif; }
  .tagline { font-size: 10px; font-style: italic; color: #444; margin-top: 2px; }
  .contact-line { font-size: 9px; color: #333; margin-top: 8px; }
  .letterhead-rule {
    height: 3px;
    margin-top: 10px;
    background: linear-gradient(to right, ${BRAND.black}, ${BRAND.red}, ${BRAND.orange});
  }
  .footer-bar {
    height: 10px;
    margin-top: auto;
    background: linear-gradient(to right, ${BRAND.black}, ${BRAND.red}, ${BRAND.orange});
  }
  .form-title {
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 18px 0 14px 0;
    color: ${BRAND.black};
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    margin-bottom: 16px;
  }
  .field-grid.full { grid-template-columns: 1fr; }
  .field {
    display: flex;
    align-items: baseline;
    gap: 6px;
    border-bottom: 1px solid #999;
    padding-bottom: 2px;
  }
  .field .label { font-weight: 700; white-space: nowrap; font-size: 10px; color: #333; }
  .field .value { flex: 1; font-size: 11px; min-height: 14px; }
  .section-title {
    font-weight: 700;
    font-size: 11px;
    color: ${BRAND.green};
    text-transform: uppercase;
    margin: 14px 0 6px 0;
    border-bottom: 1px solid ${BRAND.green};
    padding-bottom: 3px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
  th { background: #f2f2f2; }
  .checklist { columns: 2; column-gap: 24px; }
  .checklist-item { break-inside: avoid; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 10.5px; }
  .box { width: 11px; height: 11px; border: 1px solid ${BRAND.black}; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }
  .box.checked { background: ${BRAND.green}; border-color: ${BRAND.green}; color: white; }
  .signature-block { margin-top: auto; padding-top: 28px; display: flex; justify-content: flex-end; }
  .signature-inner { text-align: center; width: 220px; }
  .signature-line { border-top: 1px solid #333; padding-top: 4px; font-size: 10px; }
  .report-body { white-space: pre-wrap; font-size: 11.5px; line-height: 1.6; }
`;

export function pdfDocument(opts: {
  variant: LetterheadVariant;
  formTitle: string;
  body: string;
}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${BASE_CSS}</style>
  </head>
  <body>
    <div class="page">
      ${letterheadHtml(opts.variant)}
      <div class="form-title">${opts.formTitle}</div>
      ${opts.body}
      ${footerHtml()}
    </div>
  </body>
</html>`;
}

export function field(label: string, value: string | null | undefined): string {
  return `<div class="field"><span class="label">${escapeHtml(label)}:</span><span class="value">${escapeHtml(value || "")}</span></div>`;
}

export function dateField(label: string, value: string | Date | null | undefined): string {
  return field(label, formatDate(value));
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
