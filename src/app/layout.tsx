import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner-toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"),
  title: "Garden City Specialist Hospital — Admin",
  description: "Internal forms portal for Garden City Specialist Hospital, Kaduna.",
  openGraph: {
    title: "Garden City Specialist Hospital — Admin",
    description: "Internal forms portal for Garden City Specialist Hospital, Kaduna.",
    images: [{ url: "/brand/og-default.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

