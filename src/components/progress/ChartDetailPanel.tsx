import { useI18n } from "@/hooks/useI18n";
import { format, parseISO } from "date-fns";
import { it, enUS } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];
type Filter = "all" | AreaType;

interface ChartDetailPanelProps {
  activeDate: string | null;
  areas: Area[];
  scores: Record<string, { date: string; score: number }[]>;
  filter: Filter;
  isLargeRange: boolean;
  checkins: Record<string, Set<string>>;
}

export function ChartDetailPanel({ activeDate, areas, scores, filter, isLargeRange, checkins }: ChartDetailPanelProps) {
  const { t, locale } = useI18n();

  if (!activeDate) return null;

  const filteredAreas = filter === "all" ? areas : areas.filter((a) => a.type === filter);
  const dateLocale = locale === "it" ? it : enUS;
  const formattedDate = (() => {
    try {
      return format(parseISO(activeDate), "d MMM yyyy", { locale: dateLocale });
    } catch {
      return activeDate;
    }
  })();

  if (!isLargeRange) {
    // Short range: show activity list for the day with check-in status
    return (
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs text-muted-foreground mb-2 tabular-nums">{formattedDate}</p>
        <div className="flex flex-col gap-1.5">
          {filteredAreas.map((area) => {
            const areaCheckins = checkins[area.id];
            const checked = areaCheckins?.has(activeDate) ?? false;
            const areaScores = scores[area.id] || [];
            const dayScore = areaScores.find((s) => s.date === activeDate);

            return (
              <div key={area.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${checked ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className="text-sm text-foreground">{area.name}</span>
                </div>
                {dayScore && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {dayScore.score >= 0 ? "+" : ""}{dayScore.score.toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Large range: show score per area (or per activity if specific area type selected)
  return (
    <div className="px-4 pt-3 pb-1">
      <p className="text-xs text-muted-foreground mb-2 tabular-nums">{formattedDate}</p>
      <div className="flex flex-col gap-1.5">
        {filteredAreas.map((area) => {
          const areaScores = scores[area.id] || [];
          const dayScore = areaScores.find((s) => s.date === activeDate);
          if (!dayScore) return null;

          return (
            <div key={area.id} className="flex items-center justify-between py-1">
              <span className="text-sm text-foreground">{area.name}</span>
              <span className={`text-sm font-medium tabular-nums ${dayScore.score >= 0 ? "text-primary" : "text-destructive"}`}>
                {dayScore.score >= 0 ? "+" : ""}{dayScore.score.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
