import { LayoutDashboard, FlaskConical, Pill, FileText } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lab", label: "Laboratory Form", icon: FlaskConical },
  { href: "/prescription", label: "Prescription Form", icon: Pill },
  { href: "/medical-report", label: "Medical Report", icon: FileText },
] as const;
