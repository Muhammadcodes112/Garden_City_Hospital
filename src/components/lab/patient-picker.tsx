"use client";

import { useEffect, useState } from "react";
import { searchPatients, type PatientRow } from "@/lib/actions/patients";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PatientFields = {
  id: string;
  surname: string;
  firstNames: string;
  age: string;
  sex: string;
  phone: string;
  address: string;
  hospitalNumber: string;
};

type Props = {
  patient: PatientFields;
  onPatientChange: (patient: PatientFields) => void;
  disabled?: boolean;
};

export function PatientPicker({ patient, onPatientChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientRow[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPatients(query));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function selectRow(row: PatientRow) {
    onPatientChange({
      id: row.id,
      surname: row.surname,
      firstNames: row.firstNames,
      age: row.age ?? "",
      sex: row.sex ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
      hospitalNumber: row.hospitalNumber,
    });
    setQuery("");
    setResults([]);
  }

  function update(field: keyof PatientFields, value: string) {
    onPatientChange({ ...patient, [field]: value });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="patient-search">Find existing patient</Label>
        <Input
          id="patient-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or hospital number"
          disabled={disabled}
          className="mt-1"
        />
        {searching ? (
          <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
        ) : null}
        {results.length > 0 ? (
          <ul className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-popover text-sm shadow-sm">
            {results.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted"
                  onClick={() => selectRow(row)}
                >
                  <span className="font-medium">
                    {row.surname} {row.firstNames}
                  </span>
                  <span className="text-xs text-muted-foreground">{row.hospitalNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="first-names">First name(s)</Label>
          <Input
            id="first-names"
            value={patient.firstNames}
            onChange={(e) => update("firstNames", e.target.value)}
            disabled={disabled}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="surname">Surname</Label>
          <Input
            id="surname"
            value={patient.surname}
            onChange={(e) => update("surname", e.target.value)}
            disabled={disabled}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            value={patient.age}
            onChange={(e) => update("age", e.target.value)}
            disabled={disabled}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Sex</Label>
          <div className="mt-2 flex gap-4">
            {(["Male", "Female"] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="sex"
                  value={option}
                  checked={patient.sex === option}
                  onChange={() => update("sex", option)}
                  disabled={disabled}
                  className="h-4 w-4 accent-primary"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="hospital-no">Hospital number</Label>
          <Input
            id="hospital-no"
            value={patient.hospitalNumber}
            onChange={(e) => update("hospitalNumber", e.target.value)}
            disabled={disabled}
            className="mt-1"
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              onPatientChange({
                ...patient,
                id: patient.id,
                surname: "",
                firstNames: "",
                age: "",
                sex: "",
                phone: "",
                address: "",
                hospitalNumber: patient.hospitalNumber.startsWith("DRAFT-")
                  ? patient.hospitalNumber
                  : `NEW-${Date.now().toString(36).toUpperCase()}`,
              })
            }
          >
            Clear for new patient
          </Button>
        </div>
      </div>
    </div>
  );
}
