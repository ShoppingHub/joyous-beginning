import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";
import { ArrowLeft, Dumbbell, Settings, Check, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import type { GymProgram, GymProgramDay, GymMuscleGroup, GymProgramExercise, GymSession, GymSessionExercise } from "@/components/gym/types";
import { GymWizard } from "@/components/gym/GymWizard";

const GymCardPage = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { dayId: routeDayId } = useParams<{ dayId?: string }>();
  const { getUserCard } = useUserCards();
  const userCard = getUserCard("gym");
  const areaId = userCard?.area_id;

  const [program, setProgram] = useState<GymProgram | null>(null);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");
  const [days, setDays] = useState<GymProgramDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedDayName, setSelectedDayName] = useState<string>("");
  const [groups, setGroups] = useState<(GymMuscleGroup & { exercises: GymProgramExercise[] })[]>([]);
  const [dailyExercises, setDailyExercises] = useState<GymProgramExercise[]>([]);
  const [session, setSession] = useState<GymSession | null>(null);
  const [sessionExercises, setSessionExercises] = useState<Record<string, GymSessionExercise>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const title = locale === "it" ? "Scheda Palestra" : "Gym Card";

  // ─── Data fetching ───
  const fetchProgram = useCallback(async () => {
    if (!user || !areaId) { setLoading(false); return; }
    const { data } = await supabase.from("gym_programs" as any).select("*").eq("area_id", areaId).single();
    setProgram((data as any) || null);
    setLoading(false);
  }, [user, areaId]);

  const fetchSession = useCallback(async () => {
    if (!user || !program) return;
    const { data: daysData } = await supabase.from("gym_program_days" as any).select("*").eq("program_id", program.id).order("order", { ascending: true });
    const allDays = (daysData as any[] || []) as GymProgramDay[];
    setDays(allDays);
    if (allDays.length === 0) return;

    const { data: todaySession } = await supabase.from("gym_sessions" as any).select("*").eq("area_id", areaId).eq("date", today).single();
    let currentDayId: string;
    if (todaySession) {
      currentDayId = (todaySession as any).day_id;
      setSession(todaySession as any);
    } else {
      // First try to match today's weekday (ISO: 1=Mon..7=Sun)
      const { getISODay } = await import("date-fns");
      const todayWeekday = getISODay(new Date());
      const hasWeekdayAssignments = allDays.some(d => d.day_of_week != null);
      const weekdayMatch = hasWeekdayAssignments ? allDays.find(d => d.day_of_week === todayWeekday) : null;

      if (weekdayMatch) {
        currentDayId = weekdayMatch.id;
      } else {
        // Fallback to rotation
        const { data: lastSession } = await supabase.from("gym_sessions" as any).select("day_id").eq("area_id", areaId).eq("user_id", user.id).order("date", { ascending: false }).limit(1).single();
        if (lastSession) {
          const lastIdx = allDays.findIndex(d => d.id === (lastSession as any).day_id);
          currentDayId = allDays[(lastIdx + 1) % allDays.length].id;
        } else {
          currentDayId = allDays[0].id;
        }
      }
      setSession(null);
    }
    setSelectedDayId(currentDayId);
    const dayObj = allDays.find(d => d.id === currentDayId);
    setSelectedDayName(dayObj?.name || "");
    await loadDayData(currentDayId, todaySession as any);
  }, [user, program, areaId, today]);

  const loadDayData = async (dayId: string, existingSession?: GymSession | null) => {
    if (!program) return;
    const { data: groupsData } = await supabase.from("gym_muscle_groups" as any).select("*").eq("day_id", dayId).order("order", { ascending: true });
    const { data: allDaysData } = await supabase.from("gym_program_days" as any).select("id").eq("program_id", program.id);
    const allDayIds = (allDaysData as any[] || []).map((d: any) => d.id);
    const { data: allGroupsForDaily } = await supabase.from("gym_muscle_groups" as any).select("id").in("day_id", allDayIds);
    const allGroupIds = (allGroupsForDaily as any[] || []).map((g: any) => g.id);

    let exercisesData: any[] = [];
    if (allGroupIds.length > 0) {
      const { data } = await supabase.from("gym_program_exercises" as any).select("*").in("group_id", allGroupIds).eq("active", true).order("order", { ascending: true });
      exercisesData = (data as any[]) || [];
    }

    setDailyExercises(exercisesData.filter((e: any) => e.is_daily));
    setGroups((groupsData as any[] || []).map((g: any) => ({
      ...g,
      exercises: exercisesData.filter((e: any) => e.group_id === g.id && !e.is_daily),
    })));

    const sess = existingSession ?? session;
    if (sess) {
      const { data: sessExData } = await supabase.from("gym_session_exercises" as any).select("*").eq("session_id", sess.id);
      const map: Record<string, GymSessionExercise> = {};
      for (const se of (sessExData as any[] || [])) map[se.exercise_id] = se;
      setSessionExercises(map);
    } else {
      setSessionExercises({});
    }
  };

  useEffect(() => { fetchProgram(); track("card_opened", { card_type: "gym" }); }, [fetchProgram]);
  useEffect(() => { if (program) fetchSession(); }, [program, fetchSession]);

  // ─── Session actions ───
  const ensureSession = async (dayId: string): Promise<string | null> => {
    if (session) return session.id;
    if (!user) return null;
    const { data, error } = await supabase.from("gym_sessions" as any)
      .upsert({ area_id: areaId, user_id: user.id, day_id: dayId, date: today } as any, { onConflict: "area_id,date" })
      .select("*").single();
    if (error || !data) return null;
    setSession(data as any);
    return (data as any).id;
  };

  const handleAutoCheckIn = useCallback(async () => {
    if (!user || !areaId) return;
    await supabase.from("checkins").upsert({ area_id: areaId, user_id: user.id, date: today, completed: true }, { onConflict: "area_id,date" });
    track("session_gym_started");
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (authSession?.access_token) {
      supabase.functions.invoke("calculate-score", { body: { area_id: areaId, date: today }, headers: { Authorization: `Bearer ${authSession.access_token}` } }).catch(console.error);
    }
  }, [user, areaId, today]);

  const handleToggleExercise = async (exercise: GymProgramExercise) => {
    if (!selectedDayId) return;
    const existing = sessionExercises[exercise.id];
    const isFirstCompletion = !session && Object.values(sessionExercises).every(se => !se.completed);

    const sessionId = await ensureSession(selectedDayId);
    if (!sessionId) return;

    if (existing) {
      const newCompleted = !existing.completed;
      await supabase.from("gym_session_exercises" as any).update({ completed: newCompleted } as any).eq("id", existing.id);
      setSessionExercises(prev => ({ ...prev, [exercise.id]: { ...prev[exercise.id], completed: newCompleted } }));
      if (newCompleted && isFirstCompletion) handleAutoCheckIn();
    } else {
      const insertPayload: any = { session_id: sessionId, exercise_id: exercise.id, completed: true };
      if (exercise.exercise_type === "cardio") {
        insertPayload.duration_used = exercise.duration_minutes;
        insertPayload.intensity_used = exercise.intensity;
      } else {
        insertPayload.weight_used = exercise.default_weight;
      }
      const { data } = await supabase.from("gym_session_exercises" as any).insert(insertPayload).select("*").single();
      if (data) {
        setSessionExercises(prev => ({ ...prev, [exercise.id]: data as any }));
        if (isFirstCompletion || Object.values(sessionExercises).every(se => !se.completed)) handleAutoCheckIn();
      }
    }
  };

  const autoSaveSessionValue = async (exercise: GymProgramExercise, field: string, value: number | null) => {
    if (!selectedDayId) return;
    const sessionId = await ensureSession(selectedDayId);
    if (!sessionId) return;
    const existing = sessionExercises[exercise.id];
    if (existing) {
      await supabase.from("gym_session_exercises" as any).update({ [field]: value } as any).eq("id", existing.id);
      setSessionExercises(prev => ({ ...prev, [exercise.id]: { ...prev[exercise.id], [field]: value } }));
    } else {
      const insertPayload: any = { session_id: sessionId, exercise_id: exercise.id, completed: false, [field]: value };
      const { data } = await supabase.from("gym_session_exercises" as any).insert(insertPayload).select("*").single();
      if (data) setSessionExercises(prev => ({ ...prev, [exercise.id]: data as any }));
    }
    const defaultField = field === "weight_used" ? "default_weight" : field === "duration_used" ? "duration_minutes" : "intensity";
    await supabase.from("gym_program_exercises" as any).update({ [defaultField]: value } as any).eq("id", exercise.id);
  };

  const debouncedSave = (exercise: GymProgramExercise, field: string, value: number | null) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSaveSessionValue(exercise, field, value), 600);
  };

  const formatExSession = (ex: GymProgramExercise) => {
    const se = sessionExercises[ex.id];
    if (ex.exercise_type === "cardio") {
      const dur = se?.duration_used ?? ex.duration_minutes;
      const int_ = se?.intensity_used ?? ex.intensity;
      const parts: string[] = [];
      if (dur) parts.push(`${dur} min`);
      if (int_) parts.push(`int. ${int_}`);
      return parts.join(" · ") || "Cardio";
    }
    const w = se?.weight_used ?? ex.default_weight;
    if (w && w > 0) return `${ex.sets}×${w}kg`;
    return `${ex.sets}×${ex.reps}`;
  };

  // ─── Header ───
  const PageHeader = () => (
    <div className="relative flex items-center justify-center h-14">
      <button onClick={() => navigate("/cards")} className="absolute left-0 flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
        <ArrowLeft size={22} strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-2">
        <Dumbbell size={20} strokeWidth={1.5} className="text-primary" />
        <h1 className="text-[17px] font-semibold">{title}</h1>
      </div>
      <button onClick={() => navigate("/cards/gym/edit")}
        className="absolute right-0 flex items-center justify-center min-h-[44px] min-w-[44px]">
        <Settings size={18} strokeWidth={1.5} className="text-muted-foreground" />
      </button>
    </div>
  );

  // ─── Empty / loading states ───
  if (!loading && !areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <Dumbbell size={48} className="text-primary" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("cards.gym.empty")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("cards.gym.emptySub")}</p>
          <button onClick={() => navigate("/activities/new?type=health")}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base min-h-[44px]">
            {t("cards.gym.createArea")}
          </button>
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader />
        <div className="h-32 rounded-xl bg-card animate-pulse mt-4" />
      </div>
    );
  }

  if (!program && areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader />
        <GymWizard areaId={areaId} onCreated={fetchProgram} />
      </motion.div>
    );
  }

  const allExercises = [...dailyExercises, ...groups.flatMap(g => g.exercises)];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col px-4 pt-2 pb-24">
      <PageHeader />

      {/* Day label — read-only */}
      {selectedDayName && (
        <div className="mb-4 mt-1">
          <span className="text-sm font-semibold text-foreground">{selectedDayName}</span>
        </div>
      )}

      {/* Session checklist — mini-cards */}
      {allExercises.length === 0 ? (
        <div className="rounded-xl bg-card flex flex-col items-center justify-center py-6 gap-2 px-4">
          <p className="text-sm text-muted-foreground text-center">{t("gym.session.noExercises")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("gym.session.noExercisesSub")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dailyExercises.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("gym.daily")}</p>
              {dailyExercises.map(ex => (
                <ExerciseMiniCard key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                  onToggle={() => handleToggleExercise(ex)} formatEx={formatExSession}
                  onValueChange={(field, val) => debouncedSave(ex, field, val)} />
              ))}
            </div>
          )}
          {groups.filter(g => g.exercises.length > 0).map(group => (
            <div key={group.id} className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{group.name}</p>
              {group.exercises.map(ex => (
                <ExerciseMiniCard key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                  onToggle={() => handleToggleExercise(ex)} formatEx={formatExSession}
                  onValueChange={(field, val) => debouncedSave(ex, field, val)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ─── Exercise mini-card ───
function ExerciseMiniCard({ exercise, sessionEx, onToggle, formatEx, onValueChange }: {
  exercise: GymProgramExercise; sessionEx?: GymSessionExercise;
  onToggle: () => void; formatEx: (ex: GymProgramExercise) => string;
  onValueChange: (field: string, value: number | null) => void;
}) {
  const completed = sessionEx?.completed ?? false;
  const isCardio = exercise.exercise_type === "cardio";
  const [localWeight, setLocalWeight] = useState<string>("");
  const [localDuration, setLocalDuration] = useState<string>("");
  const [localIntensity, setLocalIntensity] = useState<string>("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLocalWeight(String(sessionEx?.weight_used ?? exercise.default_weight ?? ""));
    setLocalDuration(String(sessionEx?.duration_used ?? exercise.duration_minutes ?? ""));
    setLocalIntensity(String(sessionEx?.intensity_used ?? exercise.intensity ?? ""));
  }, [sessionEx, exercise]);

  const handleFieldChange = (field: string, raw: string, setter: (v: string) => void) => {
    setter(raw);
    const val = raw ? parseFloat(raw) : null;
    onValueChange(field, val);
  };

  return (
    <div className="rounded-xl bg-card border border-border p-3 flex flex-col gap-2">
      {/* Top row: name + detail + done */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium flex-1 truncate">{exercise.name}</span>
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-md min-h-[28px]"
        >
          <span>{formatEx(exercise)}</span>
          <Pencil size={11} />
        </button>
        <button
          onClick={onToggle}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
            completed
              ? "bg-primary/15 border-primary text-primary"
              : "border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          <Check size={16} strokeWidth={completed ? 2.5 : 1.5} />
        </button>
      </div>

      {/* Inline edit */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="flex items-center gap-2 pt-1">
              {isCardio ? (
                <>
                  <div className="flex items-center gap-1">
                    <Input type="number" inputMode="decimal" value={localDuration}
                      onChange={(e) => handleFieldChange("duration_used", e.target.value, setLocalDuration)}
                      className="w-16 h-7 text-xs bg-background border-border px-2" placeholder="min" />
                    <span className="text-[11px] text-muted-foreground">min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input type="number" inputMode="decimal" value={localIntensity}
                      onChange={(e) => handleFieldChange("intensity_used", e.target.value, setLocalIntensity)}
                      className="w-16 h-7 text-xs bg-background border-border px-2" placeholder="int." />
                    <span className="text-[11px] text-muted-foreground">int.</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <Input type="number" inputMode="decimal" value={localWeight}
                    onChange={(e) => handleFieldChange("weight_used", e.target.value, setLocalWeight)}
                    className="w-16 h-7 text-xs bg-background border-border px-2" />
                  <span className="text-[11px] text-muted-foreground">kg</span>
                </div>
              )}
              <button onClick={() => setEditing(false)} className="text-primary text-xs font-medium px-1 min-h-[28px]">
                <Check size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GymCardPage;
