# Garden City Specialist Hospital — Admin Portal

Admin-only internal tool for digitising three paper forms: Laboratory Request,
Prescription, and Medical Report. Next.js (App Router) + TypeScript + Tailwind
+ Drizzle ORM (Postgres) + Better Auth (email/password only) + Puppeteer PDF
generation.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — a Postgres connection string (Neon or Supabase).
   - `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` — `http://localhost:3000` in dev.
   - `ADMIN_SIGNUP_CODE` — a shared secret required to register a new admin
     account via `/sign-up`. Anyone without it cannot create an account.
   - `CHROME_EXECUTABLE_PATH` — optional, a local Chrome/Chromium binary path
     for PDF generation in development (production uses `@sparticuz/chromium`,
     bundled automatically). On Windows this is typically
     `C:\Program Files\Google\Chrome\Application\chrome.exe`.

2. Install dependencies:
   ```
   npm install
   ```

3. Push the schema to your database:
   ```
   npm run db:generate
   npm run db:migrate
   ```

4. Create an admin account, either:
   - through the app at `/sign-up`, entering the `ADMIN_SIGNUP_CODE` value, or
   - from the command line (no code needed, since it's a trusted local script):
     ```
     npm run create-admin -- --name "Jane Doe" --email jane@example.com --password "a-strong-password"
     ```

5. Run the dev server:
   ```
   npm run dev
   ```

6. Verify the install (optional but recommended before deploying):
   ```
   npm run typecheck
   npm run lint
   npm run build
   npm run db:migrate
   ```
   If `next build` reports another build/dev process is running, stop the dev
   server first (`Ctrl+C` in its terminal) or remove `.next/dev/lock`, then
   retry.

## Data model

- `patients` — normalized patient identity (surname, first names, age, sex,
  phone, address, unique hospital number), shared across all forms for the
  same patient.
- `form_records` — one row per lab request / prescription / medical report.
  `type` selects which shape `data` (jsonb) holds; the exact per-type shape
  is validated by `formDataSchema(type)` in `src/lib/validators/form-data.ts`.
  `status` ('draft' | 'completed') and `completed_at` track lifecycle.
- `share_links` — token-based, expiring/revocable links for sharing a
  completed form outside the app.
- `activity_logs` — audit trail per form record (created / completed /
  downloaded / shared / link_revoked), tied to the acting user.

Only the schema, auth, and read-only list views for these tables are built so
far. Creating/editing form records, the patient picker, share-link issuance,
and PDF generation against the new `form_records` shape are not yet
implemented — the previous per-type editing forms and PDF routes were removed
because they depended on the tables this schema replaced.

## Brand assets

`public/brand/logo-mark.png` is currently a low-resolution placeholder cropped
from an earlier prototype. Replace it with a clean crop of the real
letterhead's monogram once available — the sign-in/sign-up pages, sidebar, and
any generated PDF reference this same file.

The exact hex values used throughout (`#111111` black, `#e3262b` red,
`#0b6b3a` green, `#f7941d` orange) are defined once in `src/app/globals.css`
(as both raw values and shadcn-style semantic tokens: `primary` = green,
`accent` = red) and in `src/lib/pdf-templates/shared.ts` for PDF rendering —
update both if the real letterhead colors differ once sampled from the source
image.

## Lab test checklist

`src/lib/validators/lab-request.ts` (`LAB_TEST_CATEGORIES`) contains a
best-effort default checklist grouped by department (Haematology, Chemical
Pathology, etc.). This was not sourced from the real paper form — swap in the
exact tests and wording once the actual Garden City Scanning & Diagnostic
Center form is available.

## Deploying to Vercel

No extra configuration needed for PDF generation — `puppeteer-core` +
`@sparticuz/chromium` are designed to work within Vercel's serverless function
limits. Set the same environment variables as `.env` in the Vercel project
settings (omit `CHROME_EXECUTABLE_PATH`).

Rate limiting (`src/lib/auth.ts`) is configured with `storage: "database"` so
it holds up across serverless instances without needing Redis.
