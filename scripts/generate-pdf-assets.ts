/**
 * One-off: rebuilds src/lib/pdf-assets.ts from the generated files in
 * public/brand/, base64-embedding everything Puppeteer needs so PDF
 * rendering never depends on a network/asset request.
 * Run with: npx tsx scripts/generate-pdf-assets.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const BRAND = path.join(ROOT, "public/brand");
const FONTS = path.join(ROOT, "public/fonts");

async function pngBase64(file: string, width: number): Promise<string> {
  const buf = await sharp(path.join(BRAND, file))
    .resize({ width })
    .png()
    .toBuffer();
  return buf.toString("base64");
}

async function main() {
  const logoMarkSvg = await readFile(path.join(BRAND, "logo-mark.svg"), "utf8");
  const logoMarkSvgBase64 = Buffer.from(logoMarkSvg, "utf8").toString("base64");

  const logoFullB64 = await pngBase64("logo-full.png", 360);
  const wordmarkB64 = await pngBase64("wordmark.png", 900);
  const wordmarkGardenCityB64 = await pngBase64("wordmark-gardencity.png", 900);

  const fontBuf = await readFile(path.join(FONTS, "RussoOne-Regular.woff2"));
  const fontB64 = fontBuf.toString("base64");

  const out = `/**
 * Base64-embedded brand assets for Puppeteer-rendered PDFs. Embedding
 * (rather than referencing /public URLs) means PDF rendering never depends
 * on a network/asset request from the serverless Chromium instance.
 *
 * Regenerate with: npx tsx scripts/generate-pdf-assets.ts
 */

const LOGO_MARK_SVG_BASE64 = "${logoMarkSvgBase64}";

const LOGO_FULL_BASE64 = "${logoFullB64}";

const WORDMARK_BASE64 = "${wordmarkB64}";

const WORDMARK_GARDENCITY_BASE64 = "${wordmarkGardenCityB64}";

const RUSSO_ONE_BASE64 = "${fontB64}";

/** The framed monogram only — vector, so it stays crisp at any print size. */
export function getLogoMarkDataUri(): string {
  return \`data:image/svg+xml;base64,\${LOGO_MARK_SVG_BASE64}\`;
}

/** Full logo: monogram + "GARDEN CITY" + RC number. */
export function getLogoFullDataUri(): string {
  return \`data:image/png;base64,\${LOGO_FULL_BASE64}\`;
}

/** Full colour wordmark: "GARDEN CITY" + "SPECIALIST HOSPITAL". */
export function getWordmarkDataUri(): string {
  return \`data:image/png;base64,\${WORDMARK_BASE64}\`;
}

/** Just the "GARDEN CITY" line, for the lab form's scanning-center heading. */
export function getWordmarkGardenCityDataUri(): string {
  return \`data:image/png;base64,\${WORDMARK_GARDENCITY_BASE64}\`;
}

/** Self-hosted Russo One, embedded so it renders without a font request. */
export function getRussoOneFontFace(): string {
  return \`
    @font-face {
      font-family: "Russo One";
      font-style: normal;
      font-weight: 400;
      src: url(data:font/woff2;base64,\${RUSSO_ONE_BASE64}) format("woff2");
    }
  \`;
}
`;

  await writeFile(path.join(ROOT, "src/lib/pdf-assets.ts"), out, "utf8");
  console.log("Wrote src/lib/pdf-assets.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
