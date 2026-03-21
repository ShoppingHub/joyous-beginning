import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Eye, TrendingUp, Filter, Layers, BarChart3, Check } from "lucide-react";
import { TimeRangeSelector, rangeToDays, type TimeRange } from "@/components/TimeRangeSelector";
import { ChartDetailPanel } from "@/components/progress/ChartDetailPanel";
import { ProgressTooltip } from "@/components/progress/ProgressTooltip";
import { useAdaptiveChart, computeSlope, getLineColor, getSlopeWindow, getTickInterval, formatTickLabel } from "@/components/progress/useAdaptiveChart";
import { motion } from "framer-motion";
import { subDays, format, parseISO } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceDot, Tooltip } from "recharts";
import { getDemoAreas, getDemoScoresForRange } from "@/lib/demoData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/i18n/translations";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];

type FilterMode = "all" | "type" | "activity";
type ViewMode = "total" | "overlay";

const AREA_TYPE_KEYS: { value: AreaType; labelKey: TranslationKey }[] = [
  { value: "health", labelKey: "areaType.health" },
  { value: "study", labelKey: "areaType.study" },
  { value: "reduce", labelKey: "areaType.reduce" },
  { value: "finance", labelKey: "areaType.finance" },
  { value: "career", labelKey: "areaType.career" },
];

const OVERLAY_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--graph-positive))",
  "hsl(var(--graph-decline))",
  "hsl(var(--ring))",
  "hsl(var(--accent))",
  "hsl(var(--graph-neutral))",
  "hsl(var(--sidebar-primary))",
];

