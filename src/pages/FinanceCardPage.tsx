import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { TimeRangeSelector, rangeToDays, type TimeRange } from "@/components/TimeRangeSelector";
import { motion } from "framer-motion";
import { subDays, addDays, format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { track } from "@/lib/analytics";

const financeRanges = [
  { value: "1m" as TimeRange, label: "1m" },
  { value: "3m" as TimeRange, label: "3m" },
  { value: "1y" as TimeRange, label: "1a" },
];

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
  if (slope > 0.1) return "hsl(var(--primary))";
  if (slope < -0.1) return "hsl(var(--accent))";
  return "hsl(var(--muted-foreground))";
}

const FinanceCardPage = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { getUserCard } = useUserCards();
  const userCard = getUserCard("finance_projection");
  const areaId = userCard?.area_id;

  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [scores, setScores] = useState<{ date: string; score: number }[]>([]);
  const [hasCheckins, setHasCheckins] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !areaId) { setLoading(false); return; }
    const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
    const [scoresRes, checkinsRes] = await Promise.all([
      supabase.from("score_daily").select("*").eq("area_id", areaId).gte("date", startDate).order("date", { ascending: true }),
      supabase.from("checkins").select("id").eq("area_id", areaId).eq("user_id", user.id).limit(1),
    ]);
    if (scoresRes.data) setScores(scoresRes.data.map(s => ({ date: s.date, score: (s as any).trajectory_state ?? s.cumulative_score })));
    setHasCheckins((checkinsRes.data?.length ?? 0) > 0);
    setLoading(false);
  }, [user, areaId, timeRange]);

  useEffect(() => { fetchData(); track("card_opened", { card_type: "finance_projection" }); }, [fetchData]);

  const title = locale === "it" ? "Proiezione Finanze" : "Finance Projection";
  const regression = scores.length >= 3 ? linearRegression(scores) : null;
  const slope = regression?.m ?? 0;
  const lineColor = getLineColor(slope);

  const chartData = (() => {
    const historic = scores.map(s => ({ date: s.date, score: s.score, projection: undefined as number | undefined }));
    if (!regression || scores.length < 3) return historic;
    const lastScore = scores[scores.length - 1].score;
    const today = new Date();
    const projectionPoints = [];
    for (let i = 0; i <= 30; i++) {
      projectionPoints.push({ date: format(addDays(today, i), "yyyy-MM-dd"), score: undefined as number | undefined, projection: lastScore + regression.m * i });
    }
    if (historic.length > 0) historic[historic.length - 1].projection = lastScore;
    return [...historic, ...projectionPoints];
  })();

  const PageHeader = () => (
    <div className="relative flex items-center justify-center h-14">
      <button onClick={() => navigate("/cards")} className="absolute left-0 flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
        <ArrowLeft size={22} strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-2">
        <TrendingUp size={20} strokeWidth={1.5} className="text-primary" />
        <h1 className="text-[17px] font-semibold">{title}</h1>
      </div>
    </div>
  );

  if (!loading && !areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <TrendingUp size={48} className="text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("cards.finance.empty")}</p>
          <button onClick={() => navigate("/activities/new?type=finance")}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]">
            {t("cards.finance.createArea")}
          </button>
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader />
        <div className="rounded-xl bg-card animate-pulse mt-4" style={{ height: "55vh" }} />
      </div>
    );
  }

  if (!hasCheckins) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
          <TrendingUp size={48} className="text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("cards.finance.empty")}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col px-4 pt-2 pb-8">
      <PageHeader />
      <div className="flex justify-center pb-3">
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} ranges={financeRanges} />
      </div>
      <div className="rounded-xl bg-card p-4" style={{ height: "55vh" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
            <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false}
              tickFormatter={(d: string) => `${new Date(d).getDate()}/${new Date(d).getMonth() + 1}`} interval="preserveStartEnd" />
            <YAxis hide />
            <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2} dot={false} connectNulls={false} />
            {regression && <Line type="monotone" dataKey="projection" stroke={lineColor} strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {regression && <p className="mt-4 text-sm text-muted-foreground text-center">{t("cards.finance.projectionLabel")}</p>}
    </motion.div>
  );
};

export default FinanceCardPage;
