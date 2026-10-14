"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ListPlus } from "lucide-react";

export const COMMON_EXAMINATION_FINDINGS = [
  "Afebrile, alert and oriented",
  "Febrile, temperature elevated",
  "Mild pallor of conjunctivae",
  "No pallor, jaundice, cyanosis or oedema",
  "Chest clear to auscultation bilaterally",
  "Air entry reduced on affected side",
  "Heart sounds S1 and S2 heard, no murmurs",
  "Abdomen soft, non-tender, no organomegaly",
  "Abdomen tender on palpation",
  "Bowel sounds present and normal",
  "BP within normal limits",
  "BP elevated, hypertensive range",
  "Pulse regular, good volume",
  "SpO2 within normal limits on room air",
  "Throat congested, tonsils enlarged",
  "Ears: tympanic membranes intact bilaterally",
  "Skin warm, dry, no rashes noted",
  "Mild tenderness on affected limb",
  "Full range of motion, no swelling",
  "CNS grossly intact, no focal deficits",
  "GCS 15/15, no neurological deficit",
  "Mild dehydration noted",
  "Well hydrated, normal skin turgor",
  "Wound clean, no signs of infection",
  "Surgical site healing well",
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  suggestions?: string[];
  className?: string;
};

export function FindingsSuggestField({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 3,
  suggestions = COMMON_EXAMINATION_FINDINGS,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  function insert(suggestion: string) {
    const trimmed = value.trim();
    const needsSeparator = trimmed.length > 0 && !/[.,]\s*$/.test(trimmed);
    const next = trimmed ? `${trimmed}${needsSeparator ? ", " : " "}${suggestion}` : suggestion;
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="mb-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <ListPlus className="mr-1 h-3.5 w-3.5" /> Suggestions
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={className}
      />
      {open ? (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover py-1 text-xs shadow-lg text-popover-foreground">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(s);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
