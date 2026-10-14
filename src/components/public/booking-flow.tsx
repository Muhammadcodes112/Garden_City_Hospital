"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Stethoscope,
  Phone,
  Mail,
  FileText,
  CalendarCheck,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { formatLagosTime, DaySummary, SlotInfo } from "@/lib/appointments/types";

interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  slotMinutes: number;
}

export function BookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Read step from URL
  const step = searchParams.get("step") || "doctor";
  const doctorIdParam = searchParams.get("doctorId") || "";
  const dateParam = searchParams.get("date") || "";
  const startsAtParam = searchParams.get("startsAt") || "";
  const timeParam = searchParams.get("time") || "";

  // Data state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // Availability state
  const [selectedDate, setSelectedDate] = useState<string>(dateParam);
  const [weekStrip, setWeekStrip] = useState<DaySummary[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Patient details state
  const [patientName, setPatientName] = useState(searchParams.get("name") || "");
  const [patientPhone, setPatientPhone] = useState(searchParams.get("phone") || "");
  const [patientEmail, setPatientEmail] = useState(searchParams.get("email") || "");
  const [reason, setReason] = useState(searchParams.get("reason") || "");

  // Auto-fill patient details from session if available
  useEffect(() => {
    if (session?.user) {
      if (!patientName && session.user.name) setPatientName(session.user.name);
      if (!patientEmail && session.user.email) setPatientEmail(session.user.email);
    }
  }, [session, patientName, patientEmail]);

  // Booking submit state
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<any | null>(null);
  const [collisionError, setCollisionError] = useState<{
    message: string;
    nextSlots: { time: string; startsAt: string; dateStr: string }[];
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 1. Fetch doctors catalog on load
  useEffect(() => {
    async function loadDoctors() {
      try {
        setLoadingDoctors(true);
        const res = await fetch("/api/appointments/doctors");
        const data = await res.json();
        if (data.doctors) {
          setDoctors(data.doctors);
          if (doctorIdParam) {
            const found = data.doctors.find((d: Doctor) => d.id === doctorIdParam);
            if (found) setSelectedDoctor(found);
          }
        }
      } catch (err) {
        console.error("Failed to load doctors:", err);
      } finally {
        setLoadingDoctors(false);
      }
    }
    loadDoctors();
  }, [doctorIdParam]);

  // 2. Fetch availability slots whenever doctor or date changes
  useEffect(() => {
    if (!doctorIdParam) return;

    async function loadAvailability() {
      try {
        setLoadingSlots(true);
        const url = `/api/appointments/availability?doctorId=${doctorIdParam}${
          selectedDate ? `&date=${selectedDate}` : ""
        }`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.slots) {
          setSlots(data.slots);
          setWeekStrip(data.weekStrip || []);
          setSelectedDate(data.date);

          // If startsAtParam is provided, pre-select the slot
          if (startsAtParam) {
            const matched = data.slots.find((s: SlotInfo) => s.startsAt === startsAtParam);
            if (matched) setSelectedSlot(matched);
          }
        }
      } catch (err) {
        console.error("Failed to load availability:", err);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadAvailability();
  }, [doctorIdParam, selectedDate, startsAtParam]);

  // Helper to update URL query params with shallow routing
  function updateUrl(params: Record<string, string>) {
    const current = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) current.set(k, v);
      else current.delete(k);
    });
    router.push(`/book?${current.toString()}`);
  }

  // Step 1: Select doctor
  function handleSelectDoctor(doc: Doctor) {
    setSelectedDoctor(doc);
    updateUrl({
      step: "datetime",
      doctorId: doc.id,
    });
  }

  // Step 2: Select Date & Slot
  function handleSelectSlot(slot: SlotInfo) {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setCollisionError(null);
  }

  function handleContinueToDetails() {
    if (!selectedSlot || !selectedDoctor) return;
    updateUrl({
      step: "details",
      doctorId: selectedDoctor.id,
      date: selectedDate,
      startsAt: selectedSlot.startsAt,
      time: selectedSlot.time,
    });
  }

  // Step 3: Continue to Confirm
  function handleContinueToConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) {
      setSubmitError("Please fill in your name and phone number.");
      return;
    }
    if (patientPhone.length !== 11) {
      setSubmitError("Phone number must be exactly 11 digits.");
      return;
    }
    setSubmitError(null);
    updateUrl({
      step: "confirm",
      doctorId: selectedDoctor?.id || doctorIdParam,
      date: selectedDate,
      startsAt: selectedSlot?.startsAt || startsAtParam,
      time: selectedSlot?.time || timeParam,
      name: patientName,
      phone: patientPhone,
      email: patientEmail,
      reason,
    });
  }

  // Step 4: Final Booking Submission
  async function handleConfirmBooking() {
    if (!selectedDoctor || !startsAtParam) return;

    setSubmitting(true);
    setSubmitError(null);
    setCollisionError(null);

    try {
      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          startsAt: startsAtParam,
          patientName,
          patientPhone,
          patientEmail: patientEmail || null,
          reason: reason || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.code === "SLOT_TAKEN") {
          // Double-booking collision! Catch error and display friendly options
          setCollisionError({
            message: data.error || "That time was just taken, here are the next three available slots:",
            nextSlots: data.nextSlots || [],
          });
          return;
        }

        setSubmitError(data.error || "Failed to confirm appointment. Please try again.");
        return;
      }

      setConfirmedAppointment(data.appointment);
    } catch (err: any) {
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // One-click switch to an alternative slot suggested after collision
  function handleSelectAlternativeSlot(alt: { time: string; startsAt: string; dateStr: string }) {
    setSelectedDate(alt.dateStr);
    updateUrl({
      step: "confirm",
      date: alt.dateStr,
      startsAt: alt.startsAt,
      time: alt.time,
    });
    setCollisionError(null);
  }

  // Generate .ics calendar download
  function downloadIcs() {
    if (!confirmedAppointment || !selectedDoctor) return;
    const start = new Date(confirmedAppointment.startsAt)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(confirmedAppointment.endsAt)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, "");

    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Garden City Specialist Hospital//Appointments//EN",
      "BEGIN:VEVENT",
      `UID:${confirmedAppointment.id}@gardencityhospital.ng`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:Hospital Appointment - ${selectedDoctor.fullName}`,
      `DESCRIPTION:Appointment with ${selectedDoctor.fullName} (${selectedDoctor.specialty}) at Garden City Specialist Hospital.`,
      "LOCATION:Garden City Specialist Hospital, Kaduna, Nigeria",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `appointment-${confirmedAppointment.id.slice(0, 8)}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Render Confirmation Success Screen
  if (confirmedAppointment) {
    return (
      <div className="mx-auto max-w-2xl py-8 px-4 sm:px-6">
        <Card className="overflow-hidden border-2 border-emerald-500/80 bg-card shadow-lg p-6 sm:p-8 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
          </div>

          <div>
            <Badge className="bg-emerald-500/10 text-emerald-800 border-emerald-500/30 text-xs font-bold px-3 py-1 mb-2">
              APPOINTMENT BOOKED
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              You&apos;re All Set!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A confirmation message has been queued for your phone and email.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-muted/40 border border-slate-200 dark:border-border/60 p-5 text-left space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs text-muted-foreground font-semibold">Doctor</span>
              <span className="text-sm font-bold text-foreground">
                {selectedDoctor?.fullName} ({selectedDoctor?.specialty})
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs text-muted-foreground font-semibold">Date & Time</span>
              <span className="text-sm font-bold text-brand-green">
                {new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Africa/Lagos",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(confirmedAppointment.startsAt))} · {timeParam || formatLagosTime(new Date(confirmedAppointment.startsAt))}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs text-muted-foreground font-semibold">Patient Name</span>
              <span className="text-sm font-bold text-foreground">{patientName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Reference ID</span>
              <span className="font-mono text-xs font-bold text-muted-foreground">
                {confirmedAppointment.id.slice(0, 13).toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={downloadIcs}
              variant="outline"
              className="font-bold text-xs gap-2 border-border shadow-2xs"
            >
              <CalendarCheck className="h-4 w-4 text-brand-green" />
              <span>Add to Calendar</span>
            </Button>

            {session?.user ? (
              <Button asChild className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-2">
                <Link href="/patient/appointments">
                  <span>View My Appointments</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-2">
                <Link href="/sign-up">
                  <span>Create Account to Track</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 4-Step Flow Progress Header */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
          {/* Step 1: Doctor */}
          <div
            className={`flex items-center gap-1.5 cursor-pointer ${
              step === "doctor"
                ? "text-brand-green font-black"
                : "hover:text-foreground"
            }`}
            onClick={() => updateUrl({ step: "doctor" })}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                step === "doctor"
                  ? "bg-brand-green text-white"
                  : selectedDoctor
                  ? "bg-emerald-500/20 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              1
            </span>
            <span className="hidden sm:inline">Select Doctor</span>
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />

          {/* Step 2: Date & Time */}
          <div
            className={`flex items-center gap-1.5 ${
              selectedDoctor ? "cursor-pointer" : "opacity-50 pointer-events-none"
            } ${step === "datetime" ? "text-brand-green font-black" : "hover:text-foreground"}`}
            onClick={() => selectedDoctor && updateUrl({ step: "datetime" })}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                step === "datetime"
                  ? "bg-brand-green text-white"
                  : startsAtParam
                  ? "bg-emerald-500/20 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              2
            </span>
            <span className="hidden sm:inline">Date & Time</span>
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />

          {/* Step 3: Details */}
          <div
            className={`flex items-center gap-1.5 ${
              startsAtParam ? "cursor-pointer" : "opacity-50 pointer-events-none"
            } ${step === "details" ? "text-brand-green font-black" : "hover:text-foreground"}`}
            onClick={() => startsAtParam && updateUrl({ step: "details" })}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                step === "details"
                  ? "bg-brand-green text-white"
                  : patientName
                  ? "bg-emerald-500/20 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              3
            </span>
            <span className="hidden sm:inline">Your Details</span>
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />

          {/* Step 4: Confirm */}
          <div
            className={`flex items-center gap-1.5 ${
              patientName ? "cursor-pointer" : "opacity-50 pointer-events-none"
            } ${step === "confirm" ? "text-brand-green font-black" : "hover:text-foreground"}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                step === "confirm"
                  ? "bg-brand-green text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              4
            </span>
            <span className="hidden sm:inline">Confirm</span>
          </div>
        </div>
      </div>

      {/* ================= STEP 1: SELECT DOCTOR ================= */}
      {step === "doctor" && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Choose a Specialist
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Select the doctor you wish to consult with at Garden City Specialist Hospital.
            </p>
          </div>

          {loadingDoctors ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-muted/60 animate-pulse border border-border" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map((doc) => {
                const isSelected = selectedDoctor?.id === doc.id;
                return (
                  <Card
                    key={doc.id}
                    onClick={() => handleSelectDoctor(doc)}
                    className={`cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected
                        ? "border-brand-green bg-brand-green/5 shadow-xs"
                        : "border-border/80 bg-card hover:border-brand-green/50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-black to-brand-green text-white shadow-xs">
                        <Stethoscope className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-black text-sm sm:text-base text-foreground leading-snug truncate">
                            {doc.fullName}
                          </h3>
                          <Badge variant="secondary" className="text-[10px] font-bold shrink-0">
                            {doc.slotMinutes} min slots
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-brand-green mt-0.5">
                          {doc.specialty}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">
                          Consultant at Garden City Hospital · Regular consultations & specialized care.
                        </p>
                        <div className="mt-3.5 flex items-center gap-1.5 text-xs font-bold text-brand-green">
                          <span>Select Doctor</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 2: DATE & TIME ================= */}
      {step === "datetime" && selectedDoctor && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Select Date & Time
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Consulting with <strong className="text-foreground">{selectedDoctor.fullName}</strong> ({selectedDoctor.specialty})
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateUrl({ step: "doctor" })}
              className="text-xs font-bold gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Change Doctor</span>
            </Button>
          </div>

          {/* Week Strip showing remaining slots per day */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Day ({weekStrip.length} Days View)
            </span>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 overflow-x-auto pb-1">
              {weekStrip.map((day) => {
                const isDaySelected = selectedDate === day.date;
                const hasSlots = day.remainingCount > 0;

                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={day.totalSlots === 0}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSelectedSlot(null);
                      updateUrl({ step: "datetime", date: day.date, startsAt: "", time: "" });
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 sm:p-2.5 transition-all text-center cursor-pointer border ${
                      isDaySelected
                        ? "border-brand-green bg-brand-green text-white shadow-sm ring-2 ring-brand-green/30"
                        : hasSlots
                        ? "border-border bg-card hover:border-brand-green/60 text-foreground"
                        : "border-border/60 bg-muted/40 text-muted-foreground opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs font-semibold uppercase">
                      {day.dayName}
                    </span>
                    <span className="text-sm sm:text-base font-black my-0.5">
                      {day.dayNumber}
                    </span>
                    <span
                      className={`text-[9px] sm:text-[10px] font-bold px-1 rounded-sm ${
                        isDaySelected
                          ? "bg-white/20 text-white"
                          : hasSlots
                          ? "text-brand-green"
                          : "text-muted-foreground"
                      }`}
                    >
                      {hasSlots ? `${day.remainingCount} left` : "Full"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots Grid for Target Day (taken times struck through, not hidden) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Available Times for {selectedDate} (Africa/Lagos WAT)
              </span>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand-green" /> Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Taken (Struck through)
                </span>
              </div>
            </div>

            {loadingSlots ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-muted/60 animate-pulse border border-border" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center space-y-2">
                <Clock className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-bold text-foreground">
                  No slots available on this day.
                </p>
                <p className="text-xs text-muted-foreground">
                  Doctor is off-duty or fully booked. Please select another day above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {slots.map((slot) => {
                  const isSelected = selectedSlot?.startsAt === slot.startsAt;

                  if (!slot.available) {
                    // TAKEN TIMES STRUCK THROUGH, NOT HIDDEN
                    return (
                      <div
                        key={slot.startsAt}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-xs font-medium text-muted-foreground/60 select-none cursor-not-allowed"
                        title={slot.taken ? "Already booked by another patient" : "Unavailable"}
                      >
                        <span className="line-through">{slot.time}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                          {slot.taken ? "Taken" : "Past"}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      className={`flex items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "border-brand-green bg-brand-green text-white shadow-xs scale-[1.02]"
                          : "border-border bg-card text-foreground hover:border-brand-green/60 hover:bg-muted/30"
                      }`}
                    >
                      <span>{slot.time}</span>
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          isSelected ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Continue button */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => updateUrl({ step: "doctor" })}
              className="text-xs font-bold"
            >
              Back
            </Button>
            <Button
              disabled={!selectedSlot}
              onClick={handleContinueToDetails}
              className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-2 px-5"
            >
              <span>Continue to Your Details</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: YOUR DETAILS ================= */}
      {step === "details" && (
        <form onSubmit={handleContinueToConfirm} className="space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Patient Information
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Enter your contact details so the hospital can confirm your appointment.
            </p>
          </div>

          <Card className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
            {session?.user && (
              <div className="rounded-xl bg-brand-green/10 border border-brand-green/20 p-3 text-xs text-brand-green font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Signed in as <strong>{session.user.name}</strong> ({session.user.email}). Details auto-filled below.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="patientName" className="text-xs font-bold">
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="patientName"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Fatima Mohammed"
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="patientPhone" className="text-xs font-bold">
                  Nigerian Phone Number <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="patientPhone"
                    required
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="08012345678"
                    className="pl-9 text-xs"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Used for SMS confirmation and appointment reminders.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patientEmail" className="text-xs font-bold">
                Email Address (Optional)
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="patientEmail"
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="fatima@example.com"
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-xs font-bold">
                Reason for Visit / Note (Optional)
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Routine consultation, follow-up, general check"
                className="text-xs"
              />
              <span className="text-[10px] text-muted-foreground">
                Never include sensitive clinical secrets. Brief description only.
              </span>
            </div>

            {submitError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => updateUrl({ step: "datetime" })}
              className="text-xs font-bold"
            >
              Back
            </Button>
            <Button
              type="submit"
              className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-2 px-5"
            >
              <span>Review & Confirm</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {/* ================= STEP 4: REVIEW & CONFIRM ================= */}
      {step === "confirm" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Confirm Your Appointment
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Please review your appointment summary below before booking.
            </p>
          </div>

          {/* Collision Error Alert with Friendly Alternative Slots */}
          {collisionError && (
            <div className="rounded-2xl border-2 border-amber-500/80 bg-amber-500/10 dark:bg-amber-950/30 p-5 space-y-3.5 shadow-sm animate-in fade-in">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {collisionError.message}
                  </h3>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Another patient selected this slot at the same second. Click any alternative time below to lock it in:
                  </p>
                </div>
              </div>

              {collisionError.nextSlots.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {collisionError.nextSlots.map((alt) => (
                    <Button
                      key={alt.startsAt}
                      type="button"
                      size="sm"
                      onClick={() => handleSelectAlternativeSlot(alt)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>{alt.dateStr} at {alt.time}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Booking Summary Card */}
          <Card className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2">
              Appointment Summary
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl bg-muted/40 p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Doctor</span>
                <p className="font-bold text-foreground text-sm">
                  {selectedDoctor?.fullName}
                </p>
                <p className="text-xs text-brand-green font-medium">
                  {selectedDoctor?.specialty}
                </p>
              </div>

              <div className="rounded-xl bg-muted/40 p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Time (WAT)</span>
                <p className="font-bold text-foreground text-sm">
                  {timeParam}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dateParam}
                </p>
              </div>

              <div className="rounded-xl bg-muted/40 p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Patient</span>
                <p className="font-bold text-foreground text-sm">{patientName}</p>
                <p className="text-xs text-muted-foreground">{patientPhone}</p>
                {patientEmail && <p className="text-xs text-muted-foreground">{patientEmail}</p>}
              </div>

              <div className="rounded-xl bg-muted/40 p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">Location</span>
                <p className="font-bold text-foreground text-sm">Garden City Specialist Hospital</p>
                <p className="text-xs text-muted-foreground">Kaduna, Nigeria</p>
              </div>
            </div>

            {reason && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                <span className="font-bold text-muted-foreground">Reason for visit: </span>
                <span className="text-foreground">{reason}</span>
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => updateUrl({ step: "details" })}
              className="text-xs font-bold"
            >
              Back
            </Button>
            <Button
              disabled={submitting}
              onClick={handleConfirmBooking}
              className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-2 px-6 h-10 shadow-xs"
            >
              {submitting ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" />
                  <span>Securing Slot...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                  <span>Confirm Booking</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
