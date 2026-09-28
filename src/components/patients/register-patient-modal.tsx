"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
};

export function RegisterPatientModal({ open, onOpenChange, onRegistered }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    surname: "",
    firstNames: "",
    age: "",
    sex: "Male",
    dob: "",
    maritalStatus: "Single",
    phone: "",
    address: "",
    hospitalNumber: "",
    nextOfKinName: "",
    nextOfKinRelationship: "",
    nextOfKinPhone: "",
    nextOfKinAddress: "",
    xRayNumber: "",
    placeOfOrigin: "Kaduna",
    tribe: "",
    occupation: "",
    religion: "Islam",
    bloodGroup: "O+",
    rhesus: "Positive",
    genotype: "AA",
    allergies: "",
    status: "Outpatient",
    doctor: "Dr. Amir Ahmed Ibrahim",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.surname.trim() || !form.firstNames.trim()) {
      toast.error("Surname and First Name are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success("Patient Case File created successfully!");
        onOpenChange(false);
        onRegistered();
        // Reset form
        setForm({
          surname: "",
          firstNames: "",
          age: "",
          sex: "Male",
          dob: "",
          maritalStatus: "Single",
          phone: "",
          address: "",
          hospitalNumber: "",
          nextOfKinName: "",
          nextOfKinRelationship: "",
          nextOfKinPhone: "",
          nextOfKinAddress: "",
          xRayNumber: "",
          placeOfOrigin: "Kaduna",
          tribe: "",
          occupation: "",
          religion: "Islam",
          bloodGroup: "O+",
          rhesus: "Positive",
          genotype: "AA",
          allergies: "",
          status: "Outpatient",
          doctor: "Dr. Amir Ahmed Ibrahim",
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create patient file");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error creating patient file");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-brand-black dark:text-white">
            <UserPlus className="h-5 w-5 text-brand-green" /> Register New Patient Case File
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs pt-2">
          {/* Patient Name & MRN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Surname *</Label>
              <Input
                required
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
                placeholder="e.g. Yusuf"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">First Names *</Label>
              <Input
                required
                value={form.firstNames}
                onChange={(e) => setForm({ ...form, firstNames: e.target.value })}
                placeholder="e.g. Fatima Zarah"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Hospital File No (Optional)</Label>
              <Input
                value={form.hospitalNumber}
                onChange={(e) => setForm({ ...form, hospitalNumber: e.target.value })}
                placeholder="Auto-generated if blank"
                className="mt-1 h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Demographics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-semibold">Age (Years)</Label>
              <Input
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="e.g. 28"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Sex</Label>
              <select
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Marital Status</Label>
              <select
                value={form.maritalStatus}
                onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0803XXXXXXX"
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <Label className="text-xs font-semibold">House Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full residence address in Kaduna or state"
              className="mt-1 h-9 text-xs"
            />
          </div>

          {/* Next of Kin Section */}
          <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-3">
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
              Next of Kin Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Next of Kin Name</Label>
                <Input
                  value={form.nextOfKinName}
                  onChange={(e) => setForm({ ...form, nextOfKinName: e.target.value })}
                  placeholder="Full name"
                  className="mt-1 h-8 text-xs bg-background"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Relationship</Label>
                <Input
                  value={form.nextOfKinRelationship}
                  onChange={(e) => setForm({ ...form, nextOfKinRelationship: e.target.value })}
                  placeholder="e.g. Spouse / Brother / Sister"
                  className="mt-1 h-8 text-xs bg-background"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  value={form.nextOfKinPhone}
                  onChange={(e) => setForm({ ...form, nextOfKinPhone: e.target.value })}
                  placeholder="090XXXXXXXX"
                  className="mt-1 h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          {/* Medical Profile & Allergies */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-semibold">Blood Group</Label>
              <select
                value={form.bloodGroup}
                onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Genotype</Label>
              <select
                value={form.genotype}
                onChange={(e) => setForm({ ...form, genotype: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="AA">AA</option>
                <option value="AS">AS</option>
                <option value="SS">SS</option>
                <option value="AC">AC</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Patient Status</Label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="Outpatient">Outpatient</option>
                <option value="Admitted · Maternity">Admitted · Maternity</option>
                <option value="Admitted · Surgical">Admitted · Surgical</option>
                <option value="Admitted · ICU">Admitted · ICU</option>
                <option value="Admitted · Paediatrics">Admitted · Paediatrics</option>
                <option value="Discharged">Discharged</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Attending Doctor</Label>
              <Input
                value={form.doctor}
                onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                placeholder="Dr. Amir Ibrahim"
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          {/* Allergies Box */}
          <div>
            <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Medical Allergies &amp; Sensitivities
            </Label>
            <Input
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              placeholder="e.g. Penicillin, NSAIDs, Sulfa (leave blank if none)"
              className="mt-1 h-9 text-xs border-rose-300 dark:border-rose-800"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-brand-green hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Patient Case File
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
