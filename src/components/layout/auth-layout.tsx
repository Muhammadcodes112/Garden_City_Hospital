import Image from "next/image";

// Subtle repeating medical-cross pattern for the branding panel. Encoded
// inline so the panel has no external asset dependency.
const MEDICAL_PATTERN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cpath d='M28 16h8v12h12v8H36v12h-8V36H16v-8h12z' fill='%23ffffff' fill-opacity='0.05'/%3E%3C/svg%3E";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Branding panel: desktop only */}
      <div
        className="relative hidden flex-col justify-center overflow-hidden bg-gradient-to-br from-brand-green via-brand-green to-brand-black px-12 md:flex md:w-1/2"
        style={{ backgroundImage: `url("${MEDICAL_PATTERN}")`, backgroundRepeat: "repeat" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-green via-brand-green/95 to-brand-black" />
        <div className="relative z-10 flex flex-col items-start gap-6">
          <Image
            src="/brand/logo-mark.png"
            alt="Garden City Specialist Hospital"
            width={72}
            height={72}
            className="h-18 w-18 rounded-md bg-white/10 p-2"
          />
          <div>
            <h1 className="text-3xl font-extrabold leading-tight text-white">
              Garden City
              <br />
              Specialist Hospital
            </h1>
            <p className="mt-3 max-w-sm text-sm text-white/80">
              The Pathway to High-Quality and Affordable Health Care
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-12">
        {/* Mobile-only stacked brand mark */}
        <div className="mb-8 flex flex-col items-center gap-2 md:hidden">
          <Image
            src="/brand/logo-mark.png"
            alt="Garden City Specialist Hospital"
            width={48}
            height={48}
            className="h-12 w-12 rounded-md"
          />
          <p className="text-center text-sm font-bold text-foreground">
            <span>GARDEN</span> <span className="text-brand-red">CITY</span>{" "}
            <span className="text-brand-green">SPECIALIST HOSPITAL</span>
          </p>
        </div>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
