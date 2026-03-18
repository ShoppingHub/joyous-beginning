import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { GymCard } from "@/components/GymCard";

const GymCardPage = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { getUserCard } = useUserCards();
  const userCard = getUserCard("gym");
  const areaId = userCard?.area_id;

  const [areaName, setAreaName] = useState("");
  const [scores, setScores] = useState<{ date: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !areaId) { setLoading(false); return; }
    const [areaRes, scoresRes] = await Promise.all([
      supabase.from("areas").select("name").eq("id", areaId).single(),
      supabase.from("score_daily").select("date, trajectory_state").eq("area_id", areaId)
        .gte("date", format(subDays(new Date(), 30), "yyyy-MM-dd"))
        .order("date", { ascending: true }),
    ]);
    if (areaRes.data) setAreaName(areaRes.data.name);
    if (scoresRes.data) setScores(scoresRes.data.map(s => ({ date: s.date, score: (s as any).trajectory_state ?? 0 })));
    setLoading(false);
  }, [user, areaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAutoCheckIn = useCallback(async () => {
    if (!user || !areaId) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    await supabase.from("checkins").upsert(
      { area_id: areaId, user_id: user.id, date: todayStr, completed: true },
      { onConflict: "area_id,date" }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      supabase.functions.invoke("calculate-score", {
        body: { area_id: areaId, date: todayStr },
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(console.error);
    }
  }, [user, areaId]);

  const title = locale === "it" ? "Scheda Palestra" : "Gym Card";

  // No area linked
  if (!loading && !areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex flex-col px-4 pt-2 pb-8">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate("/activities")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </button>
          <h1 className="text-[18px] font-semibold">{title}</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <Dumbbell size={48} className="text-primary" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("cards.gym.empty")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("cards.gym.emptySub")}</p>
          <button onClick={() => navigate("/activities/new?type=health")}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]">
            {t("cards.gym.createArea")}
          </button>
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate("/activities")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </button>
          <div className="h-5 w-32 rounded bg-card animate-pulse" />
        </div>
        <div className="h-32 rounded-xl bg-card animate-pulse mt-4" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="flex flex-col px-4 pt-2 pb-8">
      <div className="flex items-center gap-3 h-14">
        <button onClick={() => navigate("/activities")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
        <h1 className="text-[18px] font-semibold">{title}</h1>
      </div>

      {/* Mini trajectory chart */}
      {scores.length > 0 && (
        <div className="rounded-xl bg-card p-3" style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scores} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gym Card content (from Epic 11) */}
      {areaId && <GymCard areaId={areaId} onAutoCheckIn={handleAutoCheckIn} />}
    </motion.div>
  );
};

export default GymCardPage;
