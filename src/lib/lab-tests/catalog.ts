/**
 * Single source of truth for the Laboratory Request checklist.
 * UI and PDF both render from this config (stable test `id`s).
 */

export type LabTest = { id: string; label: string };

export type LabBlock =
  | { kind: "section"; title: string; tests: LabTest[] }
  | { kind: "subsection"; title: string; tests: LabTest[] };

export type LabColumn = {
  column: 1 | 2 | 3;
  blocks: LabBlock[];
};

function test(label: string, id?: string): LabTest {
  const slug =
    id ??
    label
      .toLowerCase()
      .replace(/\+/g, "plus")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return { id: slug, label };
}

function section(title: string, labels: string[]): LabBlock {
  return { kind: "section", title, tests: labels.map((l) => test(l)) };
}

function subsection(title: string, labels: string[]): LabBlock {
  return { kind: "subsection", title, tests: labels.map((l) => test(l)) };
}

export const LAB_FORM_COLUMNS: LabColumn[] = [
  {
    column: 1,
    blocks: [
      section("HAEMATOLOGY", [
        "Full Blood Count",
        "Hb/PCV",
        "Malaria Parasite",
        "ESR",
        "WBC Count",
        "RBC Count",
        "RBC Indices",
        "Blood Group + Rhesus",
        "X-Matching",
        "Filaria Exams",
        "Genotype",
        "Bleeding Time",
        "Clotting Time",
        "Platelets Count",
        "Reticulocytes Count",
        "Prothrombin Time",
        "Coagulation Time",
        "Sickling Time",
      ]),
      section("MICROBIOLOGY", [
        "Urine M/C/S",
        "HVS/Endocervical M/C/S",
        "Urethral Swab M/C/S",
        "Eye Swab M/C/S",
        "Ear Swab M/C/S",
        "Nasal Swab M/C/S",
        "High Vaginal Swab",
        "Intracervical Swab",
        "Skin Snips",
        "Throat Swab M/C/S",
        "Semen Analysis",
        "Semen M/C/S",
        "Sputum M/C/S",
        "Wound M/C/S",
        "Stool Microscopy",
        "Stool M/C/S",
      ]),
    ],
  },
  {
    column: 2,
    blocks: [
      {
        kind: "section",
        title: "",
        tests: [test("Blood Culture"), test("Acid Fast Bacilli (ZN)"), test("Mycology")],
      },
      section("CHEMISTRY", [
        "Total Bilirubin",
        "Direct Bilirubin",
        "Alkaline Phosphatase",
        "SGOT (AST)",
        "SGPT (ALT)",
        "Total Protein",
        "Albumin",
      ]),
      subsection("Kidney Function Test", ["Urea", "Creatinine", "Uric Acid"]),
      subsection("Electrolytes", [
        "Potassium",
        "Sodium",
        "Chloride",
        "Bicarbonate",
        "Calcium",
        "Magnesium",
        "Phosphorus",
      ]),
      subsection("Diabetes", ["FBS/RBS", "2hrs PPG", "GTT"]),
      subsection("Cardiac Function", ["AST (SGOT)", "LDH", "CK", "CKMB"]),
      subsection("Lipid Profile", [
        "Total Cholesterol",
        "HDL-Cholesterol",
        "LDL",
        "Triglycerides",
      ]),
    ],
  },
  {
    column: 3,
    blocks: [
      subsection("Thyroid Function", ["T3", "T4", "TSH"]),
      subsection("Fertility Profile", [
        "LH",
        "FSH",
        "Prolactin",
        "Progesterone",
        "Oestrogen",
        "Testosterone",
      ]),
      section("IMMUNOLOGICAL ASSAYS", []),
      subsection("Tumor Markers", ["PSA", "AFP", "BHCG", "Helicobacter Pylori"]),
      subsection("Hepatitis", ["HBsAg", "Hepatitis C Virus", "AUSAB"]),
      section("SEROLOGY", [
        "HIV 1 & 2",
        "VDRL",
        "ASO Titre",
        "Widal Test",
        "Rheumatoid Factor",
        "CR Protein",
        "Mantoux Test",
        "Alpha-Feto Protein",
      ]),
      subsection("URINE", ["Urinalysis", "Urine Microscopy"]),
      subsection("PREGNANCY", ["Urine Pregnancy Test", "Blood Pregnancy Test"]),
      section("HISTOPATHOLOGY", ["Pap Smear"]),
    ],
  },
];

