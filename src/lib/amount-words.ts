/**
 * Naira amount in words for receipts, in the style of the paper receipt
 * book: capitals, no "and", e.g.
 *   2000.00  -> "TWO THOUSAND NAIRA ONLY"
 *   44500.00 -> "FORTY FOUR THOUSAND FIVE HUNDRED NAIRA ONLY"
 *   12000.50 -> "TWELVE THOUSAND NAIRA, FIFTY KOBO ONLY"
 * Takes integer kobo (see src/lib/money.ts), never a float.
 */

const ONES = [
  "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
const SCALES = ["", "THOUSAND", "MILLION", "BILLION", "TRILLION"];

/** 0..999 -> words ("" for 0). */
function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} HUNDRED`);
  if (rest >= 20) {
    parts.push(rest % 10 ? `${TENS[Math.floor(rest / 10)]} ${ONES[rest % 10]}` : TENS[Math.floor(rest / 10)]!);
  } else if (rest) {
    parts.push(ONES[rest]!);
  }
  return parts.join(" ");
}

/** Non-negative integer -> words ("ZERO" for 0). */
export function integerToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Cannot spell ${n}`);
  if (n === 0) return "ZERO";
  const groups: string[] = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(SCALES[scale] ? `${underThousand(chunk)} ${SCALES[scale]}` : underThousand(chunk));
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(" ");
}

export function nairaAmountInWords(kobo: number): string {
  if (!Number.isSafeInteger(kobo) || kobo < 0) throw new RangeError(`Invalid kobo amount: ${kobo}`);
  const naira = Math.floor(kobo / 100);
  const k = kobo % 100;
  if (naira === 0 && k > 0) return `${integerToWords(k)} KOBO ONLY`;
  if (k === 0) return `${integerToWords(naira)} NAIRA ONLY`;
  return `${integerToWords(naira)} NAIRA, ${integerToWords(k)} KOBO ONLY`;
}
