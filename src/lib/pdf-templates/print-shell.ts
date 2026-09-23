/**
 * Shared fixed-A4 print geometry. Every template's `.page` is a real
 * 210mm x 297mm box regardless of the rendering viewport — no vw/%-of-
 * viewport widths, no Tailwind responsive classes, so layout can't shift
 * with whatever viewport Puppeteer (or a fallback browser) happens to use.
 *
 * Two variants:
 *  - `pageGeometryCssFixed`: the page is a hard 297mm box with
 *    `overflow: hidden` — content can never spill onto a second page.
 *    Use for documents that must render as exactly one page (paired with
 *    the `data-autofit`/`.autofit-inner` shrink-to-fit mechanism in
 *    src/lib/pdf.ts).
 *  - `pageGeometryCssFlow`: the page has a `min-height` of 297mm instead
 *    of a hard height, so content taller than one page paginates onto
 *    additional physical PDF pages naturally via Chrome's print engine,
 *    rather than being clipped. Use for documents that may legitimately
 *    span multiple pages (prescriptions with many items, medical reports).
 */
function baseCss(paddingMm: string): string {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html { color-scheme: light; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    .page {
      position: relative;
      width: 210mm;
      padding: ${paddingMm};
      display: flex;
      flex-direction: column;
      background: #ffffff;
    }
  `;
}

export function pageGeometryCssFixed(paddingMm = "10mm 12mm"): string {
  return `
    ${baseCss(paddingMm)}
    .page {
      height: 297mm;
      overflow: hidden;
      break-after: page;
    }
    .page:last-child { break-after: auto; }
  `;
}

export function pageGeometryCssFlow(paddingMm = "10mm 12mm"): string {
  return `
    ${baseCss(paddingMm)}
    .page { min-height: 297mm; }
  `;
}
