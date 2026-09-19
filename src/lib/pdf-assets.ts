import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedLogo: string | null = null;

/** Base64 data URI for the hospital logo, embedded directly so PDF rendering never depends on a network/asset request. */
export function getLogoDataUri(): string {
  if (!cachedLogo) {
    const bytes = readFileSync(join(process.cwd(), "public", "brand", "logo-mark.png"));
    cachedLogo = `data:image/png;base64,${bytes.toString("base64")}`;
  }
  return cachedLogo;
}
