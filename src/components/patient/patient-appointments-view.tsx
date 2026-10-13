"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  PlusCircle,
  Stethoscope,
  Phone,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatLagosTime, SlotInfo } from "@/lib/appointments/types";

interface PatientAppointment {
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
  createdAt: string;
}

export function PatientAppointmentsView() {
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel modal state
  const [cancelModalAppointment, setCancelModalAppointment] = useState<PatientAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Reschedule modal state
  const [rescheduleModalAppointment, setRescheduleModalAppointment] = useState<PatientAppointment | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotInfo[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<SlotInfo | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  async function loadAppointments() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/patient/appointments");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load appointments");
      }
      setAppointments(data.appointments || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  // Cancel Handler
  async function handleConfirmCancel() {
    if (!cancelModalAppointment) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/patient/appointments/${cancelModalAppointment.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || "Cancelled by patient via portal" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel appointment");
      }

      setCancelModalAppointment(null);
      setCancelReason("");
      await loadAppointments();
    } catch (err: any) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  // Load available slots for reschedule
  async function loadRescheduleAvailability(doctorId: string, date: string) {
    try {
      setLoadingRescheduleSlots(true);
      setRescheduleError(null);
      const res = await fetch(`/api/appointments/availability?doctorId=${doctorId}&date=${date}`);
      const data = await res.json();
      setRescheduleSlots(data.slots || []);
    } catch (err: any) {
      setRescheduleError(err.message);
    } finally {
      setLoadingRescheduleSlots(false);
    }
  }

  function handleOpenReschedule(app: PatientAppointment) {
    setRescheduleModalAppointment(app);
    setSelectedRescheduleSlot(null);
    setRescheduleError(null);
    // Default to tomorrow
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setRescheduleDate(tomorrow);
    loadRescheduleAvailability(app.doctorId, tomorrow);
  }

  // Confirm Reschedule Handler
  async function handleConfirmReschedule() {
    if (!rescheduleModalAppointment || !selectedRescheduleSlot) return;
    setRescheduling(true);
    setRescheduleError(null);

    try {
      const res = await fetch(`/api/patient/appointments/${rescheduleModalAppointment.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: selectedRescheduleSlot.startsAt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reschedule appointment");
      }

      setRescheduleModalAppointment(null);
      await loadAppointments();
    } catch (err: any) {
      setRescheduleError(err.message);
    } finally {
      setRescheduling(false);
    }
  }

  // Categorize appointments
  const now = new Date();
  const upcoming = appointments.filter(
    (a) => new Date(a.startsAt).getTime() >= now.getTime() && a.status === "booked",
  );
  const pastOrCancelled = appointments.filter(
    (a) => new Date(a.startsAt).getTime() < now.getTime() || a.status !== "booked",
  );

  function getStatusBadge(status: PatientAppointment["status"]) {
    switch (status) {
      case "booked":
        return <Badge className="bg-emerald-500/10 text-emerald-800 border-emerald-500/30 text-[10px] font-bold">CONFIRMED</Badge>;
      case "arrived":
        return <Badge className="bg-blue-500/10 text-blue-800 border-blue-500/30 text-[10px] font-bold">ARRIVED AT CLINIC</Badge>;
      case "in_consultation":
        return <Badge className="bg-purple-500/10 text-purple-800 border-purple-500/30 text-[10px] font-bold">IN CONSULTATION</Badge>;
      case "completed":
        return <Badge className="bg-slate-500/10 text-slate-800 border-slate-500/30 text-[10px] font-bold">COMPLETED</Badge>;
      case "cancelled":
        return <Badge className="bg-rose-500/10 text-rose-800 border-rose-500/30 text-[10px] font-bold">CANCELLED</Badge>;
      case "no_show":
        return <Badge className="bg-amber-500/10 text-amber-800 border-amber-500/30 text-[10px] font-bold">NO SHOW</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            My Appointments
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            View, reschedule, or cancel your consultations at Garden City Specialist Hospital.
          </p>
        </div>

        <Button asChild className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-1.5 shadow-xs w-fit">
          <Link href="/book">
            <PlusCircle className="h-4 w-4" />
            <span>Book New Appointment</span>
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/60 animate-pulse border border-border" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-6 text-center text-xs text-rose-600 font-bold border-rose-500/30">
          {error}
        </Card>
      ) : appointments.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-base font-bold text-foreground">No Appointments Found</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You don&apos;t have any appointments booked yet. Book your first appointment online in just a few clicks.
          </p>
          <Button asChild className="bg-brand-green hover:bg-brand-green/90 text-white font-bold text-xs gap-1.5 mt-2">
            <Link href="/book">
              <PlusCircle className="h-4 w-4" />
              <span>Book Appointment</span>
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Section */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-brand-green" />
              <span>Upcoming Appointments ({upcoming.length})</span>
            </h2>

            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No upcoming appointments.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((app) => {
                  const appointmentDate = new Date(app.startsAt);
                  const isMoreThanTwoHours = appointmentDate.getTime() - now.getTime() >= 2 * 60 * 60 * 1000;

                  return (
                    <Card
                      key={app.id}
                      className="rounded-2xl border-2 border-emerald-500/40 bg-card p-5 space-y-4 shadow-xs hover:border-emerald-500/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-black to-brand-green text-white shadow-2xs">
                            <Stethoscope className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-black text-sm text-foreground truncate">
                              {app.doctorName}
                            </h3>
                            <p className="text-xs font-semibold text-brand-green">
                              {app.specialty}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>

                      <div className="rounded-xl bg-muted/40 p-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Date & Time:</span>
                          <span className="font-bold text-foreground">
                            {new Intl.DateTimeFormat("en-GB", {
                              timeZone: "Africa/Lagos",
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(appointmentDate)} · {formatLagosTime(appointmentDate)}
                          </span>
                        </div>
                        {app.reason && (
                          <div className="flex items-center justify-between pt-1 border-t border-border/40">
                            <span className="text-muted-foreground font-medium">Reason:</span>
                            <span className="text-foreground truncate max-w-[180px]">{app.reason}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons (only allowed > 2 hours before appointment) */}
                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-border/60">
                        {isMoreThanTwoHours ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReschedule(app)}
                              className="text-xs font-bold gap-1 text-foreground"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Reschedule</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCancelModalAppointment(app);
                                setCancelReason("");
                                setCancelError(null);
                              }}
                              className="text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Cancel</span>
                            </Button>
                          </>
                        ) : (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Cannot cancel or reschedule within 2 hours of appointment</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past / Cancelled Section */}
          <section className="space-y-3 pt-4 border-t border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Past & Cancelled Consultations ({pastOrCancelled.length})
            </h2>

            {pastOrCancelled.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No past appointments recorded.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pastOrCancelled.map((app) => {
                  const appointmentDate = new Date(app.startsAt);
                  return (
                    <div
                      key={app.id}
                      className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{app.doctorName}</span>
                        {getStatusBadge(app.status)}
                      </div>
                      <div className="text-muted-foreground">
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Africa/Lagos",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(appointmentDate)} · {formatLagosTime(appointmentDate)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={Boolean(cancelModalAppointment)} onOpenChange={(open) => !open && setCancelModalAppointment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Cancel Appointment?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Are you sure you want to cancel your consultation with{" "}
              <strong>{cancelModalAppointment?.doctorName}</strong>?
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="cancelReason" className="text-xs font-bold">
                Reason for Cancellation (Optional)
              </Label>
              <Input
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Schedule clash, feeling better"
                className="text-xs"
              />
            </div>

            {cancelError && (
              <div className="rounded-lg bg-rose-50 text-rose-700 p-2 text-xs font-bold">
                {cancelError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalAppointment(null)}
              className="text-xs"
            >
              Keep Appointment
            </Button>
            <Button
              size="sm"
              disabled={cancelling}
              onClick={handleConfirmCancel}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              {cancelling ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={Boolean(rescheduleModalAppointment)} onOpenChange={(open) => !open && setRescheduleModalAppointment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Reschedule Appointment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-muted-foreground">
              Select a new date and available time slot for{" "}
              <strong>{rescheduleModalAppointment?.doctorName}</strong>.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="reschedDate" className="text-xs font-bold">
                Target Date
              </Label>
              <Input
                id="reschedDate"
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  setSelectedRescheduleSlot(null);
                  if (rescheduleModalAppointment) {
                    loadRescheduleAvailability(rescheduleModalAppointment.doctorId, e.target.value);
                  }
                }}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Available Slots</Label>
              {loadingRescheduleSlots ? (
                <div className="h-20 bg-muted/50 rounded-xl animate-pulse" />
              ) : rescheduleSlots.filter((s) => s.available).length === 0 ? (
                <p className="text-muted-foreground italic">No slots available on this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                  {rescheduleSlots.filter((s) => s.available).map((slot) => {
                    const isSelected = selectedRescheduleSlot?.startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => setSelectedRescheduleSlot(slot)}
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

            {rescheduleError && (
              <div className="rounded-lg bg-rose-50 text-rose-700 p-2 text-xs font-bold">
                {rescheduleError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleModalAppointment(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedRescheduleSlot || rescheduling}
              onClick={handleConfirmReschedule}
              className="bg-brand-green hover:bg-brand-green/90 text-white text-xs font-bold"
            >
              {rescheduling ? "Updating..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
