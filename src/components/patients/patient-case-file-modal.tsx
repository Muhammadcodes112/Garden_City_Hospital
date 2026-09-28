"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Printer, Save, FileText, AlertTriangle, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export type PatientRecord = {
  id: string;
  surname: string;
  firstNames: string;
  age?: string;
  sex?: string;
  dob?: string;
  maritalStatus?: string;
  phone?: string;
  address?: string;
  hospitalNumber: string;
  nextOfKinName?: string;
  nextOfKinRelationship?: string;
  nextOfKinPhone?: string;
  nextOfKinAddress?: string;
  xRayNumber?: string;
  placeOfOrigin?: string;
  tribe?: string;
  occupation?: string;
  religion?: string;
  bloodGroup?: string;
  rhesus?: string;
  genotype?: string;
  allergies?: string;
  status?: string;
  doctor?: string;
  lastVisit?: string;
  caseFileData?: any;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientRecord;
  onUpdated?: () => void;
};

export function PatientCaseFileModal({ open, onOpenChange, patient, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State initialized from patient props
  const [formData, setFormData] = useState({
    surname: patient.surname || "",
    firstNames: patient.firstNames || "",
    age: patient.age || "",
    sex: patient.sex || "Male",
    dob: patient.dob || "",
    maritalStatus: patient.maritalStatus || "Single",
    phone: patient.phone || "",
    address: patient.address || "",
    hospitalNumber: patient.hospitalNumber || "",
    nextOfKinName: patient.nextOfKinName || "",
    nextOfKinRelationship: patient.nextOfKinRelationship || "",
    nextOfKinPhone: patient.nextOfKinPhone || "",
    nextOfKinAddress: patient.nextOfKinAddress || "",
    xRayNumber: patient.xRayNumber || "",
    placeOfOrigin: patient.placeOfOrigin || "",
    tribe: patient.tribe || "",
    occupation: patient.occupation || "",
    religion: patient.religion || "",
    bloodGroup: patient.bloodGroup || "O+",
    rhesus: patient.rhesus || "Positive",
    genotype: patient.genotype || "AA",
    allergies: patient.allergies || "",
    status: patient.status || "Outpatient",
    doctor: patient.doctor || "",
    hospitalHistory: patient.caseFileData?.hospitalHistory || [
      { dateAttended: "2026-09-20", referredBy: "Dr. Ahmed", physician: "Dr. Ibrahim", wardClinic: "GOPD", dateDischarged: "2026-09-22", disposal: "Discharged Home", assetpay: "Paid" },
    ],
    diagnoses: patient.caseFileData?.diagnoses || [
      { date: "2026-09-20", diagnosis: "Acute Febrile Illness / Malaria", code: "A75.9" },
    ],
    operations: patient.caseFileData?.operations || [],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surname: formData.surname,
          firstNames: formData.firstNames,
          age: formData.age,
          sex: formData.sex,
          dob: formData.dob,
          maritalStatus: formData.maritalStatus,
          phone: formData.phone,
          address: formData.address,
          nextOfKinName: formData.nextOfKinName,
          nextOfKinRelationship: formData.nextOfKinRelationship,
          nextOfKinPhone: formData.nextOfKinPhone,
          nextOfKinAddress: formData.nextOfKinAddress,
          xRayNumber: formData.xRayNumber,
          placeOfOrigin: formData.placeOfOrigin,
          tribe: formData.tribe,
          occupation: formData.occupation,
          religion: formData.religion,
          bloodGroup: formData.bloodGroup,
          rhesus: formData.rhesus,
          genotype: formData.genotype,
          allergies: formData.allergies,
          status: formData.status,
          doctor: formData.doctor,
          caseFileData: {
            ...patient.caseFileData,
            hospitalHistory: formData.hospitalHistory,
            diagnoses: formData.diagnoses,
            operations: formData.operations,
          },
        }),
      });

      if (res.ok) {
        toast.success("Patient case file updated successfully");
        setEditing(false);
        if (onUpdated) onUpdated();
      } else {
        toast.error("Failed to update case file");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving patient file");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const addHospitalHistoryRow = () => {
    setFormData((prev) => ({
      ...prev,
      hospitalHistory: [
        ...prev.hospitalHistory,
        { dateAttended: "", referredBy: "", physician: "", wardClinic: "", dateDischarged: "", disposal: "", assetpay: "" },
      ],
    }));
  };

  const addDiagnosisRow = () => {
    setFormData((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, { date: "", diagnosis: "", code: "" }],
    }));
  };

  const addOperationRow = () => {
    setFormData((prev) => ({
      ...prev,
      operations: [...prev.operations, { date: "", operation: "", code: "" }],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-white text-slate-900 border border-pink-300 shadow-2xl">
        {/* Pink Folder Header Bar */}
        <div className="bg-pink-100 border-b border-pink-300 p-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-pink-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              📁
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-pink-950 flex items-center gap-2">
                PATIENT CASE FILE FOLDER
                <Badge variant="secondary" className="border-pink-400 bg-pink-50 text-pink-900 font-mono text-xs">
                  {formData.hospitalNumber}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-pink-800 font-medium">
                GARDEN CITY SPECIALIST HOSPITAL · KADUNA, NIGERIA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(!editing)}
              className="border-pink-300 bg-white text-pink-900 hover:bg-pink-50 text-xs"
            >
              {editing ? "Cancel Edit" : "Edit File"}
            </Button>
            {editing && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="border-pink-300 bg-white text-pink-900 hover:bg-pink-50 text-xs gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" /> Print Folder
            </Button>
          </div>
        </div>

        {/* PHYSICAL PINK CASE FOLDER CONTAINER (REPLICATING IMAGE 1) */}
        <div className="p-6 space-y-6 bg-pink-50/50 print:p-0">
          {/* Main Case Folder Form Box */}
          <div className="border-2 border-pink-400 rounded-lg p-5 bg-pink-100/40 shadow-sm space-y-5 text-xs text-slate-800">
            
            {/* Top Patient Bio Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b-2 border-pink-300 pb-4">
              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Surname:</span>
                {editing ? (
                  <Input
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    className="h-8 text-xs bg-white border-pink-300 mt-1"
                  />
                ) : (
                  <p className="font-semibold text-sm text-slate-900 border-b border-pink-400/60 pb-1">{formData.surname}</p>
                )}
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Firstname:</span>
                {editing ? (
                  <Input
                    value={formData.firstNames}
                    onChange={(e) => setFormData({ ...formData, firstNames: e.target.value })}
                    className="h-8 text-xs bg-white border-pink-300 mt-1"
                  />
                ) : (
                  <p className="font-semibold text-sm text-slate-900 border-b border-pink-400/60 pb-1">{formData.firstNames}</p>
                )}
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Case File Number:</span>
                <p className="font-bold text-sm text-pink-900 border-b border-pink-400/60 pb-1 font-mono">{formData.hospitalNumber}</p>
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Date of Birth / Age:</span>
                {editing ? (
                  <Input
                    value={formData.dob || formData.age}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="h-8 text-xs bg-white border-pink-300 mt-1"
                  />
                ) : (
                  <p className="font-semibold text-sm text-slate-900 border-b border-pink-400/60 pb-1">{formData.dob || `${formData.age} Yrs`}</p>
                )}
              </div>
            </div>

            {/* Address & Next of Kin Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b-2 border-pink-300 pb-4">
              <div className="md:col-span-2">
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">House Address:</span>
                {editing ? (
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="h-8 text-xs bg-white border-pink-300 mt-1"
                  />
                ) : (
                  <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.address || "N/A"}</p>
                )}
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Sex / Marital Status:</span>
                {editing ? (
                  <div className="flex gap-2 mt-1">
                    <select
                      value={formData.sex}
                      onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                      className="h-8 rounded border border-pink-300 bg-white text-xs px-2"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <select
                      value={formData.maritalStatus}
                      onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                      className="h-8 rounded border border-pink-300 bg-white text-xs px-2"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                ) : (
                  <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.sex} · {formData.maritalStatus}</p>
                )}
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Name of Next of Kin:</span>
                {editing ? (
                  <Input
                    value={formData.nextOfKinName}
                    onChange={(e) => setFormData({ ...formData, nextOfKinName: e.target.value })}
                    className="h-8 text-xs bg-white border-pink-300 mt-1"
                  />
                ) : (
                  <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.nextOfKinName || "N/A"}</p>
                )}
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Relationship:</span>
                {editing ? (
                  <Input
                    value={formData.nextOfKinRelationship}
                    onChange={(e) => setFormData({ ...formData, nextOfKinRelationship: e.target.value })}
                    className="h-8 text-xs bg-white border-pink-300 mt-1"
                  />
                ) : (
                  <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.nextOfKinRelationship || "N/A"}</p>
                )}
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Next of Kin Phone:</span>
                {editing ? (
                  <Input
                    value={formData.nextOfKinPhone}
                    onChange={(e) => setFormData({ ...formData, nextOfKinPhone: e.target.value })}
                    className="h-8 text-xs bg-white border-pink-300 mt-1"
                  />
                ) : (
                  <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.nextOfKinPhone || "N/A"}</p>
                )}
              </div>
            </div>

            {/* Demographics Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-b-2 border-pink-300 pb-4">
              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Place of Origin:</span>
                <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.placeOfOrigin || "Kaduna"}</p>
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Tribe:</span>
                <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.tribe || "Hausa"}</p>
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Occupation:</span>
                <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.occupation || "Civil Servant"}</p>
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Religion:</span>
                <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.religion || "Islam"}</p>
              </div>

              <div>
                <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">X-Ray Number:</span>
                <p className="font-medium text-slate-900 border-b border-pink-400/60 pb-1">{formData.xRayNumber || "XR-9921"}</p>
              </div>
            </div>

            {/* HOSPITAL HISTORY TABLE (IMAGE 1) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-pink-950">
                  HOSPITAL HISTORY (VISITS & ADMISSIONS)
                </h3>
                {editing && (
                  <Button size="sm" variant="ghost" onClick={addHospitalHistoryRow} className="h-6 text-[11px] text-pink-800">
                    <Plus className="h-3 w-3 mr-1" /> Add Row
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto border border-pink-300 rounded bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-pink-100 text-pink-950 font-bold border-b border-pink-300">
                    <tr>
                      <th className="p-2">Date Attended</th>
                      <th className="p-2">Referred By</th>
                      <th className="p-2">Physician / Surgeon</th>
                      <th className="p-2">Ward / Clinic</th>
                      <th className="p-2">Date Discharged</th>
                      <th className="p-2">Disposal</th>
                      <th className="p-2">Assetpay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-200">
                    {formData.hospitalHistory.map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">{row.dateAttended}</td>
                        <td className="p-2">{row.referredBy}</td>
                        <td className="p-2">{row.physician}</td>
                        <td className="p-2">{row.wardClinic}</td>
                        <td className="p-2">{row.dateDischarged}</td>
                        <td className="p-2">{row.disposal}</td>
                        <td className="p-2">{row.assetpay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DIAGNOSES TABLE (IMAGE 1) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-pink-950">
                  DIAGNOSIS RECORD
                </h3>
                {editing && (
                  <Button size="sm" variant="ghost" onClick={addDiagnosisRow} className="h-6 text-[11px] text-pink-800">
                    <Plus className="h-3 w-3 mr-1" /> Add Diagnosis
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto border border-pink-300 rounded bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-pink-100 text-pink-950 font-bold border-b border-pink-300">
                    <tr>
                      <th className="p-2 w-28">Date</th>
                      <th className="p-2">Clinical Diagnosis</th>
                      <th className="p-2 w-28">ICD Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-200">
                    {formData.diagnoses.map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">{row.date}</td>
                        <td className="p-2">{row.diagnosis}</td>
                        <td className="p-2 font-mono">{row.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ALLERGY ALERT BOX (IMAGE 1) */}
            <div className="border-2 border-red-500 rounded bg-red-50 p-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-red-900 uppercase tracking-wider text-[10px]">
                  IMPORTANT: This Patient is Sensitive / Allergic to:
                </span>
                {editing ? (
                  <Input
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    placeholder="e.g. Penicillin, NSAIDs, Sulfa drugs"
                    className="h-8 text-xs bg-white border-red-300 mt-1"
                  />
                ) : (
                  <p className="font-bold text-red-700 text-xs mt-0.5">
                    {formData.allergies || "No Known Medical Allergies (NKDA)"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 border-l border-red-200 pl-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Blood Group:</span>
                  <p className="font-bold text-xs text-slate-900">{formData.bloodGroup} {formData.rhesus}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Genotype:</span>
                  <p className="font-bold text-xs text-slate-900">{formData.genotype}</p>
                </div>
              </div>
            </div>

            {/* CONSENT OF OPERATION (IMAGE 1) */}
            <div className="border border-pink-300 rounded bg-white p-4 space-y-2 text-[10.5px]">
              <h4 className="font-bold text-center text-pink-950 uppercase tracking-wider">
                CONSENT OF OPERATION
              </h4>
              <p className="text-slate-700 leading-relaxed text-[10px]">
                To the Medical Staff and Committee Management of Garden City Specialist Hospital:<br />
                I hereby consent to undergo the operation of surgical procedures, the effect and values of which have been explained to me by the attending surgeon. I also consent to such further alternative operation measures as may be found to be necessary during the course of such operation and to the administration of a local or general anaesthetic.
              </p>
              <div className="flex items-center justify-between pt-3 text-[10px] text-slate-600 border-t border-pink-200">
                <span>Dated this {new Date().getDate()} day of {new Date().toLocaleString("en-US", { month: "long" })}, 2026</span>
                <span className="font-semibold text-slate-900">Signed: Patient / Next of Kin</span>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
