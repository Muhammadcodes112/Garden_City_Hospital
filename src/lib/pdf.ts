import type { Browser } from "puppeteer-core";

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");

  if (process.env.CHROME_EXECUTABLE_PATH) {
    // Local development: point at a Chrome/Chromium already on the machine.
    return puppeteer.launch({
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      headless: true,
    });
  }

  // Production (Vercel) and any environment without a local Chrome install:
  // use the serverless-friendly Chromium binary.
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

/** Renders a self-contained HTML document (inline CSS, no external assets) to a PDF buffer. */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
