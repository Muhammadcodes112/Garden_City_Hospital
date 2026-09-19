import { z } from "zod";

export const sectionContentSchema = z.object({
  enabled: z.boolean().default(true),
  content: z.string().default(""),
});

export type SectionContent = z.infer<typeof sectionContentSchema>;

export const MEDICAL_REPORT_SECTIONS = [
  { key: "presentingComplaint", label: "Presenting Complaint / History" },
  { key: "examinationFindings", label: "Examination Findings" },
  { key: "investigationsResults", label: "Investigations & Results" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatmentManagement", label: "Treatment / Management" },
  { key: "currentConditionPrognosis", label: "Current Condition / Prognosis" },
  { key: "recommendations", label: "Recommendations" },
] as const;

export type SectionKey = (typeof MEDICAL_REPORT_SECTIONS)[number]["key"];

export const medicalReportDataSchema = z.object({
  refNo: z.string().default(""),
  reportDate: z.string().default(""),
  addressee: z.string().default("To Whom It May Concern"),
  reportTitle: z.string().default("MEDICAL REPORT"),
  admissionDate: z.string().default(""),
  dischargeDate: z.string().default(""),
  sections: z
    .object({
      presentingComplaint: sectionContentSchema.default({ enabled: true, content: "" }),
      examinationFindings: sectionContentSchema.default({ enabled: true, content: "" }),
      investigationsResults: sectionContentSchema.default({ enabled: true, content: "" }),
      diagnosis: sectionContentSchema.default({ enabled: true, content: "" }),
      treatmentManagement: sectionContentSchema.default({ enabled: true, content: "" }),
      currentConditionPrognosis: sectionContentSchema.default({ enabled: true, content: "" }),
      recommendations: sectionContentSchema.default({ enabled: true, content: "" }),
    })
    .default({
      presentingComplaint: { enabled: true, content: "" },
      examinationFindings: { enabled: true, content: "" },
      investigationsResults: { enabled: true, content: "" },
      diagnosis: { enabled: true, content: "" },
      treatmentManagement: { enabled: true, content: "" },
      currentConditionPrognosis: { enabled: true, content: "" },
      recommendations: { enabled: true, content: "" },
    }),
  doctorName: z.string().default(""),
  doctorDesignation: z.string().default("Medical Officer"),
  doctorSignature: z
    .object({
      mode: z.enum(["draw", "type"]).default("draw"),
      data: z.string().default(""),
    })
    .default({ mode: "draw", data: "" }),
  hospitalStamp: z.string().default(""),
});

export type MedicalReportData = z.infer<typeof medicalReportDataSchema>;

export function defaultMedicalReportData(refNo = ""): MedicalReportData {
  return {
    refNo,
    reportDate: new Date().toISOString().split("T")[0]!,
    addressee: "To Whom It May Concern",
    reportTitle: "MEDICAL REPORT",
    admissionDate: "",
    dischargeDate: "",
    sections: {
      presentingComplaint: { enabled: true, content: "" },
      examinationFindings: { enabled: true, content: "" },
      investigationsResults: { enabled: true, content: "" },
      diagnosis: { enabled: true, content: "" },
      treatmentManagement: { enabled: true, content: "" },
      currentConditionPrognosis: { enabled: true, content: "" },
      recommendations: { enabled: true, content: "" },
    },
    doctorName: "",
    doctorDesignation: "Medical Officer",
    doctorSignature: { mode: "draw", data: "" },
    hospitalStamp: "",
  };
}

export const medicalReportCompleteSchema = medicalReportDataSchema.superRefine((val, ctx) => {
  if (!val.doctorName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Doctor's name is required to complete the report",
      path: ["doctorName"],
    });
  }
  if (!val.reportDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Report date is required",
      path: ["reportDate"],
    });
  }
  const hasActiveSection = Object.values(val.sections).some(
    (sec) => sec.enabled && sec.content.trim().length > 0,
  );
  if (!hasActiveSection) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one section must be enabled and have content",
      path: ["sections"],
    });
  }
});
