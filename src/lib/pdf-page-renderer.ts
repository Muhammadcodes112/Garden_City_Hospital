import fs from "fs";
import path from "path";
import type { Browser } from "puppeteer-core";

const CACHE_DIR = path.join(process.cwd(), "public", "cache", "form-pages");

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
  const updatedTs = new Date(updatedAt).getTime();
  const cacheKey = `${recordId}_${updatedTs}_p${pageIndex}_${resolution}.png`;
  const metaKey = `${recordId}_${updatedTs}_meta.json`;

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const cachePath = path.join(CACHE_DIR, cacheKey);
  const metaPath = path.join(CACHE_DIR, metaKey);

  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      const buffer = fs.readFileSync(cachePath);
      return { buffer, pageCount: meta.pageCount || 1 };
    } catch {
      // If cache read fails, fall back to fresh rendering
    }
  }

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

    fs.writeFileSync(cachePath, screenshotBuffer);
    fs.writeFileSync(metaPath, JSON.stringify({ pageCount, updatedAt: updatedTs }));

    return { buffer: screenshotBuffer, pageCount };
  } finally {
    await browser.close();
  }
}
