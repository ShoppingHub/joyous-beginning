import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Eye, TrendingUp } from "lucide-react";
import { TimeRangeSelector, rangeToDays, type TimeRange } from "@/components/TimeRangeSelector";
import { ChartDetailPanel } from "@/components/progress/ChartDetailPanel";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceDot, Tooltip } from "recharts";
import { getDemoAreas, getDemoScoresForRange } from "@/lib/demoData";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/i18n/translations";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];
type Filter = "all" | AreaType;

const filterOptions: { value: Filter; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "dashboard.filter.all" },
  { value: "health", labelKey: "areaType.health" },
  { value: "study", labelKey: "areaType.study" },
  { value: "reduce", labelKey: "areaType.reduce" },
  { value: "finance", labelKey: "areaType.finance" },
];

function computeSlope(data: { score: number }[]): number {
  if (data.length < 2) return 0;
  const last7 = data.slice(-7);
  if (last7.length < 2) return 0;
  const n = last7.length;
  const sumX = last7.reduce((s, _, i) => s + i, 0);
  const sumY = last7.reduce((s, d) => s + d.score, 0);
  const sumXY = last7.reduce((s, d, i) => s + i * d.score, 0);
  const sumX2 = last7.reduce((s, _, i) => s + i * i, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function getLineColor(slope: number): string {
  if (slope > 0.1) return "hsl(174, 16%, 56%)";
  if (slope < -0.1) return "hsl(0, 72%, 59%)";
  return "hsl(195, 5%, 56%)";
}

const Progress = () => {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [filter, setFilter] = useState<Filter>("all");
  const [areas, setAreas] = useState<Area[]>([]);
  const [scores, setScores] = useState<Record<string, { date: string; score: number }[]>>({});
  const [checkins, setCheckins] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string | null>(null);

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
          grouped[s.area_id].push({ date: s.date, score: s.cumulative_score });
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

  const { chartData, lineColor, firstScore, lastScore, minScore, maxScore } = useMemo(() => {
    const filteredAreas = filter === "all" ? areas : areas.filter((a) => a.type === filter);
    if (filteredAreas.length === 0) return { chartData: [], lineColor: "hsl(195, 5%, 56%)", firstScore: 0, lastScore: 0, minScore: 0, maxScore: 0 };

    const dateMap: Record<string, number[]> = {};
    for (const area of filteredAreas) {
      const areaScores = scores[area.id] || [];
      for (const s of areaScores) {
        if (!dateMap[s.date]) dateMap[s.date] = [];
        dateMap[s.date].push(s.score);
      }
    }

    const averaged = Object.entries(dateMap)
      .map(([date, values]) => ({ date, score: values.reduce((a, b) => a + b, 0) / values.length }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const slope = computeSlope(averaged);
    const arr = averaged.map(d => d.score);
    const min = arr.length > 0 ? Math.min(...arr) : 0;
    const max = arr.length > 0 ? Math.max(...arr) : 0;
    return {
      chartData: averaged,
      lineColor: getLineColor(slope),
      firstScore: averaged.length > 0 ? averaged[0].score : 0,
      lastScore: averaged.length > 0 ? averaged[averaged.length - 1].score : 0,
      minScore: min,
      maxScore: max,
    };
  }, [areas, scores, filter]);

  const hasData = chartData.length > 0 && chartData.some((d) => d.score !== 0);
  const isLargeRange = timeRange === "6m" || timeRange === "1y" || timeRange === "all";

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1000) return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(1);
  };

  const displayScore = activeDate
    ? chartData.find(d => d.date === activeDate)?.score ?? lastScore
    : lastScore;

  // Header + area filters (sticky)
  const header = (
    <div className="sticky top-0 z-40 bg-background">
      <div className="flex items-center px-4 h-14">
        <span className="text-[18px] font-semibold">{t("nav.progress")}</span>
      </div>
      {areas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-hide">
          {filterOptions.map(({ value, labelKey }) => {
            const active = filter === value;
            return (
              <button key={value} onClick={() => { setFilter(value); setActiveDate(null); }}
                className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                  active ? "bg-primary text-primary-foreground" : "border border-muted-foreground/30 text-muted-foreground"
                }`}>
                {t(labelKey)}
              </button>
            );
          })}
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
            <div className="absolute top-2 right-4 z-10 text-right">
              <p className="text-xl font-semibold text-foreground tabular-nums">{fmt(displayScore)}</p>
            </div>
            <div className="absolute top-2 left-4 z-10">
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(firstScore)}</p>
            </div>

            {/* Chart */}
            <div style={{ height: "40vh" }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 40, right: 16, bottom: 8, left: 16 }}
                  onMouseMove={(state: any) => {
                    if (state?.activePayload?.[0]?.payload?.date) {
                      setActiveDate(state.activePayload[0].payload.date);
                    }
                  }}
                  onMouseLeave={() => setActiveDate(null)}
                >
                  <ReferenceLine y={firstScore} stroke="hsl(190, 5%, 75%)" strokeDasharray="3 3" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[yDomainMin, yDomainMax]} />
                  <Tooltip content={() => null} cursor={{ stroke: "hsl(190, 5%, 75%)", strokeWidth: 1, strokeDasharray: "3 3" }} />
                  <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2.5} dot={false}
                    isAnimationActive animationDuration={400} animationEasing="ease-in-out"
                    activeDot={{ r: 5, fill: lineColor, stroke: "none" }}
                  />
                  {!activeDate && lastPoint && (
                    <ReferenceDot x={lastPoint.date} y={lastPoint.score} r={5} fill={lineColor} stroke="none" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Min/Max */}
            <div className="flex justify-between px-4 -mt-2">
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(minScore)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(maxScore)}</p>
            </div>
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
        {hasData && activeDate && (
          <ChartDetailPanel
            activeDate={activeDate}
            areas={areas}
            scores={scores}
            filter={filter}
            isLargeRange={isLargeRange}
            checkins={checkins}
          />
        )}
      </motion.div>
    </div>
  );
};

export default Progress;
