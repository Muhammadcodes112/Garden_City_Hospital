import type { FormType } from "@/lib/validators/form-data";

export const FORM_ROUTES: Record<FormType, string> = {
  lab: "/lab",
  prescription: "/prescription",
  medical_report: "/medical-report",
};

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  lab: "Lab Request",
  prescription: "Prescription",
  medical_report: "Medical Report",
};

export function formEditHref(type: FormType, recordId: string) {
  return `${FORM_ROUTES[type]}?recordId=${recordId}`;
}

export function formNewHref(type: FormType) {
  return `${FORM_ROUTES[type]}?new=1`;
}

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/lab": "Laboratory Form",
  "/prescription": "Prescription Form",
  "/medical-report": "Medical Report",
};

export function pageTitleForPath(pathname: string): string {
  const base = pathname.split("?")[0];
  if (PAGE_TITLES[base]) return PAGE_TITLES[base];
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (base.startsWith(`${path}/`)) return title;
  }
  return "Garden City Admin";
}
