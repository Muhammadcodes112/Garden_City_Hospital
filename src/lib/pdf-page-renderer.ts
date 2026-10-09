import fs from "fs";
import type { Browser } from "puppeteer-core";
import { getCachedImage, putCachedImage } from "@/lib/pdf-cache";

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");

  if (process.env.CHROME_EXECUTABLE_PATH) {
    return puppeteer.launch({
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      headless: true,
    });
  }

  if (process.platform === "win32") {
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

  const chromium = (await import("@sparticuz/chromium")).default;
  const execPath = await chromium.executablePath();
  return await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: execPath,
    headless: chromium.headless,
  });
}

export async function renderFormPageImage(opts: {
  html: string;
  recordId: string;
  updatedAt: string | Date;
  pageIndex: number;
  resolution: "low" | "high";
}): Promise<{ buffer: Buffer; pageCount: number }> {
  const { html, recordId, updatedAt, pageIndex, resolution } = opts;

  const cached = await getCachedImage(recordId, updatedAt, pageIndex, resolution);
  if (cached) return cached;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const scaleFactor = resolution === "high" ? 3 : 1;

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: scaleFactor,
    });
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((img) => img.decode().catch(() => undefined)),
      );
    });

    const pageElements = await page.$$(".page");
    const pageCount = Math.max(1, pageElements.length);

    let screenshotBuffer: Buffer;

    const targetEl = pageElements[pageIndex] || pageElements[0];
    if (targetEl) {
      const pngUint8 = await targetEl.screenshot({ type: "png" });
      screenshotBuffer = Buffer.from(pngUint8);
    } else {
      const pngUint8 = await page.screenshot({ type: "png", fullPage: false });
      screenshotBuffer = Buffer.from(pngUint8);
    }

    await putCachedImage(recordId, updatedAt, pageIndex, resolution, screenshotBuffer, pageCount);

    return { buffer: screenshotBuffer, pageCount };
  } finally {
    await browser.close();
  }
}
