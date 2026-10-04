export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type Signature = { mimeType: string; ext: string; check: (b: Buffer) => boolean };

const SIGNATURES: Signature[] = [
  { mimeType: "application/pdf", ext: "pdf", check: (b) => b.length >= 4 && b.subarray(0, 4).toString("latin1") === "%PDF" },
  {
    mimeType: "image/png",
    ext: "png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  { mimeType: "image/jpeg", ext: "jpg", check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mimeType: "image/webp",
    ext: "webp",
    check: (b) => b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

/**
 * Identifies a file by its magic bytes rather than trusting the extension or
 * the client-reported Content-Type — both are attacker-controlled.
 */
export function detectFileSignature(buf: Buffer): { mimeType: string; ext: string } | null {
  for (const sig of SIGNATURES) {
    if (sig.check(buf)) return { mimeType: sig.mimeType, ext: sig.ext };
  }
  return null;
}
