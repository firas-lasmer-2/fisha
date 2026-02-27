import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TherapistSlot } from "@shared/schema";

const HOUR_LABELS = Array.from({ length: 14 }, (_, i) => `${(i + 7).toString().padStart(2, "0")}:00`); // 07:00–20:00
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isoAt(date: Date, hour: number): string {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function slotHour(slot: TherapistSlot): number {
  return new Date(slot.startsAt).getHours();
}

function slotDate(slot: TherapistSlot): string {
  return new Date(slot.startsAt).toDateString();
}

function slotColor(slot: TherapistSlot): string {
  if (slot.status === "booked") return "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30";
  if (slot.status === "cancelled") return "bg-muted/50 border-muted-foreground/20 text-muted-foreground line-through";
  return "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30";
}

interface SlotCalendarProps {
  slots: TherapistSlot[];
  therapistId: string;
  defaultPriceDinar?: number;
  defaultDurationMinutes?: number;
  invalidateKey?: unknown[];
}

export function SlotCalendar({
  slots,
  therapistId,
  defaultPriceDinar = 20,
  defaultDurationMinutes = 50,
  invalidateKey,
}: SlotCalendarProps) {
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ date: Date; hour: number } | null>(null);
  const [duration, setDuration] = useState(defaultDurationMinutes);
  const [price, setPrice] = useState(defaultPriceDinar);
  const [recurWeeks, setRecurWeeks] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = useMemo(() => new Date(), []);
  const referenceDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + weekOffset * 7);
    return d;
  }, [today, weekOffset]);

  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);

  const slotsByCell = useMemo(() => {
    const map: Record<string, TherapistSlot[]> = {};
    for (const slot of slots) {
      const d = new Date(slot.startsAt);
      const key = `${d.toDateString()}_${d.getHours()}`;
      if (!map[key]) map[key] = [];
      map[key].push(slot);
    }
    return map;
  }, [slots]);

  const openDialog = (date: Date, hour: number) => {
    const dt = new Date(date);
    dt.setHours(hour);
    if (dt < new Date()) return; // past cells ignored
    setSelectedCell({ date, hour });
    setIsRecurring(false);
    setRecurWeeks(1);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedCell) return;
    setIsSubmitting(true);

    const slotsToCreate = Array.from({ length: isRecurring ? recurWeeks : 1 }, (_, i) => {
      const d = new Date(selectedCell.date);
      d.setDate(d.getDate() + i * 7);
      return {
        startsAt: isoAt(d, selectedCell.hour),
        durationMinutes: duration,
        priceDinar: price,
      };
    });

    try {
      if (slotsToCreate.length === 1) {
        await apiRequest("POST", "/api/therapist/slots", slotsToCreate[0]);
      } else {
        await apiRequest("POST", "/api/therapist/slots/batch", { slots: slotsToCreate });
      }
      const key = invalidateKey ?? ["/api/therapists", therapistId, "slots"];
      queryClient.invalidateQueries({ queryKey: key });
      toast({ title: `${slotsToCreate.length} slot(s) created` });
      setDialogOpen(false);
    } catch {
      toast({ title: "Failed to create slots", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (slotId: number) => {
    try {
      await apiRequest("DELETE", `/api/therapist/slots/${slotId}`);
      const key = invalidateKey ?? ["/api/therapists", therapistId, "slots"];
      queryClient.invalidateQueries({ queryKey: key });
      toast({ title: "Slot cancelled" });
    } catch {
      toast({ title: "Failed to cancel slot", variant: "destructive" });
    }
  };

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [weekDates]);

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{weekLabel}</span>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300 inline-block" /> Open</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-300 inline-block" /> Booked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted border inline-block" /> Cancelled</span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px text-xs font-medium text-center">
            <div />
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              return (
                <div key={i} className={`pb-1.5 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {DAY_LABELS[i]}
                  <br />
                  {d.getDate()}
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          <div className="border rounded-lg overflow-hidden">
            {HOUR_LABELS.map((label, hi) => {
              const hour = hi + 7;
              return (
                <div
                  key={label}
                  className="grid grid-cols-[60px_repeat(7,1fr)] gap-px border-b last:border-b-0"
                >
                  <div className="text-xs text-muted-foreground text-right pr-2 py-1 leading-none pt-1.5">
                    {label}
                  </div>
                  {weekDates.map((d, di) => {
                    const key = `${d.toDateString()}_${hour}`;
                    const cellSlots = slotsByCell[key] ?? [];
                    const isPast = new Date(d).setHours(hour) < Date.now();

                    return (
                      <div
                        key={di}
                        className={`min-h-[40px] p-0.5 relative group ${!isPast ? "cursor-pointer hover:bg-muted/40" : "opacity-40"}`}
                        onClick={() => !isPast && cellSlots.length === 0 && openDialog(d, hour)}
                      >
                        {cellSlots.map((slot) => (
                          <div
                            key={slot.id}
                            className={`text-[10px] rounded border px-1 py-0.5 leading-tight mb-0.5 ${slotColor(slot)}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>{slot.priceDinar}د.ت</span>
                            {slot.status === "open" && (
                              <button
                                className="ms-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                onClick={() => handleCancel(slot.id)}
                                title="Cancel slot"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        {!isPast && cellSlots.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Create slot dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Slot</DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                {selectedCell.date.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })} at{" "}
                {String(selectedCell.hour).padStart(2, "0")}:00
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Duration (min)</label>
                  <Input
                    type="number"
                    min={15}
                    max={180}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Price (TND)</label>
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="accent-primary"
                  />
                  <label htmlFor="recurring" className="text-sm font-medium flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5" />
                    Repeat weekly
                  </label>
                </div>
                {isRecurring && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground shrink-0">for</label>
                    <Input
                      type="number"
                      min={2}
                      max={12}
                      value={recurWeeks}
                      onChange={(e) => setRecurWeeks(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">weeks</span>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Creating..."
                  : isRecurring
                  ? `Create ${recurWeeks} slots`
                  : "Create slot"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
