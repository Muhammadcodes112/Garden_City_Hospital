import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import potrace from "potrace";
import pngToIco from "png-to-ico";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public/brand/source");
const OUT = path.join(ROOT, "public/brand");

type SharpInstance = ReturnType<typeof sharp>;

/** Colour-distance background removal with edge feathering + colour decontamination. */
async function removeBackground(
  input: SharpInstance,
  bg: [number, number, number],
  { t0 = 18, t1 = 60 }: { t0?: number; t1?: number } = {},
): Promise<SharpInstance> {
  const { data, info } = await input
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const oo = i * 4;
    const r = data[o]!;
    const g = data[o + 1]!;
    const b = data[o + 2]!;
    const dr = r - bg[0];
    const dg = g - bg[1];
    const db = b - bg[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    let alpha: number;
    if (dist <= t0) alpha = 0;
    else if (dist >= t1) alpha = 255;
    else alpha = Math.round(((dist - t0) / (t1 - t0)) * 255);

    const a = alpha / 255;
    let nr = r;
    let ng = g;
    let nb = b;
    if (a > 0 && a < 1) {
      nr = clamp((r - bg[0] * (1 - a)) / a);
      ng = clamp((g - bg[1] * (1 - a)) / a);
      nb = clamp((b - bg[2] * (1 - a)) / a);
    }

    out[oo] = nr;
    out[oo + 1] = ng;
    out[oo + 2] = nb;
    out[oo + 3] = alpha;
  }

  return sharp(out, { raw: { width, height, channels: 4 } });
}

