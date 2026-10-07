import "dotenv/config";
import fs from "fs";
import path from "path";
import { chromium, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const OUT_DIR = process.env.VISUAL_AUDIT_OUT_DIR || path.join(process.cwd(), ".visual-audit-out");
const WIDTHS = [360, 390, 768, 1024, 1440];
const HEIGHT = 900;
const SCHEMES = ["light", "dark"] as const;

const V2_ID = process.env.VISUAL_V2_ID!;
const RECORD_ID = process.env.VISUAL_RECORD_ID!;
const SHARE_TOKEN = process.env.VISUAL_SHARE_TOKEN!;

const PROTECTED_ROUTES = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/patients", name: "patients" },
  { path: "/records", name: "records" },
  { path: "/records/trash", name: "records-trash" },
  { path: "/inventory", name: "inventory" },
  { path: "/lab", name: "lab" },
  { path: "/prescription", name: "prescription" },
  { path: "/medical-report", name: "medical-report" },
  { path: "/messages", name: "messages" },
  { path: `/messages/${V2_ID}`, name: "messages-thread" },
  { path: `/documents/${RECORD_ID}`, name: "documents" },
  { path: "/admins", name: "admins" },
];

const PUBLIC_ROUTES = [
  { path: "/sign-in", name: "sign-in" },
  { path: `/s/${SHARE_TOKEN}`, name: "share-viewer" },
];

type CheckResult = {
  overflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  smallTapTargets: Array<{ tag: string; text: string; w: number; h: number }>;
  smallText: Array<{ tag: string; text: string; size: number }>;
};

async function runChecks(page: Page): Promise<CheckResult> {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

    const smallTapTargets: Array<{ tag: string; text: string; w: number; h: number }> = [];
    const interactive = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]');
    for (const el of Array.from(interactive)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (rect.width < 44 || rect.height < 44) {
        smallTapTargets.push({
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 30),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }

    const smallText: Array<{ tag: string; text: string; size: number }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    let node: Node | null;
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode())) {
      if (!node.textContent || !node.textContent.trim()) continue;
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      if (size < 12) {
        seen.add(el);
        smallText.push({ tag: el.tagName, text: node.textContent.trim().slice(0, 30), size });
      }
    }

    return {
      overflow,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      smallTapTargets: smallTapTargets.slice(0, 10),
      smallText: smallText.slice(0, 10),
    };
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Reuses the system Chrome this app already depends on for PDF rendering
  // (CHROME_EXECUTABLE_PATH) rather than downloading Playwright's own
  // bundled browser, which this network can't reach.
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH });

  // --- Authenticate once via the real sign-in UI, save storage state ---
  const authContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const authPage = await authContext.newPage();
  await authPage.goto(`${BASE_URL}/sign-in`);
  await authPage.fill('input[type="email"]', "test-visual1@example.com");
  await authPage.fill('input[type="password"]', "TestPassw0rd!23");
  await authPage.click('button[type="submit"]');
  try {
    await authPage.waitForURL(/\/dashboard/, { timeout: 20000 });
  } catch (err) {
    await authPage.screenshot({ path: path.join(OUT_DIR, "_signin_failure.png") });
    console.error("Sign-in did not redirect to /dashboard. Current URL:", authPage.url());
    console.error("Page text:", (await authPage.textContent("body"))?.slice(0, 500));
    throw err;
  }
  const storageStatePath = path.join(OUT_DIR, "storage-state.json");
  await authContext.storageState({ path: storageStatePath });
  await authContext.close();

  const findings: Array<{ route: string; width: number; scheme: string } & Partial<CheckResult>> = [];

  async function auditRoute(routePath: string, name: string, authenticated: boolean) {
    for (const width of WIDTHS) {
      for (const scheme of SCHEMES) {
        const context = await browser.newContext({
          viewport: { width, height: HEIGHT },
          storageState: authenticated ? storageStatePath : undefined,
          colorScheme: scheme,
        });
        if (scheme === "dark") {
          await context.addInitScript(() => localStorage.setItem("gch-theme", "dark"));
        }
        const page = await context.newPage();
        try {
          await page.goto(`${BASE_URL}${routePath}`, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(400); // settle fonts/hydration
          const result = await runChecks(page);
          const fileName = `${name}_${width}_${scheme}.png`;
          await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: true });

          if (result.overflow || result.smallTapTargets.length > 0 || result.smallText.length > 0) {
            findings.push({ route: routePath, width, scheme, ...result });
          }
          console.log(`✓ ${routePath} @ ${width}px ${scheme} — overflow:${result.overflow} smallTap:${result.smallTapTargets.length} smallText:${result.smallText.length}`);
        } catch (err) {
          console.error(`✗ ${routePath} @ ${width}px ${scheme} — ${err instanceof Error ? err.message : err}`);
          findings.push({ route: routePath, width, scheme });
        } finally {
          await context.close();
        }
      }
    }
  }

  for (const r of PROTECTED_ROUTES) await auditRoute(r.path, r.name, true);
  for (const r of PUBLIC_ROUTES) await auditRoute(r.path, r.name, false);

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, "findings.json"), JSON.stringify(findings, null, 2));
  console.log(`\nScreenshots + findings.json written to: ${OUT_DIR}`);
  console.log(`Routes with issues: ${findings.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
