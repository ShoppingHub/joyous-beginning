import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { format } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { GymProgramDay, GymProgramExercise } from "./types";

interface GymHistoryProps {
  areaId: string;
  programId: string;
}

interface HistorySession {
  id: string;
  date: string;
  day_name: string;
  exercises: { name: string; sets: number; reps: number; weight_used: number | null }[];
}

export function GymHistory({ areaId, programId }: GymHistoryProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const today = format(new Date(), "yyyy-MM-dd");
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    const { data: sessionsData } = await supabase
      .from("gym_sessions" as any)
      .select("id, date, day_id")
      .eq("area_id", areaId)
      .eq("user_id", user.id)
      .neq("date", today)
      .order("date", { ascending: false })
      .limit(30);

    if (!sessionsData || (sessionsData as any[]).length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const sData = sessionsData as any[];
    const sessionIds = sData.map(s => s.id);
    const dayIds = [...new Set(sData.map(s => s.day_id))];

    const [sessExRes, daysRes] = await Promise.all([
      supabase.from("gym_session_exercises" as any).select("*").in("session_id", sessionIds).eq("completed", true),
      supabase.from("gym_program_days" as any).select("id, name").in("id", dayIds),
    ]);

    const sessExData = (sessExRes.data as any[]) || [];
    const daysMap: Record<string, string> = {};
    for (const d of (daysRes.data as any[] || [])) daysMap[d.id] = d.name;

    // Get exercise names
    const exerciseIds = [...new Set(sessExData.map(se => se.exercise_id))];
    let exMap: Record<string, GymProgramExercise> = {};
    if (exerciseIds.length > 0) {
      const { data: exData } = await supabase
        .from("gym_program_exercises" as any)
        .select("*")
        .in("id", exerciseIds);
      for (const e of (exData as any[] || [])) exMap[e.id] = e;
    }

    const result: HistorySession[] = sData
      .map(s => {
        const completed = sessExData
          .filter(se => se.session_id === s.id)
          .map(se => {
            const ex = exMap[se.exercise_id];
            return {
              name: ex?.name || "?",
              sets: ex?.sets || 0,
              reps: ex?.reps || 0,
              weight_used: se.weight_used,
            };
          });
        return {
          id: s.id,
          date: s.date,
          day_name: daysMap[s.day_id] || "",
          exercises: completed,
        };
      })
      .filter(s => s.exercises.length > 0);

    setSessions(result);
    setLoading(false);
  }, [user, areaId, today]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading || sessions.length === 0) return null;

  const dateFmt = (date: string) => {
    try {
      return format(new Date(date + "T00:00:00"), "EEE d MMM", { locale: locale === "it" ? it : enUS });
    } catch { return date; }
  };

  const exCountLabel = (count: number) => {
    if (count === 1) return locale === "it" ? "1 esercizio" : "1 exercise";
    return `${count} ${t("gym.exercises")}`;
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      <div className="h-px bg-border" />
      <p className="text-sm text-muted-foreground font-medium mt-1">{t("gym.history")}</p>
      <div className="flex flex-col gap-1.5">
        {sessions.map(s => {
          const isExpanded = expandedId === s.id;
          return (
            <div key={s.id} className="rounded-lg bg-card overflow-hidden">
              <button onClick={() => setExpandedId(isExpanded ? null : s.id)}
                className="flex items-center justify-between w-full px-4 py-3 min-h-[48px]">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{dateFmt(s.date)}</span>
                  {s.day_name && <span className="text-xs text-muted-foreground">{s.day_name}</span>}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs">{exCountLabel(s.exercises.length)}</span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 flex flex-col gap-1">
                  {s.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <span className="text-sm font-medium">{ex.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ex.weight_used && ex.weight_used > 0 ? `${ex.sets} × ${ex.weight_used}kg` : `${ex.sets} × ${ex.reps}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
