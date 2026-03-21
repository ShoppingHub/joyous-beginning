import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { format } from "date-fns";
import { CalendarIcon, Repeat, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface ScheduledDaysSectionProps {
  areaId: string;
  frequencyPerWeek: number;
  isDemo?: boolean;
  recurrenceType: string;
  biweeklyStartDate?: string | null;
  onBiweeklyStartDateChange?: (date: string) => void;
}

export function ScheduledDaysSection({
  areaId,
  frequencyPerWeek,
  isDemo,
  recurrenceType,
  biweeklyStartDate,
  onBiweeklyStartDateChange,
}: ScheduledDaysSectionProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [monthlyDays, setMonthlyDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const dayLabels = locale === "it" ? DAYS_IT : DAYS_EN;

  const fetchDays = useCallback(async () => {
    if (isDemo || !user) { setLoading(false); return; }

    if (recurrenceType === "monthly") {
      const { data } = await supabase
        .from("area_monthly_days")
        .select("day_of_month")
        .eq("area_id", areaId)
        .eq("user_id", user.id);
      if (data) setMonthlyDays(new Set(data.map((d: any) => d.day_of_month)));
    } else {
      const { data } = await supabase
        .from("area_scheduled_days")
        .select("day_of_week")
        .eq("area_id", areaId)
        .eq("user_id", user.id);
      if (data) setSelectedDays(new Set(data.map((d: any) => d.day_of_week)));
    }
    setLoading(false);
  }, [areaId, user, isDemo, recurrenceType]);

  useEffect(() => { fetchDays(); }, [fetchDays]);

  // --- Recurrence badge ---
  const recurrenceLabel = t(`recurrence.${recurrenceType}` as any) || recurrenceType;
  const RecurrenceIcon = recurrenceType === "monthly" ? Calendar : Repeat;

  // --- Weekly / Biweekly logic ---
  const allDays = frequencyPerWeek === 7;
  const remaining = frequencyPerWeek - selectedDays.size;
  const atLimit = remaining <= 0;

  const toggleDay = async (day: number) => {
    if (isDemo || !user || allDays) return;
    const isSelected = selectedDays.has(day);
    if (!isSelected && atLimit) return;

    setSelectedDays(prev => {
      const next = new Set(prev);
      if (isSelected) next.delete(day); else next.add(day);
      return next;
    });

    if (isSelected) {
      await supabase.from("area_scheduled_days").delete()
        .eq("area_id", areaId).eq("day_of_week", day).eq("user_id", user.id);
    } else {
      await supabase.from("area_scheduled_days")
        .insert({ area_id: areaId, day_of_week: day, user_id: user.id });
    }
  };

  // --- Biweekly start date ---
  const [biweeklyOpen, setBiweeklyOpen] = useState(false);
  const biweeklyDate = biweeklyStartDate ? new Date(biweeklyStartDate + "T00:00:00") : undefined;

  const handleBiweeklyDateChange = async (date: Date | undefined) => {
    if (!date || !user) return;
    const iso = format(date, "yyyy-MM-dd");
    await supabase.from("areas").update({ biweekly_start_date: iso }).eq("id", areaId);
    onBiweeklyStartDateChange?.(iso);
    setBiweeklyOpen(false);
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 rounded bg-card animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-card animate-pulse" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 w-10 rounded-full bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // --- Monthly view ---
  if (recurrenceType === "monthly") {
    const sortedDays = Array.from(monthlyDays).sort((a, b) => a - b);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {locale === "it" ? "Giorni programmati" : "Scheduled days"}
          </h3>
          <Badge variant="outline" className="gap-1 text-xs font-normal">
            <Calendar size={12} />
            {recurrenceLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("recurrence.monthlyDays" as any)}
        </p>
        <div className="flex flex-wrap gap-2">
          {sortedDays.length > 0 ? sortedDays.map(d => (
            <span key={d} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 border border-primary text-primary text-xs font-medium">
              {d}
            </span>
          )) : (
            <p className="text-xs text-muted-foreground italic">
              {locale === "it" ? "Nessun giorno selezionato" : "No days selected"}
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Weekly / Biweekly view ---
  const subtitle = allDays
    ? null
    : atLimit
      ? (locale === "it" ? "Tutti i giorni assegnati" : "All days assigned")
      : (locale === "it" ? `Seleziona ancora ${remaining} giorni` : `Select ${remaining} more days`);

  return (
    <div className="space-y-3">
      {/* Header with badge */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {locale === "it" ? "Giorni programmati" : "Scheduled days"}
        </h3>
        {recurrenceType !== "weekly" && (
          <Badge variant="outline" className="gap-1 text-xs font-normal">
            <RecurrenceIcon size={12} />
            {recurrenceLabel}
          </Badge>
        )}
      </div>

      {/* Day pills */}
      <div className="flex gap-2">
        {dayLabels.map((label, i) => {
          const day = i + 1;
          const isActive = allDays || selectedDays.has(day);
          const isDisabled = !isActive && atLimit;
          return (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              disabled={allDays || isDisabled}
              className={`h-10 w-10 rounded-full text-xs font-medium border transition-all flex items-center justify-center ${
                isActive
                  ? "bg-primary/20 border-primary text-primary"
                  : isDisabled
                    ? "border-border text-muted-foreground bg-transparent opacity-40"
                    : "border-border text-muted-foreground bg-transparent hover:border-primary/50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}

      {/* Biweekly start date picker */}
      {recurrenceType === "biweekly" && !isDemo && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            {t("recurrence.biweeklyStart" as any)}:
          </span>
          <Popover open={biweeklyOpen} onOpenChange={setBiweeklyOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent",
                !biweeklyDate && "text-muted-foreground"
              )}>
                <CalendarIcon size={12} />
                {biweeklyDate
                  ? format(biweeklyDate, locale === "it" ? "dd/MM/yyyy" : "MMM d, yyyy")
                  : (locale === "it" ? "Seleziona data" : "Select date")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={biweeklyDate}
                onSelect={handleBiweeklyDateChange}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
