import { LayoutDashboard, Users, FlaskConical, Pill, FileText, FolderOpen, PackageCheck } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/records", label: "Records", icon: FolderOpen },
  { href: "/inventory", label: "Pharmacy & Prices", icon: PackageCheck },
  { href: "/lab", label: "Laboratory Form", icon: FlaskConical },
  { href: "/prescription", label: "Prescription Form", icon: Pill },
  { href: "/medical-report", label: "Medical Report", icon: FileText },
] as const;