/** Converts dark/black text pixels (e.g. GARDEN) to white for dark backgrounds. */
async function removeBackgroundAndMakeDarkWordmark(
  input: SharpInstance,
  bg: [number, number, number],
  { t0 = 18, t1 = 60 }: { t0?: number; t1?: number } = {},
): Promise<SharpInstance> {
  const { data, info } = await input
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const oo = i * 4;
    const r = data[o]!;
    const g = data[o + 1]!;
    const b = data[o + 2]!;
    const dr = r - bg[0];
    const dg = g - bg[1];
    const db = b - bg[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    let alpha: number;
    if (dist <= t0) alpha = 0;
    else if (dist >= t1) alpha = 255;
    else alpha = Math.round(((dist - t0) / (t1 - t0)) * 255);

    let nr = r;
    let ng = g;
    let nb = b;
    // Invert dark/black pixels to white
    const brightness = (r + g + b) / 3;
    if (brightness < 65 && alpha > 0) {
      nr = 255;
      ng = 255;
      nb = 255;
    }

    out[oo] = nr;
    out[oo + 1] = ng;
    out[oo + 2] = nb;
    out[oo + 3] = alpha;
  }

  return sharp(out, { raw: { width, height, channels: 4 } });
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

async function sampleCorner(file: string): Promise<[number, number, number]> {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const c = info.channels;
  return [data[0]!, data[1]!, data[2]!];
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const logoSourcePath = path.join(SRC, "logo-source.png");
  const wordmarkSourcePath = path.join(SRC, "wordmark-source.png");

  const logoBg = await sampleCorner(logoSourcePath);
  const wordmarkBg = await sampleCorner(wordmarkSourcePath);

  // ---------------------------------------------------------------
  // 1. logo-mark.svg — framed monogram square only, vectorised.
  // ---------------------------------------------------------------
  const logoMeta = await sharp(logoSourcePath).metadata();
  const iconCrop = await sharp(logoSourcePath)
    .extract({ left: 0, top: 0, width: logoMeta.width ?? 280, height: Math.round((logoMeta.height ?? 227) * 0.9) })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();

  const markSvgBlack = await new Promise<string>((resolve, reject) => {
    potrace.trace(
      iconCrop,
      { threshold: 128, color: "#101010", background: "transparent", turdSize: 4 },
      (err, svg) => (err ? reject(err) : resolve(svg)),
    );
  });
  await writeFile(path.join(OUT, "logo-mark.svg"), markSvgBlack, "utf8");

  // Dark-background counterpart: white/light icon vector for dark mode header/nav.
  const markSvgDark = await new Promise<string>((resolve, reject) => {
    potrace.trace(
      iconCrop,
      { threshold: 128, color: "#FFFFFF", background: "transparent", turdSize: 4 },
      (err, svg) => (err ? reject(err) : resolve(svg)),
    );
  });
  await writeFile(path.join(OUT, "logo-mark-dark.svg"), markSvgDark, "utf8");

  // ---------------------------------------------------------------
  // 2. logo-full.png — icon + GARDEN CITY text, transparent bg.
  // ---------------------------------------------------------------
  const logoFullRemoved = await removeBackground(sharp(logoSourcePath), logoBg, { t0: 20, t1: 60 });
  const logoFull = await logoFullRemoved.png().trim({ threshold: 5 });
  await logoFull.toFile(path.join(OUT, "logo-full.png"));

  // ---------------------------------------------------------------
  // 3. wordmark.png / wordmark-dark.png — full wordmark lockups.
  // ---------------------------------------------------------------
  const wordmarkLightRemoved = await removeBackground(sharp(wordmarkSourcePath), wordmarkBg, { t0: 20, t1: 60 });
  const wordmarkLight = await wordmarkLightRemoved.png().trim({ threshold: 5 });
  await wordmarkLight.toFile(path.join(OUT, "wordmark.png"));

  const wordmarkDarkRemoved = await removeBackgroundAndMakeDarkWordmark(sharp(wordmarkSourcePath), wordmarkBg, { t0: 20, t1: 60 });
  const wordmarkDark = await wordmarkDarkRemoved.png().trim({ threshold: 5 });
  await wordmarkDark.toFile(path.join(OUT, "wordmark-dark.png"));

  // ---------------------------------------------------------------
  // 4. wordmark-gardencity.png — just the "GARDEN CITY" top line.
  // ---------------------------------------------------------------
  const wmMeta = await sharp(wordmarkSourcePath).metadata();
  const topHalf = await sharp(wordmarkSourcePath)
    .extract({ left: 0, top: 0, width: wmMeta.width ?? 1024, height: Math.round((wmMeta.height ?? 341) * 0.62) })
    .toBuffer();
  const wmGcRemoved = await removeBackground(sharp(topHalf), wordmarkBg, { t0: 20, t1: 60 });
  const wordmarkGardenCity = await wmGcRemoved.png().trim({ threshold: 5 });
  await wordmarkGardenCity.toFile(path.join(OUT, "wordmark-gardencity.png"));

  // ---------------------------------------------------------------
  // 5. Favicon + app icons, rasterised from the vector mark.
  // ---------------------------------------------------------------
  const markSvgBuffer = Buffer.from(markSvgBlack, "utf8");

  const icon192 = await sharp(markSvgBuffer, { density: 384 })
    .resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(path.join(OUT, "icon-192.png"), icon192);

  const icon512 = await sharp(markSvgBuffer, { density: 384 })
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(path.join(OUT, "icon-512.png"), icon512);

  const appleTouchIcon = await sharp({
    create: { width: 180, height: 180, channels: 4, background: "#ffffff" },
  })
    .composite([
      {
        input: await sharp(markSvgBuffer, { density: 384 })
          .resize(150, 150, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();
  await writeFile(path.join(OUT, "apple-touch-icon.png"), appleTouchIcon);

  const favicon16 = await sharp(markSvgBuffer, { density: 384 })
    .resize(16, 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const favicon32 = await sharp(markSvgBuffer, { density: 384 })
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const favicon48 = await sharp(markSvgBuffer, { density: 384 })
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const icoBuffer = await pngToIco([favicon16, favicon32, favicon48]);
  await writeFile(path.join(OUT, "favicon.ico"), icoBuffer);

  // ---------------------------------------------------------------
  // 6. og-default.png — logo + wordmark lockup on white, 1200x630.
  // ---------------------------------------------------------------
  const ogMark = await sharp(markSvgBuffer, { density: 384 })
    .resize(220, 220, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const ogMarkMeta = await sharp(ogMark).metadata();
  const ogWordmark = await sharp(path.join(OUT, "wordmark.png"))
    .resize({ width: 520, fit: "inside" })
    .png()
    .toBuffer();
  const ogWordmarkMeta = await sharp(ogWordmark).metadata();

  const gap = 32;
  const groupWidth = (ogMarkMeta.width ?? 0) + gap + (ogWordmarkMeta.width ?? 0);
  const groupHeight = Math.max(ogMarkMeta.height ?? 0, ogWordmarkMeta.height ?? 0);
  const startX = Math.round((1200 - groupWidth) / 2);

  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: "#ffffff" },
  })
    .composite([
      {
        input: ogMark,
        left: startX,
        top: Math.round((630 - (ogMarkMeta.height ?? 0)) / 2),
      },
      {
        input: ogWordmark,
        left: startX + (ogMarkMeta.width ?? 0) + gap,
        top: Math.round((630 - (ogWordmarkMeta.height ?? 0)) / 2),
      },
    ])
    .png()
    .toFile(path.join(OUT, "og-default.png"));

  console.log("Brand assets successfully generated in", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