/** Flat list for search / validation. */
export const ALL_LAB_TESTS: LabTest[] = LAB_FORM_COLUMNS.flatMap((col) =>
  col.blocks.flatMap((b) => b.tests),
);

export const LAB_TEST_BY_ID = new Map(ALL_LAB_TESTS.map((t) => [t.id, t]));

export type LabUiSection = {
  id: string;
  title: string;
  tests: LabTest[];
  subsections?: { title: string; tests: LabTest[] }[];
};

/** Collapsible UI cards (display order). */
export const LAB_UI_SECTIONS: LabUiSection[] = [
  {
    id: "haematology",
    title: "Haematology",
    tests: LAB_FORM_COLUMNS[0]!.blocks[0]!.tests,
  },
  {
    id: "microbiology",
    title: "Microbiology",
    tests: LAB_FORM_COLUMNS[0]!.blocks[1]!.tests,
  },
  {
    id: "blood_culture_group",
    title: "Blood Culture & Mycology",
    tests: LAB_FORM_COLUMNS[1]!.blocks[0]!.tests,
  },
  {
    id: "chemistry",
    title: "Chemistry",
    tests: LAB_FORM_COLUMNS[1]!.blocks[1]!.tests,
  },
  {
    id: "kidney_function",
    title: "Kidney Function Test",
    tests: (LAB_FORM_COLUMNS[1]!.blocks[2] as { tests: LabTest[] }).tests,
  },
  {
    id: "electrolytes",
    title: "Electrolytes",
    tests: (LAB_FORM_COLUMNS[1]!.blocks[3] as { tests: LabTest[] }).tests,
  },
  {
    id: "diabetes",
    title: "Diabetes",
    tests: (LAB_FORM_COLUMNS[1]!.blocks[4] as { tests: LabTest[] }).tests,
  },
  {
    id: "cardiac",
    title: "Cardiac Function",
    tests: (LAB_FORM_COLUMNS[1]!.blocks[5] as { tests: LabTest[] }).tests,
  },
  {
    id: "lipid",
    title: "Lipid Profile",
    tests: (LAB_FORM_COLUMNS[1]!.blocks[6] as { tests: LabTest[] }).tests,
  },
  {
    id: "thyroid",
    title: "Thyroid Function",
    tests: (LAB_FORM_COLUMNS[2]!.blocks[0] as { tests: LabTest[] }).tests,
  },
  {
    id: "fertility",
    title: "Fertility Profile",
    tests: (LAB_FORM_COLUMNS[2]!.blocks[1] as { tests: LabTest[] }).tests,
  },
  {
    id: "immunological",
    title: "Immunological Assays",
    tests: [],
    subsections: [
      {
        title: "Tumor Markers",
        tests: (LAB_FORM_COLUMNS[2]!.blocks[3] as { tests: LabTest[] }).tests,
      },
      {
        title: "Hepatitis",
        tests: (LAB_FORM_COLUMNS[2]!.blocks[4] as { tests: LabTest[] }).tests,
      },
    ],
  },
  {
    id: "serology",
    title: "Serology",
    tests: LAB_FORM_COLUMNS[2]!.blocks[5]!.tests,
  },
  {
    id: "urine",
    title: "Urine",
    tests: (LAB_FORM_COLUMNS[2]!.blocks[6] as { tests: LabTest[] }).tests,
  },
  {
    id: "pregnancy",
    title: "Pregnancy",
    tests: (LAB_FORM_COLUMNS[2]!.blocks[7] as { tests: LabTest[] }).tests,
  },
  {
    id: "histopathology",
    title: "Histopathology",
    tests: LAB_FORM_COLUMNS[2]!.blocks[8]!.tests,
  },
];

export function getLabUiSections(): LabUiSection[] {
  return LAB_UI_SECTIONS;
}
