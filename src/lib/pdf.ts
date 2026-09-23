import type { Browser } from "puppeteer-core";

const CHROMIUM_PACK_URL =
  "https://github.com/sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

// A4 at 96 CSS-px/inch: 210mm x 297mm.
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");

  if (process.env.CHROME_EXECUTABLE_PATH) {
    return puppeteer.launch({
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      headless: true,
    });
  }

  if (process.platform === "win32") {
    const fs = await import("fs");
    const winPaths = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) {
        return puppeteer.launch({
          executablePath: p,
          headless: true,
        });
      }
    }
  }

  // Production (Vercel) and any environment without a local Chrome install:
  const chromium = (await import("@sparticuz/chromium")).default;

  try {
    const execPath = await chromium.executablePath();
    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: execPath,
      headless: chromium.headless,
    });
  } catch (err) {
    console.warn("Default sparticuz chromium path failed, downloading remote pack...", err);
    const remoteExecPath = await chromium.executablePath(CHROMIUM_PACK_URL);
    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: remoteExecPath,
      headless: chromium.headless,
    });
  }
}

/**
 * Shrinks any `.page[data-autofit]` whose content overflows its fixed A4
 * box down to fit, instead of letting Chrome clip or paginate it. Only
 * templates that opt in (the lab request form, which must be exactly one
 * page) carry the `data-autofit` marker; runs in-page via page.evaluate.
 */
function autofitPages(): void {
  const MIN_SCALE = 0.85;

  document.querySelectorAll<HTMLElement>(".page[data-autofit]").forEach((page) => {
    const inner = page.querySelector<HTMLElement>(".autofit-inner");
    if (!inner) return;

    inner.style.transform = "none";
    inner.style.width = "100%";

    const style = getComputedStyle(page);
    const paddingV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const budgetPx = page.clientHeight - paddingV;
    const actualPx = inner.scrollHeight;

    if (actualPx > budgetPx) {
      const scale = Math.max(MIN_SCALE, budgetPx / actualPx);
      inner.style.transformOrigin = "top left";
      inner.style.transform = `scale(${scale})`;
      inner.style.width = `${100 / scale}%`;
    }
  });
}

/** Renders a self-contained HTML document (inline CSS, no external assets) to a PDF buffer. */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      deviceScaleFactor: 2,
    });
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for @font-face loading and every <img> to finish decoding —
    // otherwise page.pdf() can snapshot the page mid-paint and silently
    // drop text or images that hadn't rendered yet.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.decode().catch(() => undefined),
        ),
      );
    });

    await page.evaluate(autofitPages);

    // Chromium's print-to-PDF pipeline never reads CSS `@page { margin }` —
    // margins only come from this explicit option. Templates that need a
    // physical margin (e.g. to leave room for a repeating header/footer)
    // declare one via <meta name="pdf-margin">; everything else prints
    // edge-to-edge and manages its own spacing with `.page` padding.
    //
    // Repeating headers/footers use Puppeteer's own headerTemplate/
    // footerTemplate mechanism (declared via base64'd <meta> tags so each
    // template stays a single self-contained HTML string) rather than CSS
    // `position: fixed` — Chromium's print-to-PDF does not reliably repeat
    // fixed-position content across physical pages; it only paints once.
    const pdfConfig = await page.evaluate(() => {
      const margin = document.querySelector('meta[name="pdf-margin"]')?.getAttribute("content") ?? null;
      const headerB64 =
        document.querySelector('meta[name="pdf-header-b64"]')?.getAttribute("content") ?? null;
      const footerB64 =
        document.querySelector('meta[name="pdf-footer-b64"]')?.getAttribute("content") ?? null;
      const parts = (margin ?? "").trim().split(/\s+/);
      return {
        margin: margin ? { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] } : null,
        headerB64,
        footerB64,
      };
    });

    const hasHeaderFooter = Boolean(pdfConfig.headerB64 || pdfConfig.footerB64);
    if (process.env.PDF_DEBUG) {
      console.log("PDF_DEBUG margin:", pdfConfig.margin, "hasHeaderFooter:", hasHeaderFooter);
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: !hasHeaderFooter,
      margin: pdfConfig.margin ?? { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
      displayHeaderFooter: hasHeaderFooter,
      headerTemplate: pdfConfig.headerB64
        ? Buffer.from(pdfConfig.headerB64, "base64").toString("utf8")
        : "<span></span>",
      footerTemplate: pdfConfig.footerB64
        ? Buffer.from(pdfConfig.footerB64, "base64").toString("utf8")
        : "<span></span>",
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
