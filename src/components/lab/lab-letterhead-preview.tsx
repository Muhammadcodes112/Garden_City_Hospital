"use client";

import { formatDate } from "@/lib/date";
import type { PatientFields } from "@/components/lab/patient-picker";
import type { LabRequestData } from "@/lib/validators/lab-request";
import { LAB_TEST_BY_ID } from "@/lib/lab-tests/catalog";

type Props = {
  patient: PatientFields;
  data: LabRequestData;
  isDraft: boolean;
};

export function LabLetterheadPreview({ patient, data, isDraft }: Props) {
  const patientName = `${patient.surname} ${patient.firstNames}`.trim() || "Unnamed Patient";
  const formattedDate = data.formDate ? formatDate(data.formDate) : formatDate(new Date());

  const selectedTests = data.testsSelected
    .map((id) => LAB_TEST_BY_ID.get(id))
    .filter(Boolean);

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
          <div>Document: <span className="font-bold text-slate-900">LAB REQUEST</span></div>
          <div>Date: <span className="font-bold text-slate-900">{formattedDate}</span></div>
        </div>

        {/* TITLE */}
        <div className="text-center font-extrabold text-slate-900 text-sm tracking-wider underline mb-4">
          LABORATORY REQUEST FORM
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
            {data.provisionalDiagnosis ? (
              <div className="col-span-2 mt-1">
                <span className="font-bold text-slate-600">Clinical Info / Diagnosis: </span>
                <span className="font-semibold text-slate-900">{data.provisionalDiagnosis}</span>
              </div>
            ) : null}
            {data.collectionDate || data.collectionTime ? (
              <div className="col-span-2 mt-0.5">
                <span className="font-bold text-slate-600">Collection Time: </span>
                <span className="font-semibold text-slate-900">
                  {data.collectionDate ? formatDate(data.collectionDate) : ""} {data.collectionTime || ""}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* TESTS REQUESTED SECTION */}
        <div className="flex-1 space-y-2">
          <h4 className="font-bold text-emerald-800 text-[11px] uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
            <span>Requested Investigations</span>
            <span className="text-[10px] text-slate-500 font-normal">({selectedTests.length} selected)</span>
          </h4>
          {selectedTests.length === 0 ? (
            <p className="italic text-slate-400 text-center py-8 text-[11px]">
              (No lab tests selected yet)
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {selectedTests.map((t) => (
                <div
                  key={t?.id}
                  className="flex items-center gap-1.5 bg-slate-100/80 rounded px-2 py-1 text-[10px] text-slate-800 font-medium border border-slate-200"
                >
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="truncate">{t?.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DOCTOR SIGN-OFF */}
        <div className="mt-6 pt-3 flex items-end justify-between border-t border-slate-200">
          <div>
            <div className="font-bold text-slate-600 text-[10px]">Referring Doctor:</div>
            <div className="font-extrabold text-slate-900 text-xs">
              {data.referringDoctor || "Dr. Medical Officer"}
            </div>
            {data.referringPhone ? (
              <div className="text-[9px] text-slate-600">Tel: {data.referringPhone}</div>
            ) : null}
            {data.hospitalClinic ? (
              <div className="text-[9px] text-slate-600">{data.hospitalClinic}</div>
            ) : null}
          </div>

          <div>
            {data.doctorSignature?.data ? (
              data.doctorSignature.mode === "draw" ? (
                <img src={data.doctorSignature.data} alt="Sig" className="h-8 max-w-[140px] mb-1" />
              ) : (
                <div className="font-serif italic text-blue-900 font-bold text-sm mb-1">
                  {data.doctorSignature.data}
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
