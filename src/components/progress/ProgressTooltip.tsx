import { formatTooltipLabel, getTrendArrow, type Granularity, type ChartPoint } from "./useAdaptiveChart";

interface ProgressTooltipProps {
  active?: boolean;
  payload?: any[];
  granularity: Granularity;
  locale: string;
}

export function ProgressTooltip({ active, payload, granularity, locale }: ProgressTooltipProps) {
  if (!active || !payload?.length) return null;

  const point: ChartPoint = payload[0].payload;
  const label = formatTooltipLabel(point.date, granularity, locale);
  const arrow = granularity !== "daily" ? getTrendArrow(point.intraSlope) : null;
  const trendLabel = locale === "it"
    ? (arrow === "↑" ? "in salita" : arrow === "↓" ? "in discesa" : "stabile")
    : (arrow === "↑" ? "rising" : arrow === "↓" ? "falling" : "stable");

  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground tabular-nums">{label}</p>
      {arrow && (
        <p className="text-foreground mt-0.5">{arrow} {trendLabel}</p>
      )}
      <p className="text-foreground font-medium mt-0.5 tabular-nums">
        {locale === "it" ? "Traiettoria" : "Trajectory"}: {point.score.toFixed(2)}
      </p>
    </div>
  );
}
