import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";
import { ArrowLeft, Dumbbell, Pencil, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { GymHistory } from "@/components/gym/GymHistory";
import { GymWizard } from "@/components/gym/GymWizard";
import type {
  GymProgram,
  GymProgramDay,
  GymMuscleGroup,
  GymProgramExercise,
  GymSession,
  GymSessionExercise,
} from "@/components/gym/types";

const GymSessionPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { getUserCard } = useUserCards();
  const userCard = getUserCard("gym");
  const areaId = userCard?.area_id;
  const today = format(new Date(), "yyyy-MM-dd");

  const [program, setProgram] = useState<GymProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<GymProgramDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [groups, setGroups] = useState<(GymMuscleGroup & { exercises: GymProgramExercise[] })[]>([]);
  const [dailyExercises, setDailyExercises] = useState<GymProgramExercise[]>([]);
  const [session, setSession] = useState<GymSession | null>(null);
  const [sessionExercises, setSessionExercises] = useState<Record<string, GymSessionExercise>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ─── Fetch program ───
  const fetchProgram = useCallback(async () => {
    if (!user || !areaId) { setLoading(false); return; }
    const { data } = await supabase
      .from("gym_programs" as any)
      .select("*")
      .eq("area_id", areaId)
      .single();
    setProgram((data as any) || null);
    setLoading(false);
  }, [user, areaId]);

  // ─── Fetch days + today session ───
  const fetchDaysAndSession = useCallback(async () => {
    if (!user || !program) return;

    const { data: daysData } = await supabase
      .from("gym_program_days" as any)
      .select("*")
      .eq("program_id", program.id)
      .order("order", { ascending: true });
    const allDays = (daysData as any[] || []) as GymProgramDay[];
    setDays(allDays);
    if (allDays.length === 0) return;

    const { data: todaySession } = await supabase
      .from("gym_sessions" as any)
      .select("*")
      .eq("area_id", areaId)
      .eq("date", today)
      .single();

    let currentDayId: string;
    if (todaySession) {
      currentDayId = (todaySession as any).day_id;
      setSession(todaySession as any);
    } else {
      const { data: lastSession } = await supabase
        .from("gym_sessions" as any)
        .select("day_id")
        .eq("area_id", areaId)
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .single();
      if (lastSession) {
        const lastIdx = allDays.findIndex(d => d.id === (lastSession as any).day_id);
        currentDayId = allDays[(lastIdx + 1) % allDays.length].id;
      } else {
        currentDayId = allDays[0].id;
      }
      setSession(null);
    }
    setSelectedDayId(currentDayId);
    await loadDayData(currentDayId, todaySession as any);
  }, [user, program, areaId, today]);

  // ─── Load exercises for a day ───
  const loadDayData = async (dayId: string, existingSession?: GymSession | null) => {
    if (!program) return;

    const { data: groupsData } = await supabase
      .from("gym_muscle_groups" as any)
      .select("*")
      .eq("day_id", dayId)
      .order("order", { ascending: true });

    // Load daily exercises from ALL days
    const { data: allDaysData } = await supabase
      .from("gym_program_days" as any)
      .select("id")
      .eq("program_id", program.id);
    const allDayIds = (allDaysData as any[] || []).map((d: any) => d.id);
    const { data: allGroupsForDaily } = await supabase
      .from("gym_muscle_groups" as any)
      .select("id")
      .in("day_id", allDayIds);
    const allGroupIds = (allGroupsForDaily as any[] || []).map((g: any) => g.id);

    let exercisesData: any[] = [];
    if (allGroupIds.length > 0) {
      const { data } = await supabase
        .from("gym_program_exercises" as any)
        .select("*")
        .in("group_id", allGroupIds)
        .eq("active", true)
        .order("order", { ascending: true });
      exercisesData = (data as any[]) || [];
    }

    setDailyExercises(exercisesData.filter((e: any) => e.is_daily));
    setGroups((groupsData as any[] || []).map((g: any) => ({
      ...g,
      exercises: exercisesData.filter((e: any) => e.group_id === g.id && !e.is_daily),
    })));

    const sess = existingSession ?? session;
    if (sess) {
      const { data: sessExData } = await supabase
        .from("gym_session_exercises" as any)
        .select("*")
        .eq("session_id", sess.id);
      const map: Record<string, GymSessionExercise> = {};
      for (const se of (sessExData as any[] || [])) map[se.exercise_id] = se;
      setSessionExercises(map);
    } else {
      setSessionExercises({});
    }
  };

  useEffect(() => {
    fetchProgram();
    track("card_opened", { card_type: "gym_session" });
  }, [fetchProgram]);

  useEffect(() => {
    if (program) fetchDaysAndSession();
  }, [program, fetchDaysAndSession]);

  // ─── Session helpers ───
  const ensureSession = async (dayId: string): Promise<string | null> => {
    if (session) return session.id;
    if (!user) return null;
    const { data, error } = await supabase
      .from("gym_sessions" as any)
      .upsert(
        { area_id: areaId, user_id: user.id, day_id: dayId, date: today } as any,
        { onConflict: "area_id,date" }
      )
      .select("*")
      .single();
    if (error || !data) return null;
    setSession(data as any);
    return (data as any).id;
  };

  const handleAutoCheckIn = useCallback(async () => {
    if (!user || !areaId) return;
    await supabase
      .from("checkins")
      .upsert(
        { area_id: areaId, user_id: user.id, date: today, completed: true },
        { onConflict: "area_id,date" }
      );
    track("session_gym_started");
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (authSession?.access_token) {
      supabase.functions
        .invoke("calculate-score", {
          body: { area_id: areaId, date: today },
          headers: { Authorization: `Bearer ${authSession.access_token}` },
        })
        .catch(console.error);
    }
  }, [user, areaId, today]);

  const handleToggleExercise = async (exercise: GymProgramExercise) => {
    if (!selectedDayId) return;
    const existing = sessionExercises[exercise.id];
    const isFirstCompletion =
      !session && Object.values(sessionExercises).every(se => !se.completed);

    const sessionId = await ensureSession(selectedDayId);
    if (!sessionId) return;

    if (existing) {
      const newCompleted = !existing.completed;
      await supabase
        .from("gym_session_exercises" as any)
        .update({ completed: newCompleted } as any)
        .eq("id", existing.id);
      setSessionExercises(prev => ({
        ...prev,
        [exercise.id]: { ...prev[exercise.id], completed: newCompleted },
      }));
      if (newCompleted && isFirstCompletion) handleAutoCheckIn();
    } else {
      const insertPayload: any = {
        session_id: sessionId,
        exercise_id: exercise.id,
        completed: true,
      };
      if (exercise.exercise_type === "cardio") {
        insertPayload.duration_used = exercise.duration_minutes;
        insertPayload.intensity_used = exercise.intensity;
      } else {
        insertPayload.weight_used = exercise.default_weight;
      }
      const { data } = await supabase
        .from("gym_session_exercises" as any)
        .insert(insertPayload)
        .select("*")
        .single();
      if (data) {
        setSessionExercises(prev => ({ ...prev, [exercise.id]: data as any }));
        if (isFirstCompletion || Object.values(sessionExercises).every(se => !se.completed)) {
          handleAutoCheckIn();
        }
      }
    }
  };

  const handleSelectDay = async (dayId: string) => {
    if (!user || dayId === selectedDayId) return;
    setSelectedDayId(dayId);
    if (session && session.day_id !== dayId) {
      await supabase.from("gym_sessions" as any).delete().eq("id", session.id);
      setSession(null);
      setSessionExercises({});
    }
    const { data } = await supabase
      .from("gym_sessions" as any)
      .upsert(
        { area_id: areaId, user_id: user.id, day_id: dayId, date: today } as any,
        { onConflict: "area_id,date" }
      )
      .select("*")
      .single();
    if (data) setSession(data as any);
    await loadDayData(dayId, data as any);
  };

  // ─── Auto-save weight / duration / intensity ───
  const autoSaveValue = async (
    exercise: GymProgramExercise,
    field: string,
    value: number | null
  ) => {
    if (!selectedDayId) return;
    const sessionId = await ensureSession(selectedDayId);
    if (!sessionId) return;

    const existing = sessionExercises[exercise.id];
    if (existing) {
      await supabase
        .from("gym_session_exercises" as any)
        .update({ [field]: value } as any)
        .eq("id", existing.id);
      setSessionExercises(prev => ({
        ...prev,
        [exercise.id]: { ...prev[exercise.id], [field]: value },
      }));
    } else {
      const insertPayload: any = {
        session_id: sessionId,
        exercise_id: exercise.id,
        completed: false,
        [field]: value,
      };
      const { data } = await supabase
        .from("gym_session_exercises" as any)
        .insert(insertPayload)
        .select("*")
        .single();
      if (data) setSessionExercises(prev => ({ ...prev, [exercise.id]: data as any }));
    }
    // Also update the program default so next session starts with this value
    const defaultField =
      field === "weight_used"
        ? "default_weight"
        : field === "duration_used"
        ? "duration_minutes"
        : "intensity";
    await supabase
      .from("gym_program_exercises" as any)
      .update({ [defaultField]: value } as any)
      .eq("id", exercise.id);
  };

  const debouncedSave = (exercise: GymProgramExercise, field: string, value: number | null) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSaveValue(exercise, field, value), 600);
  };

  // ─── Computed ───
  const allExercises = [...dailyExercises, ...groups.flatMap(g => g.exercises)];
  const completedCount = allExercises.filter(ex => sessionExercises[ex.id]?.completed).length;
  const totalCount = allExercises.length;
  const selectedDay = days.find(d => d.id === selectedDayId);

  // ─── Edge states ───
  if (!loading && !areaId) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <Header onBack={() => navigate("/")} t={t} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
          <Dumbbell size={40} className="text-primary" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("cards.gym.empty")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("cards.gym.emptySub")}</p>
          <button
            onClick={() => navigate("/activities/new?type=health")}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            {t("cards.gym.createArea")}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <div className="h-14" />
        <div className="flex flex-col gap-3 mt-4">
          <div className="h-8 w-40 rounded-lg bg-card animate-pulse" />
          <div className="h-2 rounded-full bg-card animate-pulse" />
          <div className="h-32 rounded-xl bg-card animate-pulse" />
        </div>
      </div>
    );
  }

  if (!program && areaId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col px-4 pt-2 pb-8"
      >
        <Header onBack={() => navigate("/")} t={t} />
        <GymWizard areaId={areaId} onCreated={fetchProgram} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col px-4 pt-2 pb-24"
    >
      <Header onBack={() => navigate("/")} t={t} />

      {/* Day name + group subtitle */}
      <div className="mb-3">
        <h1 className="text-xl font-bold leading-tight">{selectedDay?.name || "—"}</h1>
        {groups.filter(g => g.exercises.length > 0).length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {groups.filter(g => g.exercises.length > 0).map(g => g.name).join(", ")}
          </p>
        )}
      </div>

      {/* Day tabs (scrollable) */}
      {days.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
          {days.map(day => (
            <button
              key={day.id}
              onClick={() => handleSelectDay(day.id)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors min-h-[30px] ${
                day.id === selectedDayId
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
              }`}
            >
              {day.name}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {completedCount}/{totalCount} {t("gym.session.completed")}
          </span>
        </div>
      )}

      {/* Exercise list */}
      {totalCount === 0 ? (
        <div className="rounded-xl bg-card flex flex-col items-center justify-center py-8 gap-3 px-4">
          <p className="text-sm text-muted-foreground text-center">{t("gym.session.noExercises")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("gym.session.noExercisesSub")}</p>
          <button
            onClick={() => navigate("/cards/gym")}
            className="text-sm text-primary font-medium min-h-[36px] hover:opacity-80"
          >
            {t("gym.session.setupPlan")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Daily exercises */}
          {dailyExercises.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {t("gym.daily")}
              </p>
              <div className="flex flex-col rounded-xl bg-card overflow-hidden divide-y divide-border/50">
                {dailyExercises.map(ex => (
                  <SessionExRow
                    key={ex.id}
                    exercise={ex}
                    sessionEx={sessionExercises[ex.id]}
                    onToggle={() => handleToggleExercise(ex)}
                    onValueChange={(field, val) => debouncedSave(ex, field, val)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {groups
            .filter(g => g.exercises.length > 0)
            .map(group => (
              <div key={group.id}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {group.name}
                </p>
                <div className="flex flex-col rounded-xl bg-card overflow-hidden divide-y divide-border/50">
                  {group.exercises.map(ex => (
                    <SessionExRow
                      key={ex.id}
                      exercise={ex}
                      sessionEx={sessionExercises[ex.id]}
                      onToggle={() => handleToggleExercise(ex)}
                      onValueChange={(field, val) => debouncedSave(ex, field, val)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* History */}
      {program && areaId && <GymHistory areaId={areaId} programId={program.id} />}
    </motion.div>
  );
};

// ─── Header ───
function Header({ onBack, t }: { onBack: () => void; t: (k: string) => string }) {
  return (
    <div className="relative flex items-center justify-center h-14">
      <button
        onClick={onBack}
        className="absolute left-0 flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]"
      >
        <ArrowLeft size={22} strokeWidth={1.5} />
      </button>
      <span className="text-sm text-muted-foreground font-medium">{t("gym.session.pageTitle")}</span>
    </div>
  );
}

// ─── Session exercise row — task manager style ───
function SessionExRow({
  exercise,
  sessionEx,
  onToggle,
  onValueChange,
}: {
  exercise: GymProgramExercise;
  sessionEx?: GymSessionExercise;
  onToggle: () => void;
  onValueChange: (field: string, value: number | null) => void;
}) {
  const completed = sessionEx?.completed ?? false;
  const isCardio = exercise.exercise_type === "cardio";
  const [localWeight, setLocalWeight] = useState("");
  const [localDuration, setLocalDuration] = useState("");
  const [localIntensity, setLocalIntensity] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLocalWeight(String(sessionEx?.weight_used ?? exercise.default_weight ?? ""));
    setLocalDuration(String(sessionEx?.duration_used ?? exercise.duration_minutes ?? ""));
    setLocalIntensity(String(sessionEx?.intensity_used ?? exercise.intensity ?? ""));
  }, [sessionEx, exercise]);

  const formatValue = () => {
    if (isCardio) {
      const dur = sessionEx?.duration_used ?? exercise.duration_minutes;
      const int_ = sessionEx?.intensity_used ?? exercise.intensity;
      const parts: string[] = [];
      if (dur) parts.push(`${dur} min`);
      if (int_) parts.push(`int. ${int_}`);
      return parts.join(" · ") || "Cardio";
    }
    const w = sessionEx?.weight_used ?? exercise.default_weight;
    if (w && w > 0) return `${exercise.sets} × ${w}kg`;
    return `${exercise.sets} × ${exercise.reps}`;
  };

  return (
    <div>
      <div className={`flex items-center gap-3 px-4 py-3.5 min-h-[52px] ${completed ? "opacity-50" : ""}`}>
        <Checkbox
          checked={completed}
          onCheckedChange={onToggle}
          className="h-5 w-5 rounded-full shrink-0"
        />
        <span
          className={`text-sm flex-1 ${
            completed ? "line-through text-muted-foreground" : "font-medium"
          }`}
        >
          {exercise.name}
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[32px] px-1 shrink-0 transition-colors"
        >
          {formatValue()}
          <Pencil size={11} className="ml-0.5" />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 pb-3.5 pl-12">
              {isCardio ? (
                <>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={localDuration}
                      onChange={e => {
                        setLocalDuration(e.target.value);
                        onValueChange("duration_used", e.target.value ? parseFloat(e.target.value) : null);
                      }}
                      className="w-16 h-7 text-xs bg-background border-border px-2"
                      placeholder="min"
                    />
                    <span className="text-[11px] text-muted-foreground">min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={localIntensity}
                      onChange={e => {
                        setLocalIntensity(e.target.value);
                        onValueChange("intensity_used", e.target.value ? parseFloat(e.target.value) : null);
                      }}
                      className="w-16 h-7 text-xs bg-background border-border px-2"
                      placeholder="int."
                    />
                    <span className="text-[11px] text-muted-foreground">int.</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={localWeight}
                    onChange={e => {
                      setLocalWeight(e.target.value);
                      onValueChange("weight_used", e.target.value ? parseFloat(e.target.value) : null);
                    }}
                    className="w-16 h-7 text-xs bg-background border-border px-2"
                  />
                  <span className="text-[11px] text-muted-foreground">kg</span>
                </div>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="text-primary min-h-[28px] px-1 hover:opacity-80"
              >
                <Check size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GymSessionPage;
