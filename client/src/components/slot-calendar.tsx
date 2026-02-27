import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Repeat, CalendarCheck, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TherapistSlot } from "@shared/schema";

// 07:00 – 21:00
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
const HOUR_LABELS = HOURS.map((h) => `${String(h).padStart(2, "0")}:00`);

const DURATION_PRESETS = [
  { label: "30 min", value: 30 },
  { label: "50 min", value: 50 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
];

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

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function endHour(slot: TherapistSlot): string {
  const start = new Date(slot.startsAt);
  const end = new Date(start.getTime() + slot.durationMinutes * 60000);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

function slotColor(slot: TherapistSlot): string {
  if (slot.status === "booked")
    return "bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-200";
  if (slot.status === "cancelled")
    return "bg-muted/40 border-muted-foreground/20 text-muted-foreground line-through";
  return "bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-600 dark:text-emerald-200";
}

// How many grid rows a slot spans (capped at remaining hours in the day)
function slotSpan(slot: TherapistSlot, startHour: number, maxHour: number): number {
  const spans = Math.ceil(slot.durationMinutes / 60);
  const remaining = maxHour - startHour;
  return Math.min(spans, remaining);
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
  const { t } = useI18n();
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailSlot, setDetailSlot] = useState<TherapistSlot | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ date: Date; hour: number } | null>(null);
  const [duration, setDuration] = useState(defaultDurationMinutes);
  const [price, setPrice] = useState(defaultPriceDinar);
  const [recurWeeks, setRecurWeeks] = useState(4);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const today = useMemo(() => new Date(), []);
  const referenceDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + weekOffset * 7);
    return d;
  }, [today, weekOffset]);

  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);

  // Map: "dateString_hour" → slots starting in that cell
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

  // Cells occupied by multi-hour slots (so we can mark them as taken)
  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      if (slot.status === "cancelled") continue;
      const start = new Date(slot.startsAt);
      const spans = Math.ceil(slot.durationMinutes / 60);
      for (let i = 0; i < spans; i++) {
        const h = start.getHours() + i;
        set.add(`${start.toDateString()}_${h}`);
      }
    }
    return set;
  }, [slots]);

  // Weekly stats
  const weekStats = useMemo(() => {
    const weekDateStrings = new Set(weekDates.map((d) => d.toDateString()));
    let open = 0, booked = 0;
    for (const slot of slots) {
      const ds = new Date(slot.startsAt).toDateString();
      if (!weekDateStrings.has(ds)) continue;
      if (slot.status === "open") open++;
      else if (slot.status === "booked") booked++;
    }
    return { open, booked };
  }, [slots, weekDates]);

  const openCreateDialog = (date: Date, hour: number) => {
    const dt = new Date(date);
    dt.setHours(hour, 0, 0, 0);
    if (dt < new Date()) return;
    setSelectedCell({ date, hour });
    setDuration(defaultDurationMinutes);
    setPrice(defaultPriceDinar);
    setIsRecurring(false);
    setRecurWeeks(4);
    setDetailSlot(null);
    setDialogOpen(true);
  };

  const openDetailDialog = (slot: TherapistSlot) => {
    setDetailSlot(slot);
    setSelectedCell(null);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedCell) return;
    setIsSubmitting(true);
    const weeks = isRecurring ? Math.max(2, recurWeeks) : 1;
    const slotsToCreate = Array.from({ length: weeks }, (_, i) => {
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
      queryClient.invalidateQueries({ queryKey: invalidateKey ?? ["/api/therapists", therapistId, "slots"] });
      toast({
        title: isRecurring
          ? `${weeks} créneaux créés avec succès`
          : t("slots.published_success"),
      });
      setDialogOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (slotId: number) => {
    setCancellingId(slotId);
    try {
      await apiRequest("DELETE", `/api/therapist/slots/${slotId}`);
      queryClient.invalidateQueries({ queryKey: invalidateKey ?? ["/api/therapists", therapistId, "slots"] });
      toast({ title: t("slots.cancelled_success") });
      setDialogOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString("fr", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("fr", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [weekDates]);

  const isCurrentWeek = weekOffset === 0;

  // Computed end time string for the create dialog
  const dialogEndTime = selectedCell
    ? (() => {
        const end = new Date(selectedCell.date);
        end.setHours(selectedCell.hour, 0, 0, 0);
        end.setMinutes(duration);
        return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
      })()
    : null;

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-primary">
              Aujourd'hui
            </Button>
          )}
        </div>
        <span className="text-sm font-semibold">{weekLabel}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-400 inline-block" />
            {weekStats.open} libre{weekStats.open !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-200 border border-blue-400 inline-block" />
            {weekStats.booked} réservé{weekStats.booked !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground italic">
        Cliquez sur une cellule vide pour créer un créneau. Cochez l'option récurrence pour répéter chaque semaine.
      </p>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[640px]">
          {/* Header row */}
          <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b bg-muted/30">
            <div className="py-2" />
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              return (
                <div
                  key={i}
                  className={`py-2 text-center text-xs font-medium border-l border-muted/40 ${
                    isToday
                      ? "text-primary font-bold"
                      : isPast
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground"
                  }`}
                >
                  {d.toLocaleDateString("fr", { weekday: "short" })}
                  <br />
                  <span className={`${isToday ? "bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[11px]" : ""}`}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map((hour, hi) => (
            <div
              key={hour}
              className="grid grid-cols-[52px_repeat(7,1fr)] border-b last:border-b-0"
            >
              {/* Time label */}
              <div className="text-[11px] text-muted-foreground text-right pr-2 pt-1.5 leading-none select-none">
                {HOUR_LABELS[hi]}
              </div>

              {weekDates.map((d, di) => {
                const key = `${d.toDateString()}_${hour}`;
                const cellSlots = slotsByCell[key] ?? [];
                const isOccupied = occupiedCells.has(key) && cellSlots.length === 0; // occupied by a multi-hour slot started earlier
                const isPast = new Date(d).setHours(hour + 1) < Date.now();
                const isToday = d.toDateString() === today.toDateString();
                const canCreate = !isPast && !isOccupied && cellSlots.length === 0;

                return (
                  <div
                    key={di}
                    className={`min-h-[48px] p-0.5 relative group border-l border-muted/30 transition-colors ${
                      isToday ? "bg-primary/[0.03]" : ""
                    } ${
                      canCreate
                        ? "cursor-pointer hover:bg-primary/8"
                        : isPast
                        ? "opacity-35 cursor-not-allowed"
                        : isOccupied
                        ? "bg-muted/20"
                        : ""
                    }`}
                    onClick={() => canCreate && openCreateDialog(d, hour)}
                  >
                    {/* Slots starting in this cell */}
                    {cellSlots.map((slot) => {
                      const span = slotSpan(slot, hour, 22);
                      return (
                        <div
                          key={slot.id}
                          className={`text-[10px] rounded border px-1 py-0.5 leading-tight mb-0.5 cursor-pointer select-none ${slotColor(slot)}`}
                          style={{ minHeight: span > 1 ? `${span * 44}px` : undefined }}
                          onClick={(e) => { e.stopPropagation(); openDetailDialog(slot); }}
                          title={`${formatHour(hour)} – ${endHour(slot)} · ${slot.priceDinar} TND`}
                        >
                          <div className="font-medium">{formatHour(hour)}–{endHour(slot)}</div>
                          <div className="opacity-80">{slot.priceDinar} TND</div>
                        </div>
                      );
                    })}

                    {/* + hover indicator for empty cells */}
                    {canCreate && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
                        <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
                          <span className="text-primary text-sm leading-none font-bold">+</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Create slot dialog */}
      <Dialog
        open={dialogOpen && !!selectedCell}
        onOpenChange={(open) => {
          if (!open) { setDialogOpen(false); setSelectedCell(null); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Nouveau créneau
            </DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-4">
              {/* Date/time summary */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold capitalize">
                  {selectedCell.date.toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatHour(selectedCell.hour)} → {dialogEndTime}
                  <span className="ms-2 text-muted-foreground/60">({duration} min)</span>
                </p>
              </div>

              {/* Duration presets + custom */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Durée</label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((p) => (
                    <Button
                      key={p.value}
                      type="button"
                      size="sm"
                      variant={duration === p.value ? "default" : "outline"}
                      onClick={() => setDuration(p.value)}
                    >
                      {p.label}
                    </Button>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={15}
                      max={240}
                      step={5}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-20 h-9"
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Prix (TND)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    step={5}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">TND / séance</span>
                </div>
              </div>

              {/* Recurring */}
              <div className="rounded-lg border p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="accent-primary h-4 w-4 rounded"
                  />
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-primary" />
                    Répéter chaque semaine
                  </span>
                </label>
                {isRecurring && (
                  <div className="space-y-2 ps-6">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground shrink-0">Pendant</label>
                      <Input
                        type="number"
                        min={2}
                        max={52}
                        value={recurWeeks}
                        onChange={(e) => setRecurWeeks(Math.max(2, Number(e.target.value)))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">semaines</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Crée {recurWeeks} créneaux — jusqu'au{" "}
                      {(() => {
                        const end = new Date(selectedCell.date);
                        end.setDate(end.getDate() + (recurWeeks - 1) * 7);
                        return end.toLocaleDateString("fr", { day: "numeric", month: "long" });
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting
                ? "Création..."
                : isRecurring
                ? `Créer ${recurWeeks} créneaux`
                : "Créer le créneau"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot detail dialog */}
      <Dialog
        open={dialogOpen && !!detailSlot}
        onOpenChange={(open) => {
          if (!open) { setDialogOpen(false); setDetailSlot(null); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Détail du créneau
            </DialogTitle>
          </DialogHeader>
          {detailSlot && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold capitalize">
                  {new Date(detailSlot.startsAt).toLocaleDateString("fr", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatHour(new Date(detailSlot.startsAt).getHours())} → {endHour(detailSlot)}
                  <span className="ms-2">({detailSlot.durationMinutes} min)</span>
                </p>
                <p className="text-xs text-muted-foreground">{detailSlot.priceDinar} TND</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    detailSlot.status === "booked"
                      ? "secondary"
                      : detailSlot.status === "cancelled"
                      ? "outline"
                      : "default"
                  }
                >
                  {detailSlot.status === "open"
                    ? "Libre"
                    : detailSlot.status === "booked"
                    ? "Réservé"
                    : "Annulé"}
                </Badge>
              </div>

              {detailSlot.status === "booked" && (
                <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded-md p-2">
                  Ce créneau est réservé par un client. Annuler le créneau libèrera le rendez-vous.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setDetailSlot(null); }}>
              Fermer
            </Button>
            {detailSlot && detailSlot.status !== "cancelled" && (
              <Button
                variant="destructive"
                disabled={cancellingId === detailSlot.id}
                onClick={() => handleCancel(detailSlot.id)}
              >
                {cancellingId === detailSlot.id ? "Annulation..." : "Annuler ce créneau"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
