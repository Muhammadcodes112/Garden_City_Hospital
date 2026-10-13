"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Globe,
  Building2,
  Stethoscope,
  Phone,
  Search,
  Filter,
  Users,
  MoreVertical,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatLagosTime, getLagosDateString, SlotInfo } from "@/lib/appointments/types";

interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  slotMinutes: number;
}

interface StaffAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string | null;
  doctorId: string;
  doctorName: string;
  specialty: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "arrived" | "in_consultation" | "completed" | "cancelled" | "no_show";
  reason?: string | null;
  note?: string | null;
  bookedBy: "patient" | "staff";
  bookedByUserId?: string | null;
  createdAt: string;
}

export function StaffAppointmentsGrid() {
  const [selectedDate, setSelectedDate] = useState<string>(getLagosDateString());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Front-Desk Booking Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDoctorId, setNewDoctorId] = useState("");
  const [newDate, setNewDate] = useState(getLagosDateString());
  const [newSlotStartsAt, setNewSlotStartsAt] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientEmail, setNewPatientEmail] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newNote, setNewNote] = useState("");
  const [availableSlotsForBooking, setAvailableSlotsForBooking] = useState<SlotInfo[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Status Change State
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Reschedule Modal State
  const [rescheduleModalApp, setRescheduleModalApp] = useState<StaffAppointment | null>(null);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedSlots, setReschedSlots] = useState<SlotInfo[]>([]);
  const [selectedReschedSlot, setSelectedReschedSlot] = useState<SlotInfo | null>(null);
  const [loadingReschedSlots, setLoadingReschedSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [reschedError, setReschedError] = useState<string | null>(null);

  // Load doctors catalog
  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await fetch("/api/appointments/doctors");
        const data = await res.json();
        if (data.doctors) setDoctors(data.doctors);
      } catch (err) {
        console.error("Failed to load doctors:", err);
      }
    }
    loadDoctors();
  }, []);

  // Load appointments for selected date and doctor
  async function loadAppointments() {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/staff/appointments?date=${selectedDate}${
        selectedDoctorId !== "all" ? `&doctorId=${selectedDoctorId}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load appointments");
      setAppointments(data.appointments || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, [selectedDate, selectedDoctorId]);

  // Day navigation helpers
  function navigateDay(offset: number) {
    const current = new Date(`${selectedDate}T12:00:00+01:00`);
    current.setUTCDate(current.getUTCDate() + offset);
    setSelectedDate(getLagosDateString(current));
  }

  // Load available slots when creating appointment
  async function loadBookingSlots(docId: string, date: string) {
    if (!docId || !date) return;
    try {
      setLoadingSlots(true);
      const res = await fetch(`/api/appointments/availability?doctorId=${docId}&date=${date}`);
      const data = await res.json();
      setAvailableSlotsForBooking(data.slots || []);
    } catch (err) {
      console.error("Failed to load slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  }

  // Open Create Modal
  function handleOpenCreateModal() {
    setCreateModalOpen(true);
    setCreateError(null);
    setNewDate(selectedDate);
    const defaultDoc = doctors[0]?.id || "";
    setNewDoctorId(defaultDoc);
    setNewSlotStartsAt("");
    setNewPatientName("");
    setNewPatientPhone("");
    setNewPatientEmail("");
    setNewReason("");
    setNewNote("");
    if (defaultDoc) loadBookingSlots(defaultDoc, selectedDate);
  }

  // Submit Front-Desk Booking
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDoctorId || !newSlotStartsAt || !newPatientName.trim() || !newPatientPhone.trim()) {
      setCreateError("Doctor, slot time, patient name, and phone are required.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/staff/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: newDoctorId,
          startsAt: newSlotStartsAt,
          patientName: newPatientName.trim(),
          patientPhone: newPatientPhone.trim(),
          patientEmail: newPatientEmail.trim() || null,
          reason: newReason.trim() || null,
          note: newNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create appointment");
      }

      setCreateModalOpen(false);
      await loadAppointments();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  // Quick Status Transition
  async function handleUpdateStatus(
    appointmentId: string,
    status: StaffAppointment["status"],
  ) {
    setUpdatingId(appointmentId);
    try {
      const res = await fetch(`/api/staff/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      await loadAppointments();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  // Open Reschedule Modal
  function handleOpenReschedule(app: StaffAppointment) {
    setRescheduleModalApp(app);
    setSelectedReschedSlot(null);
    setReschedError(null);
    setReschedDate(selectedDate);
    loadRescheduleSlots(app.doctorId, selectedDate);
  }

  async function loadRescheduleSlots(docId: string, date: string) {
    try {
      setLoadingReschedSlots(true);
      const res = await fetch(`/api/appointments/availability?doctorId=${docId}&date=${date}`);
      const data = await res.json();
      setReschedSlots(data.slots || []);
    } catch (err: any) {
      setReschedError(err.message);
    } finally {
      setLoadingReschedSlots(false);
    }
  }

  // Confirm Reschedule
  async function handleConfirmReschedule() {
    if (!rescheduleModalApp || !selectedReschedSlot) return;
    setRescheduling(true);
    setReschedError(null);

    try {
      const res = await fetch(`/api/staff/appointments/${rescheduleModalApp.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: selectedReschedSlot.startsAt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reschedule appointment");

      setRescheduleModalApp(null);
      await loadAppointments();
    } catch (err: any) {
      setReschedError(err.message);
    } finally {
      setRescheduling(false);
    }
  }

  // Counts
  const onlineCount = appointments.filter((a) => a.bookedBy === "patient").length;
  const deskCount = appointments.filter((a) => a.bookedBy === "staff").length;
  const arrivedCount = appointments.filter((a) => a.status === "arrived" || a.status === "in_consultation").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Appointments Day Grid
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage patient-booked and front-desk consultations in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleOpenCreateModal}
            className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-1.5 shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Book Front Desk Walk-In</span>
          </Button>
        </div>
      </div>

      {/* Date Navigation & Doctor Filter Bar */}
      <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Day Navigation */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between sm:justify-start">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDay(-1)}
              className="h-8 w-8 text-foreground"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 text-xs font-bold w-36"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(getLagosDateString())}
                className="h-8 text-xs font-bold text-brand-green hover:bg-brand-green/10"
              >
                Today
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDay(1)}
              className="h-8 w-8 text-foreground"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Doctor Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Label htmlFor="docFilter" className="text-xs font-bold text-muted-foreground shrink-0">
              Doctor:
            </Label>
            <select
              id="docFilter"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="h-8 text-xs font-bold rounded-lg border border-border bg-background px-3 text-foreground w-full md:w-60 focus:outline-hidden focus:ring-1 focus:ring-brand-green"
            >
              <option value="all">All Specialists ({doctors.length})</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.specialty})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60">
          <div className="rounded-xl bg-slate-50 dark:bg-muted/30 p-2.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Today
            </span>
            <span className="text-base font-black text-foreground">{appointments.length}</span>
          </div>

          <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 p-2.5 text-center border border-blue-200/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
              In Clinic / Arrived
            </span>
            <span className="text-base font-black text-blue-900 dark:text-blue-300">{arrivedCount}</span>
          </div>

          <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 text-center border border-emerald-200/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              Completed
            </span>
            <span className="text-base font-black text-emerald-900 dark:text-emerald-300">{completedCount}</span>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-muted/30 p-2.5 text-center flex items-center justify-around">
            <div>
              <span className="text-[9px] font-bold text-muted-foreground block">ONLINE</span>
              <span className="text-xs font-black text-teal-700">{onlineCount}</span>
            </div>
            <div className="h-6 w-px bg-border" />
            <div>
              <span className="text-[9px] font-bold text-muted-foreground block">FRONT DESK</span>
              <span className="text-xs font-black text-amber-700">{deskCount}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Appointments Day Grid Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse border border-border" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-base font-bold text-foreground">
            No Appointments for {selectedDate}
          </h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            There are no patient bookings or front-desk appointments scheduled for this date.
          </p>
          <Button
            onClick={handleOpenCreateModal}
            className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-1.5 mt-2"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Book Walk-In Appointment</span>
          </Button>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-xs min-w-[840px]">
            <thead className="border-b border-border bg-muted/40 font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
              <tr>
                <th className="py-3 px-4 min-w-[100px]">TIME (WAT)</th>
                <th className="py-3 px-4 min-w-[200px]">PATIENT</th>
                <th className="py-3 px-4 min-w-[180px]">DOCTOR</th>
                <th className="py-3 px-4 min-w-[140px]">SOURCE</th>
                <th className="py-3 px-4 min-w-[130px]">STATUS</th>
                <th className="py-3 px-4 text-right min-w-[180px]">STAFF ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointments.map((app) => {
                const startTime = new Date(app.startsAt);

                return (
                  <tr key={app.id} className="transition-colors hover:bg-muted/30">
                    {/* Time */}
                    <td className="py-3.5 px-4 font-bold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-brand-green shrink-0" />
                        <span>{formatLagosTime(startTime)}</span>
                      </div>
                    </td>

                    {/* Patient */}
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-bold text-foreground text-xs">{app.patientName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3 w-3" />
                          <span>{app.patientPhone}</span>
                        </div>
                        {app.reason && (
                          <div className="text-[10px] text-muted-foreground italic truncate max-w-[200px] mt-0.5">
                            Note: {app.reason}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Doctor */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-foreground text-xs">{app.doctorName}</div>
                      <div className="text-[11px] text-brand-green font-medium">{app.specialty}</div>
                    </td>

                    {/* Booking Source Marker */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {app.bookedBy === "patient" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/30 text-[10px] font-bold">
                          <Globe className="h-3 w-3 text-teal-600" />
                          <span>Patient Online</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          <Building2 className="h-3 w-3 text-amber-600" />
                          <span>Front Desk</span>
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {app.status === "booked" && (
                        <Badge className="bg-amber-500/10 text-amber-800 border-amber-500/30 text-[10px] font-bold">
                          BOOKED
                        </Badge>
                      )}
                      {app.status === "arrived" && (
                        <Badge className="bg-blue-500/10 text-blue-800 border-blue-500/30 text-[10px] font-bold">
                          ARRIVED
                        </Badge>
                      )}
                      {app.status === "in_consultation" && (
                        <Badge className="bg-purple-500/10 text-purple-800 border-purple-500/30 text-[10px] font-bold">
                          IN CONSULT
                        </Badge>
                      )}
                      {app.status === "completed" && (
                        <Badge className="bg-emerald-500/10 text-emerald-800 border-emerald-500/30 text-[10px] font-bold">
                          COMPLETED
                        </Badge>
                      )}
                      {app.status === "cancelled" && (
                        <Badge className="bg-rose-500/10 text-rose-800 border-rose-500/30 text-[10px] font-bold">
                          CANCELLED
                        </Badge>
                      )}
                      {app.status === "no_show" && (
                        <Badge className="bg-slate-500/10 text-slate-800 border-slate-500/30 text-[10px] font-bold">
                          NO SHOW
                        </Badge>
                      )}
                    </td>

                    {/* Staff Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {app.status === "booked" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(app.id, "arrived")}
                            disabled={updatingId === app.id}
                            className="h-7 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                          >
                            Mark Arrived
                          </Button>
                        )}

                        {app.status === "arrived" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(app.id, "in_consultation")}
                            disabled={updatingId === app.id}
                            className="h-7 text-[11px] font-bold text-purple-700 hover:bg-purple-50"
                          >
                            In Consultation
                          </Button>
                        )}

                        {app.status === "in_consultation" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(app.id, "completed")}
                            disabled={updatingId === app.id}
                            className="h-7 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                          >
                            Complete
                          </Button>
                        )}

                        {app.status !== "completed" && app.status !== "cancelled" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenReschedule(app)}
                              className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                            >
                              Reschedule
                            </Button>

                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleUpdateStatus(app.id, e.target.value as any);
                                  e.target.value = "";
                                }
                              }}
                              className="h-7 text-[10px] font-bold rounded-md border border-border bg-background px-1.5 text-muted-foreground cursor-pointer"
                              defaultValue=""
                            >
                              <option value="" disabled>More</option>
                              <option value="no_show">Mark No-Show</option>
                              <option value="cancelled">Cancel</option>
                            </select>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Front-Desk Walk-In Booking Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Book Front-Desk Appointment (Walk-In)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateAppointment} className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="docSelect" className="text-xs font-bold">
                  Doctor <span className="text-rose-500">*</span>
                </Label>
                <select
                  id="docSelect"
                  required
                  value={newDoctorId}
                  onChange={(e) => {
                    setNewDoctorId(e.target.value);
                    setNewSlotStartsAt("");
                    loadBookingSlots(e.target.value, newDate);
                  }}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dateSelect" className="text-xs font-bold">
                  Appointment Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="dateSelect"
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    setNewSlotStartsAt("");
                    loadBookingSlots(newDoctorId, e.target.value);
                  }}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Slot Picker */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">
                Available Time Slot <span className="text-rose-500">*</span>
              </Label>
              {loadingSlots ? (
                <div className="h-16 bg-muted/60 rounded-xl animate-pulse" />
              ) : availableSlotsForBooking.filter((s) => s.available).length === 0 ? (
                <p className="text-muted-foreground italic text-xs">
                  No available slots on this date for the selected doctor.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 border rounded-xl">
                  {availableSlotsForBooking
                    .filter((s) => s.available)
                    .map((slot) => {
                      const isSelected = newSlotStartsAt === slot.startsAt;
                      return (
                        <button
                          key={slot.startsAt}
                          type="button"
                          onClick={() => setNewSlotStartsAt(slot.startsAt)}
                          className={`rounded-lg p-2 text-xs font-bold border transition-all text-center cursor-pointer ${
                            isSelected
                              ? "bg-brand-green text-white border-brand-green"
                              : "bg-card border-border hover:border-brand-green/60 text-foreground"
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pName" className="text-xs font-bold">
                  Patient Full Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="pName"
                  required
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="Walk-in patient name"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pPhone" className="text-xs font-bold">
                  Patient Phone Number <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="pPhone"
                  required
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                  placeholder="080 1234 5678"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pEmail" className="text-xs font-bold">
                Patient Email (Optional)
              </Label>
              <Input
                id="pEmail"
                type="email"
                value={newPatientEmail}
                onChange={(e) => setNewPatientEmail(e.target.value)}
                placeholder="patient@example.com"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pReason" className="text-xs font-bold">
                Reason for Consultation (Optional)
              </Label>
              <Input
                id="pReason"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Hypertension check, fever"
                className="h-9 text-xs"
              />
            </div>

            {createError && (
              <div className="rounded-lg bg-rose-50 text-rose-700 p-2.5 text-xs font-bold">
                {createError}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating || !newSlotStartsAt}
                className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs"
              >
                {creating ? "Booking..." : "Confirm Walk-In Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog open={Boolean(rescheduleModalApp)} onOpenChange={(open) => !open && setRescheduleModalApp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Reschedule Appointment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <p className="text-muted-foreground">
              Rescheduling appointment for <strong>{rescheduleModalApp?.patientName}</strong> with{" "}
              <strong>{rescheduleModalApp?.doctorName}</strong>.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="reschedD" className="text-xs font-bold">
                Date
              </Label>
              <Input
                id="reschedD"
                type="date"
                value={reschedDate}
                onChange={(e) => {
                  setReschedDate(e.target.value);
                  setSelectedReschedSlot(null);
                  if (rescheduleModalApp) {
                    loadRescheduleSlots(rescheduleModalApp.doctorId, e.target.value);
                  }
                }}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Available Slots</Label>
              {loadingReschedSlots ? (
                <div className="h-16 bg-muted/60 rounded-xl animate-pulse" />
              ) : reschedSlots.filter((s) => s.available).length === 0 ? (
                <p className="text-muted-foreground italic text-xs">No slots available on this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 border rounded-xl">
                  {reschedSlots.filter((s) => s.available).map((slot) => {
                    const isSelected = selectedReschedSlot?.startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => setSelectedReschedSlot(slot)}
                        className={`rounded-lg p-2 text-xs font-bold border transition-all text-center cursor-pointer ${
                          isSelected
                            ? "bg-brand-green text-white border-brand-green"
                            : "bg-card border-border hover:border-brand-green/60 text-foreground"
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {reschedError && (
              <div className="rounded-lg bg-rose-50 text-rose-700 p-2.5 text-xs font-bold">
                {reschedError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleModalApp(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedReschedSlot || rescheduling}
              onClick={handleConfirmReschedule}
              className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs"
            >
              {rescheduling ? "Updating..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
