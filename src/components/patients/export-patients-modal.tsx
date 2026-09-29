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
import { Download, Calendar, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExportPatientsModal({ open, onOpenChange }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportType, setExportType] = useState("all");
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("type", exportType);

      const downloadUrl = `/api/patients/export?${params.toString()}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `GardenCity_Export_${startDate || "all"}_to_${endDate || "present"}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Export generated successfully!");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Export Hospital Records
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs pt-2">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Select a date range to generate and download a complete spreadsheet of patient case files and medical history.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Export Category</Label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
            >
              <option value="all">All Patient Case Files &amp; Records</option>
              <option value="outpatient">Outpatients Only</option>
              <option value="inpatient">Inpatients / Admitted Only</option>
              <option value="discharged">Discharged Patients Only</option>
            </select>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground border border-border flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-green shrink-0" />
            <span>
              {startDate && endDate
                ? `Exporting records from ${startDate} to ${endDate}`
                : "Exporting all time records"}
            </span>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={exporting}
              onClick={handleExport}
              className="bg-brand-green hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Generate &amp; Download CSV
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
