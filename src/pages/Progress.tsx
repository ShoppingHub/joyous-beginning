import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Eye, TrendingUp, Filter, Layers, BarChart3, Check, Hash } from "lucide-react";
import { TimeRangeSelector, rangeToDays, type TimeRange } from "@/components/TimeRangeSelector";
import { ChartDetailPanel } from "@/components/progress/ChartDetailPanel";
import { ProgressTooltip } from "@/components/progress/ProgressTooltip";
import { useAdaptiveChart, computeSlope, getLineColor, getSlopeWindow, getTickInterval, formatTickLabel, formatTooltipLabel, groupAndSmoothOverlayData } from "@/components/progress/useAdaptiveChart";
import { motion, AnimatePresence } from "framer-motion";
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
  "hsl(210, 90%, 60%)",   // vivid blue
  "hsl(350, 80%, 60%)",   // coral red
  "hsl(145, 65%, 50%)",   // emerald green
  "hsl(35, 95%, 58%)",    // warm orange
  "hsl(280, 65%, 65%)",   // purple
  "hsl(0, 0%, 92%)",      // near-white (high contrast on dark)
  "hsl(180, 70%, 50%)",   // cyan / teal
  "hsl(55, 85%, 55%)",    // golden yellow
  "hsl(320, 70%, 65%)",   // pink / magenta
  "hsl(195, 80%, 45%)",   // deep sky blue
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
  const [archivedRetainedAreas, setArchivedRetainedAreas] = useState<Area[]>([]);
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
    // Fetch active areas
    const { data: areasData } = await supabase
      .from("areas").select("*").eq("user_id", user.id)
      .is("archived_at", null).order("created_at", { ascending: true });
    // Fetch archived areas that retained data (for total/type scores)
    const { data: archivedData } = await supabase
      .from("areas").select("*").eq("user_id", user.id)
      .not("archived_at", "is", null).eq("data_retained", true)
      .order("created_at", { ascending: true });
    if (!areasData) { setLoading(false); return; }
    setAreas(areasData);
    setArchivedRetainedAreas(archivedData || []);
    const allAreasForScores = [...areasData, ...(archivedData || [])];
    if (allAreasForScores.length === 0) { setLoading(false); return; }

    const areaIds = allAreasForScores.map((a) => a.id);
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
  // For "all" and "type" modes, include archived areas with retained data in score calculations
  const filteredAreas = useMemo(() => {
    const allWithRetained = [...areas, ...archivedRetainedAreas];
    if (filterMode === "all") return allWithRetained;
    if (filterMode === "type" && selectedType) return allWithRetained.filter((a) => a.type === selectedType);
    if (filterMode === "activity" && selectedAreaId) return areas.filter((a) => a.id === selectedAreaId);
    return allWithRetained;
  }, [areas, archivedRetainedAreas, filterMode, selectedType, selectedAreaId]);

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

    const rawData = Object.entries(dateMap)
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const areaKeys = filteredAreas
      .filter(a => (scores[a.id] || []).length > 0)
      .map((a, i) => ({
        id: a.id,
        name: a.name,
        color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
      }));

    // Group by week/month and smooth, same as total view
    const { data, granularity: overlayGran } = groupAndSmoothOverlayData(rawData, areaKeys.map(k => k.id));

    return { data, areaKeys, granularity: overlayGran };
  }, [viewMode, filteredAreas, scores]);

  const { chartData, granularity } = useAdaptiveChart(rawAveraged);

  const { lineColor, firstScore, lastScore, minScore, maxScore } = useMemo(() => {
    if (viewMode === "overlay") {
      const keys = overlayData.areaKeys.map(k => k.id);
      const allValues: number[] = [];
      for (const d of overlayData.data) {
        for (const k of keys) {
          const v = d[k] as number;
          if (v !== undefined && v !== null) allValues.push(v);
        }
      }
      if (allValues.length === 0) return { lineColor: "#8C9496", firstScore: 0, lastScore: 0, minScore: 0, maxScore: 0 };

      // Average across areas for first and last data points
      const avgForRow = (row: Record<string, any>) => {
        const vals = keys.map(k => row[k] as number).filter(v => v !== undefined && v !== null);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };
      const firstRow = overlayData.data[0];
      const lastRow = overlayData.data[overlayData.data.length - 1];

      return {
        lineColor: "#8C9496",
        firstScore: avgForRow(firstRow),
        lastScore: avgForRow(lastRow),
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

  const effectiveGranularity = viewMode === "overlay" ? (overlayData.granularity ?? granularity) : granularity;
  const isLargeRange = effectiveGranularity !== "daily";
  const tickInterval = getTickInterval(effectiveGranularity, viewMode === "overlay" ? overlayData.data.length : chartData.length);

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

  // Difference from start
  const scoreDiff = lastScore - firstScore;
  const diffSign = scoreDiff >= 0 ? "+" : "";
  const diffColor = scoreDiff > 0.1 ? "text-[hsl(var(--graph-positive))]" : scoreDiff < -0.1 ? "text-destructive" : "text-muted-foreground";
  const diffPct = firstScore !== 0 ? ((scoreDiff / Math.abs(firstScore)) * 100) : 0;
  const pctStr = Math.abs(diffPct) < 0.01 ? "" : ` (${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%)`;

  // Header
  const header = (
    <div className="sticky top-0 z-40 bg-background">
      {/* Row 1: Title + Filter */}
      <div className="flex items-center justify-between px-4 h-14">
        <span className="text-[18px] font-semibold">{t("nav.progress")}</span>
        {areas.length > 0 && (
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border border-muted-foreground/30 text-foreground transition-colors hover:bg-muted min-h-[36px]">
                <Filter size={14} className="text-muted-foreground" />
                <span className="max-w-[140px] truncate">{filterLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-2 w-auto max-h-[60vh] overflow-y-auto">
              {filterContent}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {/* Row 2: Score diff + View mode toggle */}
      {areas.length > 0 && (
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-foreground tabular-nums">{fmt(lastScore)}</span>
            {hasData && (
              <span className={`text-xs font-medium tabular-nums ${diffColor}`}>
                {diffSign}{fmt(scoreDiff)}{pctStr} · {locale === "it" ? "Dall'inizio" : "From start"}
              </span>
            )}
          </div>
          <div className="flex items-center rounded-full bg-card p-0.5 border border-muted-foreground/20">
            <button
              onClick={() => setViewMode("total")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${viewMode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              title={t("progress.view.total")}
            >
              <BarChart3 size={13} />
              <span>{t("progress.view.total")}</span>
            </button>
            <button
              onClick={() => setViewMode("overlay")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${viewMode === "overlay" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              title={t("progress.view.overlay")}
            >
              <Layers size={13} />
              <span>{t("progress.view.overlay")}</span>
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
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
            {/* Score labels removed — shown in header */}

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
                    tickFormatter={(val: string) => formatTickLabel(val, effectiveGranularity, locale)}
                    tickMargin={6}
                  />
                  <YAxis hide domain={[yDomainMin, yDomainMax]} />
                  {isOverlay ? (
                    <Tooltip
                      content={(props: any) => {
                        if (!props.active || !props.payload?.length) return null;
                        const point = props.payload[0]?.payload;
                        if (!point) return null;
                        const label = formatTooltipLabel(point.date, effectiveGranularity, locale);
                        return (
                          <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                            <p className="text-muted-foreground tabular-nums">{label}</p>
                          </div>
                        );
                      }}
                      cursor={{ stroke: "hsl(190, 5%, 75%)", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                  ) : (
                    <Tooltip
                      content={(props: any) => (
                        <ProgressTooltip {...props} granularity={granularity} locale={locale} />
                      )}
                      cursor={{ stroke: "hsl(190, 5%, 75%)", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                  )}

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

            {/* Overlay legend removed — shown in bottom list */}
              </motion.div>
            </AnimatePresence>
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

        {/* Detail panel on hover/touch — total mode */}
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

        {/* Overlay activity list with scores — always visible */}
        {isOverlay && overlayData.areaKeys.length > 0 && (
          <div className="px-4 pt-1 pb-2">
            <div className="flex flex-col gap-1">
              {overlayData.areaKeys.map((ak) => {
                const areaScores = scores[ak.id] || [];
                const lastAreaScore = areaScores.length > 0 ? areaScores[areaScores.length - 1].score : null;
                const activeDayScore = activeDate
                  ? overlayData.data.find(d => d.date === activeDate)?.[ak.id] as number | undefined
                  : undefined;
                return (
                  <div key={ak.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ak.color }} />
                      <span className="text-sm text-foreground">{ak.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeDayScore !== undefined && (
                        <span className="text-xs text-muted-foreground tabular-nums">{fmt(activeDayScore)}</span>
                      )}
                      {lastAreaScore !== null && (
                        <span className="text-sm font-medium text-foreground tabular-nums">{fmt(lastAreaScore)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