const Progress = () => {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedType, setSelectedType] = useState<AreaType | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [areas, setAreas] = useState<Area[]>([]);
  const [scores, setScores] = useState<Record<string, { date: string; score: number }[]>>({});
  const [checkins, setCheckins] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (isDemo) {
      setAreas(getDemoAreas());
      setScores(getDemoScoresForRange(rangeToDays[timeRange]));
      setLoading(false);
      return;
    }
    if (!user) return;
    const { data: areasData } = await supabase
      .from("areas").select("*").eq("user_id", user.id)
      .is("archived_at", null).order("created_at", { ascending: true });
    if (!areasData) { setLoading(false); return; }
    setAreas(areasData);
    if (areasData.length === 0) { setLoading(false); return; }

    const areaIds = areasData.map((a) => a.id);
    const days = rangeToDays[timeRange];
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

    const [scoresRes, checkinsRes] = await Promise.all([
      supabase.from("score_daily").select("*").in("area_id", areaIds)
        .gte("date", startDate).order("date", { ascending: true }),
      supabase.from("checkins").select("area_id, date").in("area_id", areaIds)
        .gte("date", startDate),
    ]);

    const grouped: Record<string, { date: string; score: number }[]> = {};
    for (const area of areasData) { grouped[area.id] = []; }
    if (scoresRes.data) {
      for (const s of scoresRes.data) {
        if (grouped[s.area_id]) {
          grouped[s.area_id].push({ date: s.date, score: (s as any).trajectory_state ?? s.cumulative_score });
        }
      }
    }
    setScores(grouped);

    const checkinMap: Record<string, Set<string>> = {};
    for (const area of areasData) { checkinMap[area.id] = new Set(); }
    if (checkinsRes.data) {
      for (const c of checkinsRes.data) {
        if (checkinMap[c.area_id]) checkinMap[c.area_id].add(c.date);
      }
    }
    setCheckins(checkinMap);
    setLoading(false);
  }, [user, isDemo, timeRange]);

  useEffect(() => { setActiveDate(null); fetchData(); }, [fetchData]);

  // Filtered areas based on filter selection
  const filteredAreas = useMemo(() => {
    if (filterMode === "all") return areas;
    if (filterMode === "type" && selectedType) return areas.filter((a) => a.type === selectedType);
    if (filterMode === "activity" && selectedAreaId) return areas.filter((a) => a.id === selectedAreaId);
    return areas;
  }, [areas, filterMode, selectedType, selectedAreaId]);

  // For "total" view: averaged data
  const rawAveraged = useMemo(() => {
    if (filteredAreas.length === 0) return [];
    const dateMap: Record<string, number[]> = {};
    for (const area of filteredAreas) {
      const areaScores = scores[area.id] || [];
      for (const s of areaScores) {
        if (!dateMap[s.date]) dateMap[s.date] = [];
        dateMap[s.date].push(s.score);
      }
    }
    return Object.entries(dateMap)
      .map(([date, values]) => ({ date, score: values.reduce((a, b) => a + b, 0) / values.length }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredAreas, scores]);

  // For "overlay" view: per-area data merged into single chartData array with area-specific keys
  const overlayData = useMemo(() => {
    if (viewMode !== "overlay" || filteredAreas.length === 0) return { data: [] as any[], areaKeys: [] as { id: string; name: string; color: string }[] };

    const dateMap: Record<string, Record<string, number>> = {};
    for (const area of filteredAreas) {
      const areaScores = scores[area.id] || [];
      for (const s of areaScores) {
        if (!dateMap[s.date]) dateMap[s.date] = {};
        dateMap[s.date][area.id] = s.score;
      }
    }

    const data = Object.entries(dateMap)
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const areaKeys = filteredAreas
      .filter(a => (scores[a.id] || []).length > 0)
      .map((a, i) => ({
        id: a.id,
        name: a.name,
        color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
      }));

    return { data, areaKeys };
  }, [viewMode, filteredAreas, scores]);

  const { chartData, granularity } = useAdaptiveChart(rawAveraged);

  const { lineColor, firstScore, lastScore, minScore, maxScore } = useMemo(() => {
    if (viewMode === "overlay") {
      // Calculate bounds from overlay data
      const allValues = overlayData.data.flatMap(d =>
        overlayData.areaKeys.map(k => d[k.id] as number).filter(v => v !== undefined)
      );
      if (allValues.length === 0) return { lineColor: "#8C9496", firstScore: 0, lastScore: 0, minScore: 0, maxScore: 0 };
      return {
        lineColor: "#8C9496",
        firstScore: allValues[0] ?? 0,
        lastScore: allValues[allValues.length - 1] ?? 0,
        minScore: Math.min(...allValues),
        maxScore: Math.max(...allValues),
      };
    }
    if (chartData.length === 0) return { lineColor: "#8C9496", firstScore: 0, lastScore: 0, minScore: 0, maxScore: 0 };
    const slopeWindow = getSlopeWindow(granularity);
    const slope = computeSlope(chartData, slopeWindow);
    const arr = chartData.map(d => d.score);
    return {
      lineColor: getLineColor(slope),
      firstScore: chartData[0].score,
      lastScore: chartData[chartData.length - 1].score,
      minScore: Math.min(...arr),
      maxScore: Math.max(...arr),
    };
  }, [chartData, granularity, viewMode, overlayData]);

  const hasData = viewMode === "overlay"
    ? overlayData.data.length > 0 && overlayData.areaKeys.length > 0
    : chartData.length > 0 && chartData.some((d) => d.score !== 0);

  const isLargeRange = granularity !== "daily";
  const tickInterval = getTickInterval(granularity, viewMode === "overlay" ? overlayData.data.length : chartData.length);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1000) return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(2);
  };

  const displayScore = activeDate
    ? chartData.find(d => d.date === activeDate)?.score ?? lastScore
    : lastScore;

  // Current filter label
  const filterLabel = useMemo(() => {
    if (filterMode === "all") return t("progress.filter.allActivities");
    if (filterMode === "type" && selectedType) {
      const key = AREA_TYPE_KEYS.find(k => k.value === selectedType);
      return key ? t(key.labelKey) : "";
    }
    if (filterMode === "activity" && selectedAreaId) {
      const area = areas.find(a => a.id === selectedAreaId);
      return area?.name ?? "";
    }
    return t("progress.filter");
  }, [filterMode, selectedType, selectedAreaId, areas, t]);

  // Filter popover content — activities nested under their type
  const filterContent = (
    <div className="flex flex-col gap-0.5 min-w-[200px]">
      {/* All */}
      <button
        onClick={() => { setFilterMode("all"); setSelectedType(null); setSelectedAreaId(null); setActiveDate(null); setFilterOpen(false); }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${filterMode === "all" ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
      >
        {filterMode === "all" && <Check size={14} />}
        <span className={filterMode === "all" ? "" : "ml-5"}>{t("progress.filter.allActivities")}</span>
      </button>

      {/* Types with nested activities */}
      {AREA_TYPE_KEYS.map(({ value, labelKey }) => {
        const typeAreas = areas.filter(a => a.type === value);
        if (typeAreas.length === 0) return null;
        const isTypeActive = filterMode === "type" && selectedType === value;
        return (
          <div key={value}>
            <button
              onClick={() => { setFilterMode("type"); setSelectedType(value); setSelectedAreaId(null); setActiveDate(null); setFilterOpen(false); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors w-full mt-1 ${isTypeActive ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
            >
              {isTypeActive && <Check size={14} />}
              <span className={isTypeActive ? "" : "ml-5"}>{t(labelKey)}</span>
            </button>
            {typeAreas.map((area) => {
              const isActive = filterMode === "activity" && selectedAreaId === area.id;
              return (
                <button
                  key={area.id}
                  onClick={() => { setFilterMode("activity"); setSelectedAreaId(area.id); setSelectedType(null); setActiveDate(null); setFilterOpen(false); }}
                  className={`flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-lg text-sm text-left transition-colors w-full ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {isActive && <Check size={12} />}
                  <span className={isActive ? "" : "ml-4"}>{area.name}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  // Header
  const header = (
    <div className="sticky top-0 z-40 bg-background">
      <div className="flex items-center justify-between px-4 h-14">
        <span className="text-[18px] font-semibold">{t("nav.progress")}</span>
      </div>
      {areas.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2">
          {/* Filter popover */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border border-muted-foreground/30 text-foreground transition-colors hover:bg-muted min-h-[36px]">
                <Filter size={14} className="text-muted-foreground" />
                <span className="max-w-[140px] truncate">{filterLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-2 w-auto max-h-[60vh] overflow-y-auto">
              {filterContent}
            </PopoverContent>
          </Popover>

          {/* View mode toggle */}
          <div className="flex items-center rounded-full bg-card p-0.5 border border-muted-foreground/20">
            <button
              onClick={() => setViewMode("total")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${viewMode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              title={t("progress.view.total")}
            >
              <BarChart3 size={13} />
              <span className="hidden sm:inline">{t("progress.view.total")}</span>
            </button>
            <button
              onClick={() => setViewMode("overlay")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${viewMode === "overlay" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              title={t("progress.view.overlay")}
            >
              <Layers size={13} />
              <span className="hidden sm:inline">{t("progress.view.overlay")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        {header}
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="animate-pulse bg-card rounded-xl" style={{ height: "45vh" }} />
        </div>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <Eye size={48} className="text-primary" strokeWidth={1.5} />
          <div className="text-center space-y-2">
            <p className="text-[18px] font-medium">{t("progress.empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("progress.empty.description")}</p>
          </div>
          <button onClick={() => navigate("/activities")}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]">
            {t("progress.empty.button")}
          </button>
        </div>
      </div>
    );
  }

  const yPadding = (maxScore - minScore) * 0.15 || 1;
  const yDomainMin = minScore - yPadding;
  const yDomainMax = maxScore + yPadding;
  const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Determine which data/chart to use
  const isOverlay = viewMode === "overlay";
  const chartDataSource = isOverlay ? overlayData.data : chartData;

  return (
    <div className="flex flex-col min-h-full">
      {header}

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex flex-col gap-3 px-0 pb-4"
      >
        {hasData ? (
          <div className="relative">
            {/* Score labels */}
            {!isOverlay ? (
              <>
                <div className="absolute top-2 right-4 z-10 text-right">
                  <p className="text-xl font-semibold text-foreground tabular-nums">{fmt(displayScore)}</p>
                </div>
                <div className="absolute top-2 left-4 z-10">
                  <p className="text-xs text-muted-foreground tabular-nums">{fmt(firstScore)}</p>
                </div>
              </>
            ) : (
              <div className="absolute top-2 right-4 z-10 text-right">
                <p className="text-xl font-semibold text-foreground tabular-nums">{fmt(displayScore)}</p>
              </div>
            )}

            {/* Chart */}
            <div style={{ height: "40vh" }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartDataSource}
                  margin={{ top: 40, right: 20, bottom: 16, left: 20 }}
                  onMouseMove={(state: any) => {
                    if (state?.activePayload?.[0]?.payload?.date) {
                      setActiveDate(state.activePayload[0].payload.date);
                    }
                  }}
                  onMouseLeave={() => setActiveDate(null)}
                >
                  {!isOverlay && (
                    <ReferenceLine y={firstScore} stroke="hsl(190, 5%, 75%)" strokeDasharray="3 3" strokeOpacity={0.4} />
                  )}
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    interval={tickInterval}
                    tick={{ fontSize: 10, fill: "hsl(195, 5%, 56%)" }}
                    tickFormatter={(val: string) => formatTickLabel(val, granularity, locale)}
                    tickMargin={6}
                  />
                  <YAxis hide domain={[yDomainMin, yDomainMax]} />
                  <Tooltip
                    content={(props: any) => (
                      isOverlay
                        ? <OverlayTooltip {...props} areaKeys={overlayData.areaKeys} locale={locale} />
                        : <ProgressTooltip {...props} granularity={granularity} locale={locale} />
                    )}
                    cursor={{ stroke: "hsl(190, 5%, 75%)", strokeWidth: 1, strokeDasharray: "3 3" }}
                  />

                  {isOverlay ? (
                    overlayData.areaKeys.map((ak) => (
                      <Line
                        key={ak.id}
                        type="monotone"
                        dataKey={ak.id}
                        name={ak.name}
                        stroke={ak.color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive
                        animationDuration={400}
                        animationEasing="ease-in-out"
                        activeDot={{ r: 4, fill: ak.color, stroke: "none" }}
                        connectNulls
                      />
                    ))
                  ) : (
                    <>
                      <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2.5} dot={false}
                        isAnimationActive animationDuration={400} animationEasing="ease-in-out"
                        activeDot={{ r: 5, fill: lineColor, stroke: "none" }}
                      />
                      {!activeDate && lastPoint && (
                        <ReferenceDot x={lastPoint.date} y={lastPoint.score} r={5} fill={lineColor} stroke="none" />
                      )}
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Min/Max */}
            <div className="flex justify-between px-5 -mt-1">
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(minScore)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(maxScore)}</p>
            </div>

            {/* Overlay legend */}
            {isOverlay && overlayData.areaKeys.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-2">
                {overlayData.areaKeys.map((ak) => (
                  <div key={ak.id} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ak.color }} />
                    <span className="text-xs text-muted-foreground">{ak.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 px-4" style={{ height: "40vh" }}>
            <TrendingUp size={48} className="text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground text-center px-8">{t("dashboard.emptyFilter")}</p>
          </div>
        )}

        {/* Time range selector */}
        <div className="flex justify-center px-4">
          <TimeRangeSelector value={timeRange} onChange={(r) => { setTimeRange(r); setActiveDate(null); }} />
        </div>

        {/* Detail panel on hover/touch */}
        {hasData && activeDate && !isOverlay && (
          <ChartDetailPanel
            activeDate={activeDate}
            areas={areas}
            scores={scores}
            filter={filterMode === "type" && selectedType ? selectedType : "all"}
            isLargeRange={isLargeRange}
            checkins={checkins}
          />
        )}
      </motion.div>
    </div>
  );
};

// Overlay tooltip component
function OverlayTooltip({ active, payload, areaKeys, locale }: {
  active?: boolean;
  payload?: any[];
  areaKeys: { id: string; name: string; color: string }[];
  locale: string;
}) {
  if (!active || !payload?.length) return null;

  const date = payload[0]?.payload?.date;
  const label = (() => {
    try {
      const loc = locale === "it" ? it : enUS;
      return format(parseISO(date), "d MMM yyyy", { locale: loc });
    } catch {
      return date;
    }
  })();

  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground tabular-nums mb-1">{label}</p>
      {payload.map((p: any) => {
        const ak = areaKeys.find(k => k.id === p.dataKey);
        if (!ak || p.value === undefined) return null;
        return (
          <div key={ak.id} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ak.color }} />
            <span className="text-foreground">{ak.name}: <span className="font-medium tabular-nums">{p.value.toFixed(2)}</span></span>
          </div>
        );
      })}
    </div>
  );
}

export default Progress;
