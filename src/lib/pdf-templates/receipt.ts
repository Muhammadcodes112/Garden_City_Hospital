import { getBaseFontFaces, getLogoMarkDataUri, getRussoOneFontFace } from "@/lib/pdf-assets";
import { escapeHtml } from "@/lib/pdf-templates/shared";
import { PAYMENT_MODE_LABELS, formatReceiptNo, type PaymentMode } from "@/lib/validators/cashier";

/**
 * A5 landscape (half an A4, as in the hospital's receipt book) cash receipt, laid out like the hospital's paper receipt book:
 * logo + wordmark left, address block right, boxed RECEIPT title with the
 * serial number, then ruled lines with the values printed ON them.
 */

export type ReceiptPdfData = {
  receiptNo: number;
  issuedAt: Date;
  payerName: string;
  totalKobo: number;
  amountInWords: string;
  paymentMode: PaymentMode;
  tellerOrTransferRef: string | null;
  chequeNo: string | null;
  issuedByName: string;
  lines: { description: string; qty: number }[];
  status: "issued" | "voided";
  voidReason: string | null;
  voidedAt: Date | null;
  voidedByName: string | null;
  /** 1 = original; 2+ = re-prints, labelled DUPLICATE. */
  copy: number;
};

const ADDRESS = "NO. 2 Sultan Road, Ungwar Rimi, GRA, Kaduna";
const EMAIL = "gardencityspecialisthospital@yahoo.com";
const TEL = "062293293, 08077062451";

function ruled(label: string, value: string, opts: { right?: { label: string; value: string } } = {}): string {
  const right = opts.right
    ? `<span class="label right-label">${escapeHtml(opts.right.label)}</span><span class="value narrow">${escapeHtml(opts.right.value)}</span>`
    : "";
  return `<div class="line"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span>${right}</div>`;
}

/** dd/mm/yyyy in Lagos time — the server runs in UTC, so a 00:30 receipt would otherwise print yesterday. */
function lagosDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" });
}

export function receiptPdfFilename(receiptNo: number): string {
  return `Receipt_${formatReceiptNo(receiptNo)}.pdf`;
}

