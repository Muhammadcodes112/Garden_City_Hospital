import { LayoutDashboard, FlaskConical, Pill, FileText, FolderOpen } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Records", icon: FolderOpen },
  { href: "/lab", label: "Laboratory Form", icon: FlaskConical },
  { href: "/prescription", label: "Prescription Form", icon: Pill },
  { href: "/medical-report", label: "Medical Report", icon: FileText },
] as const;
