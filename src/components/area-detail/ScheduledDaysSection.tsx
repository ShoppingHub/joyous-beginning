import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";

const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface ScheduledDaysSectionProps {
  areaId: string;
  frequencyPerWeek: number;
  isDemo?: boolean;
}

export function ScheduledDaysSection({ areaId, frequencyPerWeek, isDemo }: ScheduledDaysSectionProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const labels = locale === "it" ? DAYS_IT : DAYS_EN;

  const fetchDays = useCallback(async () => {
    if (isDemo || !user) { setLoading(false); return; }
    const { data } = await supabase
      .from("area_scheduled_days")
      .select("day_of_week")
      .eq("area_id", areaId)
      .eq("user_id", user.id);
    if (data) setSelectedDays(new Set(data.map((d: any) => d.day_of_week)));
    setLoading(false);
  }, [areaId, user, isDemo]);

  useEffect(() => { fetchDays(); }, [fetchDays]);

  const allDays = frequencyPerWeek === 7;
  const remaining = frequencyPerWeek - selectedDays.size;
  const atLimit = remaining <= 0;

  const toggleDay = async (day: number) => {
    if (isDemo || !user || allDays) return;
    const isSelected = selectedDays.has(day);

    if (!isSelected && atLimit) return;

    // Optimistic update
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (isSelected) next.delete(day);
      else next.add(day);
      return next;
    });

    if (isSelected) {
      await supabase
        .from("area_scheduled_days")
        .delete()
        .eq("area_id", areaId)
        .eq("day_of_week", day)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("area_scheduled_days")
        .insert({ area_id: areaId, day_of_week: day, user_id: user.id });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {locale === "it" ? "Giorni programmati" : "Scheduled days"}
        </h3>
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 w-10 rounded-full bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const subtitle = allDays
    ? null
    : atLimit
      ? (locale === "it" ? "Tutti i giorni assegnati" : "All days assigned")
      : (locale === "it" ? `Seleziona ancora ${remaining} giorni` : `Select ${remaining} more days`);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {locale === "it" ? "Giorni programmati" : "Scheduled days"}
      </h3>
      <div className="flex gap-2">
        {labels.map((label, i) => {
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
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
