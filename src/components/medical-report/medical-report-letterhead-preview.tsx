"use client";

import { formatDate } from "@/lib/date";
import type { PatientFields } from "@/components/lab/patient-picker";
import {
  MEDICAL_REPORT_SECTIONS,
  type MedicalReportData,
} from "@/lib/validators/medical-report";

type Props = {
  patient: PatientFields;
  data: MedicalReportData;
  isDraft: boolean;
};

export function MedicalReportLetterheadPreview({ patient, data, isDraft }: Props) {
  const patientName = `${patient.surname} ${patient.firstNames}`.trim() || "Unnamed Patient";
  const formattedDate = data.reportDate ? formatDate(data.reportDate) : formatDate(new Date());

  const activeSections = MEDICAL_REPORT_SECTIONS.filter(({ key }) => {
    const sec = data.sections?.[key];
    return sec?.enabled && sec.content.trim().length > 0;
  });

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
            <img src="/brand/logo-mark.png" alt="Logo" className="w-12 h-12 object-contain mx-auto" />
            <div className="mt-1 text-[9px] font-bold text-slate-700">RC: 957820</div>
          </div>
          <div className="flex-1 text-center px-2">
            <div className="text-lg font-black tracking-wider leading-none">
              <span className="text-slate-900">GARDEN</span>{" "}
              <span className="text-red-600">CITY</span>
            </div>
            <div className="text-xs font-extrabold text-emerald-800 tracking-wider mt-0.5">
              SPECIALIST HOSPITAL
            </div>
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
          <div>Ref: <span className="font-bold text-slate-900">{data.refNo || "GCSH/MR/DRAFT"}</span></div>
          <div>Date: <span className="font-bold text-slate-900">{formattedDate}</span></div>
        </div>

        {/* ADDRESSEE & TITLE */}
        <div className="font-bold text-slate-900 mb-2">{data.addressee || "To Whom It May Concern"},</div>
        <div className="text-center font-extrabold text-slate-900 text-sm tracking-wider underline mb-4">
          {data.reportTitle || "MEDICAL REPORT"}
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
            {data.admissionDate ? (
              <div>
                <span className="font-bold text-slate-600">First Visit / Adm: </span>
                <span className="font-semibold text-slate-900">{formatDate(data.admissionDate)}</span>
              </div>
            ) : null}
            {data.dischargeDate ? (
              <div>
                <span className="font-bold text-slate-600">Discharge Date: </span>
                <span className="font-semibold text-slate-900">{formatDate(data.dischargeDate)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* SECTIONS LIST */}
        <div className="flex-1 space-y-3">
          {activeSections.length === 0 ? (
            <p className="italic text-slate-400 text-center py-6 text-[11px]">
              (No report sections enabled/filled yet)
            </p>
          ) : (
            activeSections.map(({ key, label }) => {
              const sec = data.sections[key];
              return (
                <div key={key} className="space-y-0.5">
                  <h4 className="font-bold text-emerald-800 text-[10px] uppercase border-b border-slate-200 pb-0.5">
                    {label}
                  </h4>
                  <p className="text-[10px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {sec.content}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* DOCTOR SIGN-OFF */}
        <div className="mt-6 pt-2 flex items-end justify-between border-t border-slate-100">
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
              <div className="h-8"></div>
            )}
            <div className="font-bold text-slate-900 text-[11px]">
              {data.doctorName || "Dr. Medical Officer"}
            </div>
            <div className="text-[9px] text-slate-600">
              {data.doctorDesignation || "Medical Officer"}
            </div>
          </div>
          {data.hospitalStamp ? (
            <div className="w-16 h-12 flex items-center justify-center">
              <img src={data.hospitalStamp} alt="Stamp" className="max-h-12 max-w-16 object-contain opacity-85" />
            </div>
          ) : null}
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