export function receiptPdfHtml(d: ReceiptPdfData): string {
  const naira = Math.floor(d.totalKobo / 100);
  const kobo = d.totalKobo % 100;
  const nairaText = naira.toLocaleString("en-NG");
  const koboText = kobo.toString().padStart(2, "0");
  const purpose = d.lines.map((l) => (l.qty > 1 ? `${l.description} ×${l.qty}` : l.description)).join(", ");
  const refLabel = d.paymentMode === "cheque" ? "Cheque No:" : "Teller/Transfer ID:";
  const refValue = d.paymentMode === "cheque" ? d.chequeNo ?? "" : d.tellerOrTransferRef ?? "";
  const voided = d.status === "voided";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${getRussoOneFontFace()}
  ${getBaseFontFaces()}
  @page { size: A5 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: "Inter", sans-serif; color: #111; font-variant-numeric: tabular-nums; }
  .page { width: 210mm; height: 148mm; padding: 7mm 10mm 6mm; background: #fff; position: relative; overflow: hidden; display: flex; flex-direction: column; }

  .head { display: flex; align-items: stretch; gap: 3mm; border-bottom: 0.4mm solid #111; padding-bottom: 2.5mm; }
  .brand { display: flex; align-items: center; gap: 2.5mm; flex: 1; }
  .brand img { width: 17mm; height: auto; }
  .brand .gc { font-family: "Russo One", "Inter", sans-serif; font-size: 24pt; line-height: 1; letter-spacing: 0.5pt; }
  .brand .sh { font-family: "Russo One", "Inter", sans-serif; font-size: 11.5pt; line-height: 1.15; }
  .brand .tag { font-style: italic; font-size: 8.5pt; margin-top: 0.6mm; }
  .addr { border-left: 0.4mm solid #111; padding-left: 3mm; font-size: 8pt; line-height: 1.5; width: 70mm; display: flex; flex-direction: column; justify-content: center; }
  .addr b { font-size: 8.5pt; }

  .title-row { display: flex; align-items: center; justify-content: center; position: relative; margin: 3mm 0 1mm; }
  .title { border: 0.5mm solid #111; padding: 1.2mm 9mm; font-family: "Russo One", "Inter", sans-serif; font-size: 15pt; letter-spacing: 1pt; }
  .serial { position: absolute; right: 0; font-family: "Inter", sans-serif; font-size: 13pt; font-weight: bold; color: #b81828; }
  .copy-tag { position: absolute; left: 0; font-size: 8pt; font-weight: bold; border: 0.3mm solid #111; padding: 0.6mm 1.5mm; }

  .line { display: flex; align-items: flex-end; gap: 2mm; margin-top: 2.6mm; font-size: 9.5pt; }
  .label { white-space: nowrap; font-weight: bold; }
  .right-label { margin-left: 3mm; }
  .value { flex: 1; border-bottom: 0.25mm solid #111; min-height: 5mm; padding: 0 1mm 0.4mm; font-family: "Inter", sans-serif; font-size: 10pt; font-weight: bold; text-transform: uppercase; }
  .value.narrow { flex: 0 0 45mm; text-align: center; }
  .words { line-height: 1.5; }

  .bottom { display: flex; align-items: flex-end; gap: 10mm; margin-top: 4mm; }
  .amount-box { border: 0.4mm solid #111; display: flex; align-items: center; height: 11mm; flex: 0 0 80mm; font-weight: bold; }
  .amount-box .cur { padding: 0 2mm; font-size: 12pt; border-right: 0.3mm solid #111; height: 100%; display: flex; align-items: center; }
  .amount-box .n { flex: 1; text-align: right; padding-right: 2mm; font-family: "Inter", sans-serif; font-size: 13pt; }
  .amount-box .k { border-left: 0.3mm solid #111; padding: 0 2mm; height: 100%; display: flex; align-items: center; font-family: "Inter", sans-serif; font-size: 11pt; }
  .sign { flex: 1; text-align: center; font-size: 8.5pt; }
  .sign .space { height: 9mm; }
  .sign .rule { border-top: 0.25mm solid #111; padding-top: 1mm; font-weight: bold; }
  .sign .who { font-size: 7.5pt; color: #444; margin-top: 0.5mm; }

  .footer { margin-top: auto; text-align: center; font-size: 8pt; font-style: italic; border-top: 0.25mm solid #111; padding-top: 1.5mm; }
  .issued { font-size: 7pt; color: #444; text-align: center; margin-top: 1mm; }

  .void-mark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .void-mark span { transform: rotate(-20deg); font-family: "Russo One", "Inter", sans-serif; font-size: 70pt; color: rgba(184, 24, 40, 0.22); border: 2mm solid rgba(184, 24, 40, 0.22); padding: 2mm 8mm; letter-spacing: 4pt; }
  .void-note { margin-top: 3mm; border: 0.4mm solid #b81828; color: #b81828; font-size: 8.5pt; padding: 1.5mm 2mm; font-weight: bold; }
</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="brand">
        <img src="${getLogoMarkDataUri()}" alt="" />
        <div>
          <div class="gc">GARDEN CITY</div>
          <div class="sh">SPECIALIST HOSPITAL</div>
          <div class="tag">...Hospitality in Hospital</div>
        </div>
      </div>
      <div class="addr">
        <b>${escapeHtml(ADDRESS)}</b>
        <span>E-mail: ${escapeHtml(EMAIL)}</span>
        <span>Tel: ${escapeHtml(TEL)}</span>
      </div>
    </div>

    <div class="title-row">
      ${d.copy > 1 ? `<span class="copy-tag">DUPLICATE · COPY ${d.copy}</span>` : ""}
      <span class="title">RECEIPT</span>
      <span class="serial">Nº ${formatReceiptNo(d.receiptNo)}</span>
    </div>

    ${ruled("Date:", lagosDate(d.issuedAt), { right: { label: "S/No:", value: formatReceiptNo(d.receiptNo) } })}
    ${ruled("Received from:", d.payerName)}
    <div class="line"><span class="label">The sum of:</span><span class="value words">${escapeHtml(d.amountInWords)}</span></div>
    ${ruled("Being full/part payment for:", purpose)}
    ${ruled("Naira:", nairaText, { right: { label: "Kobo:", value: koboText } })}
    ${ruled("Payment mode:", PAYMENT_MODE_LABELS[d.paymentMode], { right: { label: refLabel, value: refValue || "—" } })}

    ${
      voided
        ? `<div class="void-note">VOIDED${d.voidedAt ? ` on ${escapeHtml(lagosDate(d.voidedAt))}` : ""}${d.voidedByName ? ` by ${escapeHtml(d.voidedByName)}` : ""}: ${escapeHtml(d.voidReason ?? "")}</div>`
        : ""
    }

    <div class="bottom">
      <div class="amount-box">
        <span class="cur">₦</span>
        <span class="n">${escapeHtml(nairaText)}</span>
        <span class="k">K ${koboText}</span>
      </div>
      <div class="sign">
        <div class="space"></div>
        <div class="rule">For Gardencity</div>
        <div class="who">Issued by ${escapeHtml(d.issuedByName)}</div>
      </div>
    </div>

    <div class="footer">No refund of money after payment</div>
    <div class="issued">Issued ${escapeHtml(d.issuedAt.toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }))}</div>

    ${voided ? `<div class="void-mark"><span>VOIDED</span></div>` : ""}
  </div>
</body>
</html>`;
}
