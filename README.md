# Garden City Specialist Hospital — Admin Forms & Reports System

A modern, responsive, high-performance web portal built for **Garden City Specialist Hospital, Kaduna** to digitize and manage three core clinical records:
1. **Laboratory Request Form** (3-column checklist, clinical info, patient picker, doctor sign-off).
2. **Prescription Form** (multi-item prescription, dosage/route pickers, prescriber & dispensary sign-off).
3. **Medical Report** (official letterhead template, 7 toggleable rich-text sections, doctor sign-off & stamp upload).

---

## Key Features

- 🔐 **Secure Admin Authentication**: Built with Better Auth (email/password), secret admin access code protection (`ADMIN_SIGNUP_CODE`), and Postgres-backed rate limiting.
- 💾 **Realtime Autosave**: Zero data loss with local storage caching and automatic debounced server synchronization.
- 📄 **A4 PDF Generation & Preview**: Pixel-perfect A4 PDF export matching official hospital letterhead layouts. Fast HTML preview modal + PDF download engine.
- 🔗 **Secure Public Links & Native Share**: Native Web Share API (`navigator.share`) with attached PDF files, and unguessable 32-character public links (`/s/[token]`) with 24h, 7d, or 30d configurable expiry durations and instant revocation.
- 📝 **Form Locking & Re-Opening**: Completed records locked against accidental edits with 1-click admin unlock capability.
- 📜 **Full Activity Audit Trail**: Logs creation, completion, downloads, shares, link revocations, and form re-openings.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions, Turbopack)
- **Language**: TypeScript 5
- **Database**: PostgreSQL (Neon Cloud / Drizzle ORM)
- **Authentication**: Better Auth (`better-auth`)
- **PDF Engine**: `puppeteer-core` + `@sparticuz/chromium`
- **Styling**: Vanilla CSS / Tailwind CSS v4, Lucide Icons, Sonner Toasts
- **Testing**: Node test suite (`npx tsx scripts/test-suite.ts`)

---

## Local Setup Guide

### 1. Prerequisites
- Node.js 20+ installed
- PostgreSQL database (Neon Serverless PostgreSQL recommended)

### 2. Environment Configuration
Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
BETTER_AUTH_SECRET="your-32-character-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
ADMIN_SIGNUP_CODE="Gardencityadmin"
CHROME_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" # Optional local Chrome path
```

### 3. Installation & Database Setup
```bash
# Install dependencies
npm install

# Push database schema to Neon Postgres
npm run db:generate
npm run db:migrate
```

### 4. Create Initial Admin Account
You can register via the web UI at `/sign-up` using your `ADMIN_SIGNUP_CODE`, or run the command line script:
```bash
npm run create-admin -- --name "Admin Name" --email admin@gardencity.com --password "SecurePassword123"
```

### 5. Running Development Server & Tests
```bash
# Start Next.js development server
npm run dev

# Run automated test suite
npm test

# Run TypeScript typecheck
npm run typecheck

# Build for production
npm run build
```

---

## Replacing Brand Assets (`/public/brand/`)

All logo marks and official hospital letterhead backgrounds are stored in the `/public/brand/` directory:

1. **Logo Mark** (`public/brand/logo-mark.png`):
   - Used in the sign-in/sign-up pages, app header, navigation bar, and generated PDFs.
   - Recommended size: `512x512` PNG (transparent background or crisp square image).

2. **Official Blank Letterhead Image** (`public/brand/letterhead-blank.png`):
   - Used as the background template for Medical Reports.
   - Place your official blank hospital letterhead image (A4 proportion, ~1240x1754 px) at `public/brand/letterhead-blank.png`.

---

## Adding or Renaming Lab Tests (`src/lib/lab-tests/catalog.ts`)

The Laboratory Request Checklist is configured in a single file: `src/lib/lab-tests/catalog.ts`.

### How to Add a New Test to a Section
Open `src/lib/lab-tests/catalog.ts` and add the test title string to the relevant section array:

```ts
section("HAEMATOLOGY", [
  "Full Blood Count",
  "Hb/PCV",
  "Malaria Parasite",
  "Your New Test Name", // <-- Add test name here
]),
```

### How to Add a New Department or Section
Add a new `section("SECTION TITLE", [...])` or `subsection(...)` block inside the `LAB_FORM_COLUMNS` array (Columns 1, 2, or 3):

```ts
{
  column: 1,
  blocks: [
    section("MY NEW DEPARTMENT", [
      "Test Name 1",
      "Test Name 2",
    ]),
  ],
}
```

The app UI search, mobile selector, PDF renderer, and database validators will automatically pick up your changes without needing schema migrations.

---

## Deployment to Vercel

1. Push your repository to GitHub.
2. Import the project into Vercel.
3. Configure the Environment Variables in Vercel Project Settings:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL` (e.g. `https://gardencityhospital.vercel.app`)
   - `NEXT_PUBLIC_BETTER_AUTH_URL` (e.g. `https://gardencityhospital.vercel.app`)
   - `ADMIN_SIGNUP_CODE`
4. Deploy! Next.js and `@sparticuz/chromium` will automatically handle PDF rendering in serverless functions.
