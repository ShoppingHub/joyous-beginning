import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { BarChart2 } from "lucide-react";
import { TimeRangeSelector, rangeToDays, type TimeRange } from "@/components/TimeRangeSelector";
import { motion } from "framer-motion";
import { subDays, addDays, format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

const financeRanges = [
  { value: "1m" as TimeRange, label: "1m" },
  { value: "3m" as TimeRange, label: "3m" },
  { value: "1y" as TimeRange, label: "1a" },
];

function computeSlope(data: { score: number }[]): number {
  if (data.length < 2) return 0;
  const last = data.slice(-30);
  if (last.length < 2) return 0;
  const n = last.length;
  const sumX = last.reduce((s, _, i) => s + i, 0);
  const sumY = last.reduce((s, d) => s + d.score, 0);
  const sumXY = last.reduce((s, d, i) => s + i * d.score, 0);
  const sumX2 = last.reduce((s, _, i) => s + i * i, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function linearRegression(data: { score: number }[]) {
  const last30 = data.slice(-30);
  const n = last30.length;
  if (n < 3) return null;
  const sumX = last30.reduce((s, _, i) => s + i, 0);
  const sumY = last30.reduce((s, d) => s + d.score, 0);
  const sumXY = last30.reduce((s, d, i) => s + i * d.score, 0);
  const sumX2 = last30.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b, startIndex: n - 1 };
}

function getLineColor(slope: number): string {
  if (slope > 0.1) return "#7DA3A0";
  if (slope < -0.1) return "#BFA37A";
  return "#8C9496";
}

const Finance = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [financeArea, setFinanceArea] = useState<Area | null | undefined>(undefined);
  const [scores, setScores] = useState<{ date: string; score: number }[]>([]);
  const [hasCheckins, setHasCheckins] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: areas } = await supabase.from("areas").select("*").eq("user_id", user.id).eq("type", "finance").is("archived_at", null).limit(1);
    if (!areas || areas.length === 0) { setFinanceArea(null); setLoading(false); return; }
    const area = areas[0];
    setFinanceArea(area);
    const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
    const [scoresRes, checkinsRes] = await Promise.all([
      supabase.from("score_daily").select("*").eq("area_id", area.id).gte("date", startDate).order("date", { ascending: true }),
      supabase.from("checkins").select("id").eq("area_id", area.id).eq("user_id", user.id).limit(1),
    ]);
    if (scoresRes.data) { setScores(scoresRes.data.map((s) => ({ date: s.date, score: s.cumulative_score }))); }
    setHasCheckins((checkinsRes.data?.length ?? 0) > 0);
    setLoading(false);
  }, [user, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const regression = scores.length >= 3 ? linearRegression(scores) : null;
  const slope = computeSlope(scores);
  const lineColor = getLineColor(slope);

  const chartData = (() => {
    const historic = scores.map((s) => ({ date: s.date, score: s.score, projection: undefined as number | undefined }));
    if (!regression || scores.length < 3) return historic;
    const lastScore = scores[scores.length - 1].score;
    const today = new Date();
    const projectionPoints = [];
    for (let i = 0; i <= 30; i++) {
      projectionPoints.push({ date: format(addDays(today, i), "yyyy-MM-dd"), score: undefined as number | undefined, projection: lastScore + regression.m * i });
    }
    if (historic.length > 0) { historic[historic.length - 1].projection = lastScore; }
    return [...historic, ...projectionPoints];
  })();

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8 gap-4">
        <div className="h-14 flex items-center"><div className="h-5 w-20 rounded bg-card animate-pulse" /></div>
        <div className="rounded-xl bg-card animate-pulse" style={{ height: "55vh" }} />
      </motion.div>
    );
  }

  if (financeArea === null) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
        <BarChart2 size={48} className="text-[#8C9496]" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground text-center">{t("finance.empty")}</p>
        <button onClick={() => navigate("/activities/new?type=finance")} className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]">{t("finance.addArea")}</button>
      </motion.div>
    );
  }

  if (!hasCheckins) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8">
        <div className="h-14 flex items-center"><h1 className="text-[18px] font-semibold">{t("finance.title")}</h1></div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
          <BarChart2 size={48} className="text-[#8C9496]" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("finance.empty")}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8">
      <div className="h-14 flex items-center"><h1 className="text-[18px] font-semibold">{t("finance.title")}</h1></div>
      <div className="flex justify-center pb-3"><TimeRangeSelector value={timeRange} onChange={setTimeRange} ranges={financeRanges} /></div>
      <div className="rounded-xl bg-card p-4" style={{ height: "55vh" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="#EAEAEA" strokeOpacity={0.1} />
            <XAxis dataKey="date" tick={{ fill: "#B9C0C1", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(d: string) => `${new Date(d).getDate()}/${new Date(d).getMonth() + 1}`} interval="preserveStartEnd" />
            <YAxis hide />
            <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive animationDuration={300} animationEasing="ease-in-out" connectNulls={false} />
            {regression && <Line type="monotone" dataKey="projection" stroke={lineColor} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive animationDuration={300} animationEasing="ease-in-out" connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {regression && <p className="mt-4 text-sm text-muted-foreground text-center">{t("finance.projection")}</p>}
    </motion.div>
  );
};

export default Finance;
