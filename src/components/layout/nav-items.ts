import { LayoutDashboard, Calendar, Users, Stethoscope, FolderOpen, PackageCheck, MessageSquare } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/records", label: "Records", icon: FolderOpen },
  { href: "/inventory", label: "Pharmacy & Prices", icon: PackageCheck },
  { href: "/doctors-workstation", label: "Doctors Workstation", icon: Stethoscope },
] as const;
