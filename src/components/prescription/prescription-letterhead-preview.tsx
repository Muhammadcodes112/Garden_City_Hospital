"use client";

import { formatDate } from "@/lib/date";
import type { PatientFields } from "@/components/lab/patient-picker";
import type { PrescriptionData } from "@/lib/validators/prescription";

type Props = {
  patient: PatientFields;
  data: PrescriptionData;
  isDraft: boolean;
};

export function PrescriptionLetterheadPreview({ patient, data, isDraft }: Props) {
  const patientName = `${patient.surname} ${patient.firstNames}`.trim() || "Unnamed Patient";
  const formattedDate = data.prescriberDate ? formatDate(data.prescriberDate) : formatDate(new Date());

  const activeItems = (data.items || []).filter(
    (item) => item.drugName || item.dose || item.frequency || item.duration,
  );

  return (
    <div className="relative mx-auto min-h-[750px] w-full max-w-[650px] overflow-hidden rounded-md border border-border bg-white text-slate-900 shadow-md p-6 text-xs flex flex-col justify-between select-none pointer-events-none">
      {isDraft ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-10">
          <span className="text-7xl font-bold tracking-widest text-red-600 -rotate-45">DRAFT</span>
        </div>
      ) : null}

      <div className="relative z-10 flex-1 flex flex-col">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="w-16 text-center">
            <img src="/brand/logo-full.png" alt="Garden City Specialist Hospital" className="w-14 mx-auto" />
          </div>
          <div className="flex-1 text-center px-2">
            <img
              src="/brand/wordmark.png"
              alt="Garden City Specialist Hospital"
              className="h-8 mx-auto object-contain"
            />
            <div className="italic text-[9px] text-slate-700 mt-0.5">
              The Pathway to High-Quality and Affordable Health Care
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">
              No. 2 Sultan Road, U/Rimi G.R.A., Kaduna.
            </div>
            <div className="text-[9px] font-semibold text-slate-900">
              Tel: 0807 237 2888, 0802 309 5497, 0807 500 4800
            </div>
            <div className="text-[9px] font-bold italic text-blue-900">
              e-mail: gardencityspecialisthospital@yahoo.com
            </div>
          </div>
          <div className="w-12 flex justify-end">
            <div className="w-10 h-10 rounded bg-red-600 flex items-center justify-center text-white font-bold text-[10px] relative">
              <span>🚑</span>
            </div>
          </div>
        </div>

        {/* REF & DATE BAR */}
        <div className="flex items-center justify-between text-[10px] font-medium mb-3 text-slate-700">
          <div>Document: <span className="font-bold text-slate-900">PRESCRIPTION</span></div>
          <div>Date: <span className="font-bold text-slate-900">{formattedDate}</span></div>
        </div>

        {/* TITLE */}
        <div className="text-center font-extrabold text-slate-900 text-sm tracking-wider underline mb-4">
          PATIENT PRESCRIPTION FORM
        </div>

        {/* PATIENT INFO CARD */}
        <div className="rounded border border-slate-300 bg-slate-50 p-2.5 mb-4 text-[10px]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="font-bold text-slate-600">Patient Name: </span>
              <span className="font-semibold text-slate-900">{patientName}</span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Hospital No: </span>
              <span className="font-semibold text-slate-900">{patient.hospitalNumber || "N/A"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Age / Sex: </span>
              <span className="font-semibold text-slate-900">
                {patient.age || "N/A"} / {patient.sex || "N/A"}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Address: </span>
              <span className="font-semibold text-slate-900">{patient.address || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* CLINICAL NOTES */}
        {data.clinicalNotes ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-2.5 mb-4 text-[10px]">
            <span className="font-bold text-amber-800 uppercase tracking-wide text-[9px]">
              Clinical Notes / Examination Findings:
            </span>
            <p className="text-slate-800 whitespace-pre-wrap mt-0.5">{data.clinicalNotes}</p>
          </div>
        ) : null}

        {/* PRESCRIPTION ITEMS TABLE */}
        <div className="flex-1 space-y-2">
          <h4 className="font-bold text-emerald-800 text-[11px] uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
            <span>Prescribed Medications (Rx)</span>
            <span className="text-[10px] text-slate-500 font-normal">({activeItems.length} items)</span>
          </h4>

          {activeItems.length === 0 ? (
            <p className="italic text-slate-400 text-center py-8 text-[11px]">
              (No medications added yet)
            </p>
          ) : (
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                  <th className="py-1.5 px-2 font-bold w-7 text-center">#</th>
                  <th className="py-1.5 px-2 font-bold">Medication Name</th>
                  <th className="py-1.5 px-2 font-bold">Dose</th>
                  <th className="py-1.5 px-2 font-bold">Frequency</th>
                  <th className="py-1.5 px-2 font-bold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-center text-slate-500 font-bold">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-bold text-slate-900">
                      {item.drugName || "—"} {item.strength ? `(${item.strength})` : ""}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700">{item.dose || "—"}</td>
                    <td className="py-1.5 px-2 text-slate-700">{item.frequency || "—"}</td>
                    <td className="py-1.5 px-2 text-slate-700">{item.duration || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DOCTOR SIGN-OFF */}
        <div className="mt-6 pt-3 flex items-end justify-between border-t border-slate-200">
          <div>
            <div className="font-bold text-slate-600 text-[10px]">Prescriber:</div>
            <div className="font-extrabold text-slate-900 text-xs">
              {data.prescriberName || "Dr. Medical Officer"}
            </div>
          </div>

          <div>
            {data.prescriberSignature?.data ? (
              data.prescriberSignature.mode === "draw" ? (
                <img src={data.prescriberSignature.data} alt="Sig" className="h-8 max-w-[140px] mb-1" />
              ) : (
                <div className="font-serif italic text-blue-900 font-bold text-sm mb-1">
                  {data.prescriberSignature.data}
                </div>
              )
            ) : (
              <div className="h-8 text-[10px] italic text-slate-400">No signature attached</div>
            )}
            <div className="text-[9px] text-slate-500 text-right">Doctor's Signature</div>
          </div>
        </div>
      </div>

      {/* FOOTER BAR */}
      <div className="mt-4 -mx-6 -mb-6 h-6 bg-gradient-to-r from-slate-900 via-red-600 to-orange-500 px-4 flex items-center justify-between text-[8px] font-bold text-white">
        <div>Dr. Amir Ahmed Ibrahim (CMD), Nigerian</div>
        <div>Dr. Tawassul M. El-Amin (Medical Director), Nigerian</div>
      </div>
    </div>
  );
}
