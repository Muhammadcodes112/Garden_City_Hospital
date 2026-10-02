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
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Save, FileText, AlertTriangle, Plus, Trash2, Download, ShieldCheck, FileCheck, Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
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
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as { role?: string })?.role === "super_admin";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"cover" | "inside" | "operations">("inside");

  const handleDelete = async () => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin accounts can delete patient records");
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete patient file ${patient.hospitalNumber}? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(`Patient file ${patient.hospitalNumber} deleted`);
        onOpenChange(false);
        if (onUpdated) onUpdated();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete patient");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting patient");
    } finally {
      setDeleting(false);
    }
  };

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
    caseFolderPreparedBy: patient.caseFileData?.caseFolderPreparedBy || "Medical Records Officer",
    hasOperations: Boolean(patient.caseFileData?.hasOperations),
    hospitalHistory: patient.caseFileData?.hospitalHistory || [
      { dateAttended: "2026-09-20", referredBy: "Dr. Ahmed", physician: "Dr. Ibrahim", wardClinic: "GOPD", dateDischarged: "2026-09-22", disposal: "Discharged Home", assetpay: "Paid" },
    ],
    diagnoses: patient.caseFileData?.diagnoses || [
      { date: "2026-09-20", diagnosis: "Acute Febrile Illness / Malaria", code: "A75.9" },
    ],
    operations: patient.caseFileData?.operations || [],
    operationConsents: patient.caseFileData?.operationConsents || [
      { surgeonName: "", procedureName: "", consentDate: "", patientSignature: "", witnessName: "", witnessSignature: "" },
    ],
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
            caseFolderPreparedBy: formData.caseFolderPreparedBy,
            hasOperations: formData.hasOperations,
            hospitalHistory: formData.hospitalHistory,
            diagnoses: formData.diagnoses,
            operations: formData.operations,
            operationConsents: formData.operationConsents,
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

  const addOperationConsentBlock = () => {
    setFormData((prev) => ({
      ...prev,
      operationConsents: [
        ...prev.operationConsents,
        { surgeonName: "", procedureName: "", consentDate: "", patientSignature: "", witnessName: "", witnessSignature: "" },
      ],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 bg-white text-slate-900 border border-pink-300 shadow-2xl">
        {/* Pink Folder Header Bar */}
        <div className="bg-pink-100 border-b border-pink-300 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-pink-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              📁
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-pink-950 flex items-center gap-2">
                DIGITAL PATIENT CASE FOLDER
                <Badge variant="secondary" className="border-pink-400 bg-pink-50 text-pink-900 font-mono text-xs">
                  {formData.hospitalNumber}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-pink-800 font-medium">
                GARDEN CITY SPECIALIST HOSPITAL · KADUNA, NIGERIA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button asChild size="sm" className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold gap-1.5">
              <a href={`/api/patients/${patient.id}/case-folder/pdf?download=1`} download={`CaseFolder_${formData.hospitalNumber}.pdf`}>
                <Download className="h-3.5 w-3.5" /> Download PDF
              </a>
            </Button>
            {isSuperAdmin && (
              <Button
                size="sm"
                variant="outline"
                disabled={deleting}
                onClick={handleDelete}
                className="border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-semibold gap-1.5"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-rose-600" />}
                Delete File
              </Button>
            )}
          </div>
        </div>

        {/* PAGE NAVIGATION TABS */}
        <div className="bg-pink-200/80 px-4 py-2 border-b border-pink-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("cover")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                activeTab === "cover" ? "bg-pink-600 text-white shadow-xs" : "bg-pink-100 text-pink-900 hover:bg-pink-50"
              }`}
            >
              Page 1: Folder Cover
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inside")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                activeTab === "inside" ? "bg-pink-600 text-white shadow-xs" : "bg-pink-100 text-pink-900 hover:bg-pink-50"
              }`}
            >
              Page 2: File History & Diagnoses
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("operations")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === "operations" ? "bg-pink-600 text-white shadow-xs" : "bg-pink-100 text-pink-900 hover:bg-pink-50"
              }`}
            >
              <span>Page 3: Operation Consents</span>
              {formData.hasOperations ? (
                <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0">Active</Badge>
              ) : (
                <Badge variant="secondary" className="border border-pink-400 text-pink-700 text-[9px] px-1 py-0">Optional</Badge>
              )}
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-pink-950 cursor-pointer bg-white/80 px-2.5 py-1 rounded border border-pink-300">
            <Checkbox
              checked={formData.hasOperations}
              onCheckedChange={(c) => setFormData({ ...formData, hasOperations: c === true })}
            />
            <span>Patient undergoing operation (Include Page 3)</span>
          </label>
        </div>

        {/* PHYSICAL PINK CASE FOLDER CONTAINER */}
        <div className="p-6 space-y-6 bg-pink-50/60 min-h-[550px]">
          
          {/* TAB 1: COVER PAGE (IMAGE 1) */}
          {activeTab === "cover" && (
            <div className="max-w-2xl mx-auto border-2 border-slate-900 rounded-lg p-6 bg-[#ffdede] shadow-xl text-slate-900 space-y-6">
              <div className="grid grid-cols-3 border-2 border-slate-900 bg-[#fff0f0]">
                <div className="border-r-2 border-slate-900 p-3">
                  <div className="text-[10px] font-extrabold uppercase text-slate-700">SURNAME</div>
                  <div className="text-base font-extrabold text-slate-900">{formData.surname}</div>
                </div>
                <div className="border-r-2 border-slate-900 p-3">
                  <div className="text-[10px] font-extrabold uppercase text-slate-700">FIRST NAME(S)</div>
                  <div className="text-base font-extrabold text-slate-900">{formData.firstNames}</div>
                </div>
                <div className="p-3">
                  <div className="text-[10px] font-extrabold uppercase text-slate-700">HOSPITAL NUMBER</div>
                  <div className="text-base font-extrabold text-slate-900 font-mono">{formData.hospitalNumber}</div>
                </div>
              </div>

              <div className="text-center">
                <h1 className="text-3xl font-serif font-extrabold tracking-widest text-slate-900 py-2">
                  CONFIDENTIAL
                </h1>

                <div className="my-6">
                  <img src="/brand/logo-full.png" alt="Logo" className="w-24 mx-auto mb-2" />
                  <h2 className="text-2xl font-black tracking-wide text-slate-900">GARDEN CITY</h2>
                  <div className="inline-block bg-slate-900 text-white font-extrabold px-3 py-1 text-sm rounded mt-1">
                    SPECIALIST HOSPITAL
                  </div>
                  <p className="italic text-xs text-slate-700 mt-2 font-medium">
                    The Pathway to High-Quality and Affordable Health Care
                  </p>
                </div>

                <div className="text-xs font-semibold text-slate-800 space-y-0.5 mt-8">
                  <div>No: 2 Sultan Road Ungwan Rimi G.R.A., Kaduna.</div>
                  <div>Tel: 062-293293, 08077062451</div>
                  <div className="italic text-blue-900 font-bold">gardencityspecialisthospital@yahoo.com</div>
                </div>
              </div>

              <div className="pt-8 border-t-2 border-slate-900 text-xs font-bold flex items-center justify-between">
                <span>CASE FOLDER PREPARED BY:</span>
                {editing ? (
                  <Input
                    value={formData.caseFolderPreparedBy}
                    onChange={(e) => setFormData({ ...formData, caseFolderPreparedBy: e.target.value })}
                    className="max-w-xs h-8 bg-white border-slate-400 text-xs"
                  />
                ) : (
                  <span className="underline text-slate-900 font-extrabold">{formData.caseFolderPreparedBy}</span>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FILE DETAILS & HISTORY (IMAGE 2) */}
          {activeTab === "inside" && (
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
                  <span className="font-bold text-pink-950 uppercase tracking-wider text-[10px]">Hospital Number:</span>
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

              {/* HOSPITAL HISTORY TABLE (IMAGE 2) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-pink-950">
                    HOSPITAL HISTORY (VISITS & ADMISSIONS)
                  </h3>
                  {editing && (
                    <Button size="sm" variant="ghost" onClick={addHospitalHistoryRow} className="h-6 text-[11px] text-pink-800">
                      <Plus className="h-3 w-3 mr-1" /> Add Visit Row
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

              {/* DIAGNOSES TABLE (IMAGE 2) */}
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
                        <th className="p-2 w-28">Code Number</th>
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

              {/* OPERATIONS SUMMARY TABLE (IMAGE 2) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-pink-950">
                    OPERATIONS
                  </h3>
                  {editing && (
                    <Button size="sm" variant="ghost" onClick={addOperationRow} className="h-6 text-[11px] text-pink-800">
                      <Plus className="h-3 w-3 mr-1" /> Add Operation
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto border border-pink-300 rounded bg-white">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-pink-100 text-pink-950 font-bold border-b border-pink-300">
                      <tr>
                        <th className="p-2 w-28">Date</th>
                        <th className="p-2">Operation Procedure</th>
                        <th className="p-2 w-28">Code Number</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pink-200">
                      {formData.operations.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-3 text-center text-slate-400 italic">No operations performed</td>
                        </tr>
                      ) : (
                        formData.operations.map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium">{row.date}</td>
                            <td className="p-2">{row.operation}</td>
                            <td className="p-2 font-mono">{row.code}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ALLERGY & BLOOD INFO ALERT BOX (IMAGE 2) */}
              <div className="border-2 border-red-500 rounded bg-red-50 p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-start gap-2 flex-1">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-red-900 uppercase tracking-wider text-[10px]">
                      IMPORTANT: Sensitive / Allergic to:
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
                </div>

                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-red-200 pt-2 md:pt-0 md:pl-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Blood Group / Rhesus:</span>
                    <p className="font-bold text-xs text-slate-900">{formData.bloodGroup} ({formData.rhesus})</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Hb / Genotype:</span>
                    <p className="font-bold text-xs text-slate-900">{formData.genotype}</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SURGICAL CONSENT OF OPERATION (IMAGE 3) */}
          {activeTab === "operations" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-pink-100 p-3 rounded-md border border-pink-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-pink-700" />
                    <span className="font-bold text-xs text-pink-950 uppercase tracking-wider">
                      PAGE 3: SURGICAL CONSENT OF OPERATION FORMS
                    </span>
                  </div>
                  {editing && (
                    <Button size="sm" variant="outline" onClick={addOperationConsentBlock} className="h-7 text-xs bg-white border-pink-300">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Consent Block
                    </Button>
                  )}
                </div>

                {formData.operationConsents.map((consent: any, idx: number) => (
                  <div key={idx} className="border-2 border-pink-300 rounded-lg p-4 bg-white space-y-3 text-xs shadow-xs">
                    <div className="font-extrabold text-center text-slate-900 text-sm tracking-wider underline">
                      CONSENT OF OPERATION #{idx + 1}
                    </div>
                    <p className="text-slate-700 leading-relaxed text-[11px]">
                      To the Medical Staff and Committee Management of <strong>Garden City Specialist Hospital</strong> I 
                      <span className="font-bold text-slate-900 underline px-1">{formData.surname} {formData.firstNames}</span> 
                      hereby consent to undergo the operation of 
                      {editing ? (
                        <Input
                          value={consent.procedureName}
                          onChange={(e) => {
                            const next = [...formData.operationConsents];
                            next[idx].procedureName = e.target.value;
                            setFormData({ ...formData, operationConsents: next });
                          }}
                          placeholder="Name of surgical operation"
                          className="h-7 text-xs inline-block w-48 mx-1 bg-pink-50/50 border-pink-300"
                        />
                      ) : (
                        <span className="font-bold text-slate-900 underline px-1">{consent.procedureName || "__________________"}</span>
                      )}
                      the effect and nature of which has been explained to me by 
                      {editing ? (
                        <Input
                          value={consent.surgeonName}
                          onChange={(e) => {
                            const next = [...formData.operationConsents];
                            next[idx].surgeonName = e.target.value;
                            setFormData({ ...formData, operationConsents: next });
                          }}
                          placeholder="Attending Surgeon"
                          className="h-7 text-xs inline-block w-44 mx-1 bg-pink-50/50 border-pink-300"
                        />
                      ) : (
                        <span className="font-bold text-slate-900 underline px-1">{consent.surgeonName || "__________________"}</span>
                      )}.<br />
                      I also consent to such further alternative operation measures as may be found to be necessary during the course of such operation and to the administration of a local or other anaesthetic or any of the foregoing purposes.<br />
                      I understand an assurance has not been given and that the operation will be performed by a particular surgeon.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-pink-200 text-[11px]">
                      <div>
                        <span className="font-semibold text-slate-500 block text-[10px]">Consent Date:</span>
                        {editing ? (
                          <Input
                            type="date"
                            value={consent.consentDate}
                            onChange={(e) => {
                              const next = [...formData.operationConsents];
                              next[idx].consentDate = e.target.value;
                              setFormData({ ...formData, operationConsents: next });
                            }}
                            className="h-7 text-xs bg-white border-pink-300 mt-0.5"
                          />
                        ) : (
                          <span className="font-bold text-slate-900">{consent.consentDate || "N/A"}</span>
                        )}
                      </div>

                      <div>
                        <span className="font-semibold text-slate-500 block text-[10px]">Patient / Next of Kin Signature:</span>
                        {editing ? (
                          <Input
                            value={consent.patientSignature}
                            onChange={(e) => {
                              const next = [...formData.operationConsents];
                              next[idx].patientSignature = e.target.value;
                              setFormData({ ...formData, operationConsents: next });
                            }}
                            placeholder="Signed Patient/NOK"
                            className="h-7 text-xs bg-white border-pink-300 mt-0.5"
                          />
                        ) : (
                          <span className="font-bold text-blue-900 font-serif italic">{consent.patientSignature || "Pending Signature"}</span>
                        )}
                      </div>

                      <div>
                        <span className="font-semibold text-slate-500 block text-[10px]">Witness Signature & Name:</span>
                        {editing ? (
                          <Input
                            value={consent.witnessName}
                            onChange={(e) => {
                              const next = [...formData.operationConsents];
                              next[idx].witnessName = e.target.value;
                              setFormData({ ...formData, operationConsents: next });
                            }}
                            placeholder="Witness Name"
                            className="h-7 text-xs bg-white border-pink-300 mt-0.5"
                          />
                        ) : (
                          <span className="font-bold text-slate-900">{consent.witnessName || "Pending Witness"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ORDER OF FILING SIDEBAR (IMAGE 3) */}
              <div className="lg:col-span-4 border-2 border-pink-400 rounded-lg p-4 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-pink-300 pb-2">
                  <FileCheck className="h-4 w-4 text-pink-700" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-pink-950">
                    ORDER OF FILING OF CASE FOLDER
                  </h4>
                </div>
                <ol className="space-y-1.5 text-[11px] font-semibold text-slate-800 list-decimal pl-4">
                  <li>CASE SUMMARY</li>
                  <li>OUT-PATIENT NOTES-BY DATE</li>
                  <li>IN-PATIENT NOTES-BY DATE</li>
                  <li>LAB. MOUNT SHEET</li>
                  <li>OTHER REPORTS</li>
                  <li>OPERATION NOTES</li>
                  <li>ANAESTHESIA SHEET</li>
                  <li>LABOUR RECORD</li>
                  <li>TREATMENT SHEET-BY DATE</li>
                  <li>FLUID BALANCE SHEET-BY DATE</li>
                  <li>OBSERVATION NOTE-BY DATE</li>
                  <li>OTHERS CORRESPONDENCE</li>
                  <li>CERTIFICATES ETC</li>
                </ol>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
