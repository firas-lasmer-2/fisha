import { useState, useMemo, useRef, useCallback } from "react";
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
import {
  ChevronLeft,
  ChevronRight,
  Repeat,
  CalendarCheck,
  Copy,
  X,
  Clock,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import type { TherapistSlot } from "@shared/schema";

// 07:00 – 20:00 (visible hours in day planner)
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

const DURATION_PRESETS = [
  { label: "30 min", value: 30 },
  { label: "50 min", value: 50 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
];

const DAY_NAMES_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

  // Day planner panel state
  const [plannerDay, setPlannerDay] = useState<Date | null>(null);
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
  const [duration, setDuration] = useState(defaultDurationMinutes);
  const [price, setPrice] = useState(defaultPriceDinar);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurWeeks, setRecurWeeks] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drag-select state
  const dragStartHour = useRef<number | null>(null);
  const isDragging = useRef(false);

  // Detail dialog
  const [detailSlot, setDetailSlot] = useState<TherapistSlot | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Copy-day state
  const [copySourceDay, setCopySourceDay] = useState<Date | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<Set<number>>(new Set());
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const today = useMemo(() => new Date(), []);
  const referenceDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + weekOffset * 7);
    return d;
  }, [today, weekOffset]);

  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);

  // Map slots by date string
  const slotsByDate = useMemo(() => {
    const map: Record<string, TherapistSlot[]> = {};
    for (const slot of slots) {
      const ds = new Date(slot.startsAt).toDateString();
      if (!map[ds]) map[ds] = [];
      map[ds].push(slot);
    }
    return map;
  }, [slots]);

  // Hours already occupied on the planner day
  const occupiedHoursForDay = useMemo(() => {
    if (!plannerDay) return new Set<number>();
    const daySlots = slotsByDate[plannerDay.toDateString()] ?? [];
    const set = new Set<number>();
    for (const slot of daySlots) {
      if (slot.status === "cancelled") continue;
      const start = new Date(slot.startsAt);
      const spans = Math.ceil(slot.durationMinutes / 60);
      for (let i = 0; i < spans; i++) set.add(start.getHours() + i);
    }
    return set;
  }, [plannerDay, slotsByDate]);

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

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString("fr", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("fr", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [weekDates]);

  // Open day planner
  const openPlanner = (date: Date) => {
    const dt = new Date(date);
    dt.setHours(23, 59, 0, 0);
    if (dt < new Date()) return; // past day
    setPlannerDay(date);
    setSelectedHours(new Set());
    setDuration(defaultDurationMinutes);
    setPrice(defaultPriceDinar);
    setIsRecurring(false);
    setRecurWeeks(4);
  };

  // Drag-to-select handlers
  const handleHourPointerDown = useCallback((hour: number, occupied: boolean) => {
    if (occupied) return;
    isDragging.current = true;
    dragStartHour.current = hour;
    setSelectedHours((prev) => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour); else next.add(hour);
      return next;
    });
  }, []);

  const handleHourPointerEnter = useCallback((hour: number, occupied: boolean) => {
    if (!isDragging.current || dragStartHour.current === null || occupied) return;
    const start = Math.min(dragStartHour.current, hour);
    const end = Math.max(dragStartHour.current, hour);
    setSelectedHours((prev) => {
      const next = new Set(prev);
      for (let h = start; h <= end; h++) next.add(h);
      return next;
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    dragStartHour.current = null;
  }, []);

  // Select all free hours for the day
  const selectAll = () => {
    const freeHours = HOURS.filter((h) => !occupiedHoursForDay.has(h));
    const isPast = (h: number) => {
      if (!plannerDay) return false;
      const dt = new Date(plannerDay);
      dt.setHours(h + 1, 0, 0, 0);
      return dt < new Date();
    };
    setSelectedHours(new Set(freeHours.filter((h) => !isPast(h))));
  };

  const clearSelection = () => setSelectedHours(new Set());

  // Create slots from selected hours
  const handleCreate = async () => {
    if (!plannerDay || selectedHours.size === 0) return;
    setIsSubmitting(true);

    const weeks = isRecurring ? Math.max(2, recurWeeks) : 1;
    const sortedHours = Array.from(selectedHours).sort((a, b) => a - b);

    const slotsToCreate: { startsAt: string; durationMinutes: number; priceDinar: number }[] = [];
    for (let w = 0; w < weeks; w++) {
      for (const hour of sortedHours) {
        const d = new Date(plannerDay);
        d.setDate(d.getDate() + w * 7);
        slotsToCreate.push({
          startsAt: isoAt(d, hour),
          durationMinutes: duration,
          priceDinar: price,
        });
      }
    }

    try {
      if (slotsToCreate.length === 1) {
        await apiRequest("POST", "/api/therapist/slots", slotsToCreate[0]);
      } else {
        await apiRequest("POST", "/api/therapist/slots/batch", { slots: slotsToCreate });
      }
      queryClient.invalidateQueries({ queryKey: invalidateKey ?? ["/api/therapists", therapistId, "slots"] });
      toast({
        title: slotsToCreate.length === 1
          ? t("slots.published_success")
          : `${slotsToCreate.length} créneaux créés`,
      });
      setPlannerDay(null);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel a slot
  const handleCancel = async (slotId: number) => {
    setCancellingId(slotId);
    try {
      await apiRequest("DELETE", `/api/therapist/slots/${slotId}`);
      queryClient.invalidateQueries({ queryKey: invalidateKey ?? ["/api/therapists", therapistId, "slots"] });
      toast({ title: t("slots.cancelled_success") });
      setDetailSlot(null);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  // Copy day's slots to other days
  const openCopyDialog = (date: Date) => {
    setCopySourceDay(date);
    setCopyTargetDays(new Set());
    setCopyDialogOpen(true);
  };

  const handleCopyDay = async () => {
    if (!copySourceDay || copyTargetDays.size === 0) return;
    const sourceSlots = (slotsByDate[copySourceDay.toDateString()] ?? []).filter(
      (s) => s.status === "open"
    );
    if (sourceSlots.length === 0) return;

    setIsCopying(true);
    const slotsToCreate: { startsAt: string; durationMinutes: number; priceDinar: number }[] = [];

    for (const targetDayIndex of Array.from(copyTargetDays)) {
      const targetDate = weekDates[targetDayIndex];
      for (const slot of sourceSlots) {
        const srcDate = new Date(slot.startsAt);
        const targetDt = new Date(targetDate);
        targetDt.setHours(srcDate.getHours(), 0, 0, 0);
        if (targetDt > new Date()) {
          slotsToCreate.push({
            startsAt: targetDt.toISOString(),
            durationMinutes: slot.durationMinutes,
            priceDinar: slot.priceDinar,
          });
        }
      }
    }

    try {
      if (slotsToCreate.length > 0) {
        if (slotsToCreate.length === 1) {
          await apiRequest("POST", "/api/therapist/slots", slotsToCreate[0]);
        } else {
          await apiRequest("POST", "/api/therapist/slots/batch", { slots: slotsToCreate });
        }
        queryClient.invalidateQueries({ queryKey: invalidateKey ?? ["/api/therapists", therapistId, "slots"] });
        toast({ title: `${slotsToCreate.length} créneaux copiés` });
      }
      setCopyDialogOpen(false);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-3" onPointerUp={handlePointerUp}>
      {/* Week navigation */}
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-primary text-xs">
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
        Cliquez sur un jour pour ouvrir le planificateur et sélectionner vos créneaux.
      </p>

      {/* Week overview — 7 day cards */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map((d, di) => {
          const isToday = d.toDateString() === today.toDateString();
          const isPastDay = new Date(d).setHours(23, 59) < Date.now();
          const daySlots = slotsByDate[d.toDateString()] ?? [];
          const openCount = daySlots.filter((s) => s.status === "open").length;
          const bookedCount = daySlots.filter((s) => s.status === "booked").length;
          const isPlannerOpen = plannerDay?.toDateString() === d.toDateString();

          return (
            <div key={di} className="flex flex-col gap-1">
              {/* Day header button */}
              <button
                onClick={() => !isPastDay && openPlanner(d)}
                className={`rounded-lg border p-2 text-center transition-all select-none ${
                  isPlannerOpen
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isPastDay
                    ? "border-muted/30 bg-muted/20 opacity-40 cursor-not-allowed"
                    : "border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                }`}
              >
                <p className={`text-[11px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {DAY_NAMES_FR[di]}
                </p>
                <p className={`text-sm font-bold leading-tight ${isToday ? "text-primary" : ""}`}>
                  {d.getDate()}
                </p>

                {/* Slot summary dots */}
                <div className="flex justify-center gap-0.5 mt-1 min-h-[8px]">
                  {openCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-3.5 rounded-sm bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold">
                      {openCount}
                    </span>
                  )}
                  {bookedCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-3.5 rounded-sm bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[9px] font-bold">
                      {bookedCount}
                    </span>
                  )}
                  {!isPastDay && openCount === 0 && bookedCount === 0 && (
                    <Plus className="h-2.5 w-2.5 text-muted-foreground/40" />
                  )}
                </div>
              </button>

              {/* Copy button when day has open slots */}
              {openCount > 0 && !isPastDay && (
                <button
                  onClick={(e) => { e.stopPropagation(); openCopyDialog(d); }}
                  title="Copier les créneaux de ce jour"
                  className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors py-0.5"
                >
                  <Copy className="h-2.5 w-2.5" />
                  <span>Copier</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Day Planner Panel */}
      <AnimatePresence>
        {plannerDay && (
          <motion.div
            key={plannerDay.toDateString()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            className="rounded-xl border bg-card shadow-sm overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold capitalize">
                  {plannerDay.toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              </div>
              <button onClick={() => setPlannerDay(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Time grid — tap or drag to select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Sélectionnez les heures de début</p>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-[11px] text-primary hover:underline">Tout sélectionner</button>
                    {selectedHours.size > 0 && (
                      <button onClick={clearSelection} className="text-[11px] text-muted-foreground hover:underline">Effacer</button>
                    )}
                  </div>
                </div>

                {/* Drag hint */}
                <p className="text-[11px] text-muted-foreground/70">
                  Cliquez sur une heure ou faites glisser pour sélectionner une plage.
                </p>

                {/* Time blocks grid */}
                <div
                  className="grid gap-1.5 select-none"
                  style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
                  onPointerLeave={() => { isDragging.current = false; }}
                >
                  {HOURS.map((hour) => {
                    const occupied = occupiedHoursForDay.has(hour);
                    const isPast = (() => {
                      const dt = new Date(plannerDay);
                      dt.setHours(hour + 1, 0, 0, 0);
                      return dt < new Date();
                    })();
                    const selected = selectedHours.has(hour);
                    const disabled = occupied || isPast;

                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={disabled}
                        aria-label={`${formatHour(hour)}${occupied ? " — occupied" : isPast ? " — past" : selected ? " — selected" : " — available"}`}
                        aria-pressed={selected}
                        onPointerDown={() => handleHourPointerDown(hour, disabled)}
                        onPointerEnter={() => handleHourPointerEnter(hour, disabled)}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !disabled) {
                            e.preventDefault();
                            handleHourPointerDown(hour, disabled);
                          }
                        }}
                        className={`
                          rounded-lg border py-2.5 text-xs font-medium transition-all touch-none
                          ${disabled
                            ? occupied
                              ? "bg-blue-50 border-blue-200 text-blue-400 dark:bg-blue-900/20 dark:border-blue-800 cursor-not-allowed"
                              : "opacity-30 cursor-not-allowed bg-muted/30 border-muted"
                            : selected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.03]"
                            : "bg-muted/30 border-border hover:border-primary/50 hover:bg-primary/8 cursor-pointer"
                          }
                        `}
                      >
                        {formatHour(hour)}
                        {occupied && <div className="text-[9px] opacity-70 leading-tight">pris</div>}
                      </button>
                    );
                  })}
                </div>

                {selectedHours.size > 0 && (
                  <p className="text-xs text-primary font-medium">
                    {selectedHours.size} heure{selectedHours.size > 1 ? "s" : ""} sélectionnée{selectedHours.size > 1 ? "s" : ""}
                    {" · "}fin à{" "}
                    {(() => {
                      const maxH = Math.max(...Array.from(selectedHours));
                      const endMin = new Date(plannerDay);
                      endMin.setHours(maxH, 0, 0, 0);
                      endMin.setMinutes(duration);
                      return `${String(endMin.getHours()).padStart(2, "0")}:${String(endMin.getMinutes()).padStart(2, "0")}`;
                    })()}
                  </p>
                )}
              </div>

              {/* Duration & Price */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Durée par créneau</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setDuration(p.value)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                          duration === p.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={15}
                        max={240}
                        step={5}
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-16 h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Prix (TND)</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      step={5}
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-24 h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">TND / séance</span>
                  </div>
                </div>
              </div>

              {/* Recurring */}
              <div className="rounded-lg border p-3 space-y-2">
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
                  <div className="flex items-center gap-2 ps-6">
                    <span className="text-sm text-muted-foreground shrink-0">Pendant</span>
                    <Input
                      type="number"
                      min={2}
                      max={52}
                      value={recurWeeks}
                      onChange={(e) => setRecurWeeks(Math.max(2, Number(e.target.value)))}
                      className="w-16 h-8 text-xs"
                    />
                    <span className="text-sm text-muted-foreground">semaines</span>
                    <span className="text-xs text-muted-foreground ms-auto">
                      = {selectedHours.size * recurWeeks} créneaux
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setPlannerDay(null)}>
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={isSubmitting || selectedHours.size === 0}
                >
                  <CalendarCheck className="h-3.5 w-3.5 me-1.5" />
                  {isSubmitting
                    ? "Création..."
                    : isRecurring
                    ? `Créer ${selectedHours.size * recurWeeks} créneaux`
                    : selectedHours.size > 1
                    ? `Créer ${selectedHours.size} créneaux`
                    : "Créer le créneau"}
                </Button>
              </div>

              {/* Existing slots for this day */}
              {(slotsByDate[plannerDay.toDateString()] ?? []).length > 0 && (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Créneaux existants ce jour</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(slotsByDate[plannerDay.toDateString()] ?? [])
                      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                      .map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setDetailSlot(slot)}
                          className={`text-[11px] rounded-lg border px-2.5 py-1.5 font-medium transition-colors ${slotColor(slot)}`}
                        >
                          <Clock className="h-2.5 w-2.5 inline me-0.5" />
                          {formatHour(new Date(slot.startsAt).getHours())}–{endHour(slot)}
                          <span className="ms-1 opacity-70">{slot.priceDinar}D</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slot detail dialog */}
      <Dialog
        open={!!detailSlot}
        onOpenChange={(open) => { if (!open) setDetailSlot(null); }}
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
            <Button variant="outline" onClick={() => setDetailSlot(null)}>
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

      {/* Copy day dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={(open) => { if (!open) setCopyDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Copier les créneaux
            </DialogTitle>
          </DialogHeader>
          {copySourceDay && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copier les créneaux du{" "}
                <span className="font-medium text-foreground capitalize">
                  {copySourceDay.toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}
                </span>{" "}
                vers :
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {weekDates.map((d, di) => {
                  const isSrc = d.toDateString() === copySourceDay.toDateString();
                  const isPast = new Date(d).setHours(23, 59) < Date.now();
                  const selected = copyTargetDays.has(di);
                  return (
                    <button
                      key={di}
                      disabled={isSrc || isPast}
                      onClick={() => {
                        setCopyTargetDays((prev) => {
                          const next = new Set(prev);
                          if (next.has(di)) next.delete(di); else next.add(di);
                          return next;
                        });
                      }}
                      className={`rounded-lg border py-2 text-center text-xs font-medium transition-all ${
                        isSrc
                          ? "border-primary bg-primary/10 text-primary cursor-default"
                          : isPast
                          ? "opacity-30 cursor-not-allowed border-muted"
                          : selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div>{DAY_NAMES_FR[di]}</div>
                      <div className="font-bold">{d.getDate()}</div>
                    </button>
                  );
                })}
              </div>
              {copyTargetDays.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {copyTargetDays.size} jour{copyTargetDays.size > 1 ? "s" : ""} sélectionné{copyTargetDays.size > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCopyDay}
              disabled={isCopying || copyTargetDays.size === 0}
            >
              <Copy className="h-3.5 w-3.5 me-1.5" />
              {isCopying ? "Copie..." : "Copier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
