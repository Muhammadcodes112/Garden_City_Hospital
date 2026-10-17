/**
 * Receipt amount-in-words checks. Run: npx tsx scripts/test-amount-words.ts
 * Exits non-zero on any failure.
 */
import { nairaAmountInWords } from "../src/lib/amount-words";
import { parseNairaToKobo } from "../src/lib/money";

const cases: [string, string][] = [
  // From the spec.
  ["2000", "TWO THOUSAND NAIRA ONLY"],
  ["44500", "FORTY FOUR THOUSAND FIVE HUNDRED NAIRA ONLY"],
  ["12000.50", "TWELVE THOUSAND NAIRA, FIFTY KOBO ONLY"],
  // Round numbers.
  ["0", "ZERO NAIRA ONLY"],
  ["100", "ONE HUNDRED NAIRA ONLY"],
  ["1000", "ONE THOUSAND NAIRA ONLY"],
  ["100000", "ONE HUNDRED THOUSAND NAIRA ONLY"],
  ["1000000", "ONE MILLION NAIRA ONLY"],
  // Kobo.
  ["0.50", "FIFTY KOBO ONLY"],
  ["0.01", "ONE KOBO ONLY"],
  ["1.01", "ONE NAIRA, ONE KOBO ONLY"],
  ["7500.05", "SEVEN THOUSAND FIVE HUNDRED NAIRA, FIVE KOBO ONLY"],
  ["999999.99", "NINE HUNDRED NINETY NINE THOUSAND NINE HUNDRED NINETY NINE NAIRA, NINETY NINE KOBO ONLY"],
  // Teens, tens and gaps inside groups.
  ["11", "ELEVEN NAIRA ONLY"],
  ["19", "NINETEEN NAIRA ONLY"],
  ["20", "TWENTY NAIRA ONLY"],
  ["105", "ONE HUNDRED FIVE NAIRA ONLY"],
  ["1015", "ONE THOUSAND FIFTEEN NAIRA ONLY"],
  ["65000", "SIXTY FIVE THOUSAND NAIRA ONLY"],
  ["1000001", "ONE MILLION ONE NAIRA ONLY"],
  ["2500750", "TWO MILLION FIVE HUNDRED THOUSAND SEVEN HUNDRED FIFTY NAIRA ONLY"],
  ["100000000", "ONE HUNDRED MILLION NAIRA ONLY"],
];

let failed = 0;
for (const [naira, expected] of cases) {
  const kobo = parseNairaToKobo(naira);
  const got = kobo === null ? "<unparseable>" : nairaAmountInWords(kobo);
  if (got !== expected) {
    failed++;
    console.error(`FAIL ${naira}\n  expected: ${expected}\n  got:      ${got}`);
  }
}

for (const bad of [-1, 1.5, Number.NaN]) {
  try {
    nairaAmountInWords(bad);
    failed++;
    console.error(`FAIL ${bad} should have thrown`);
  } catch {
    // expected
  }
}

if (failed) {
  console.error(`\n${failed} amount-in-words check(s) failed`);
  process.exit(1);
}
console.log(`All ${cases.length + 3} amount-in-words checks passed`);
