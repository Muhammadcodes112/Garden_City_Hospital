import type { Browser } from "puppeteer-core";

const CHROMIUM_PACK_URL =
  "https://github.com/sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

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
