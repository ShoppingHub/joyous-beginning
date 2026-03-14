import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { format } from "date-fns";
import { ChevronDown, Pencil } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { GymProgramDay, GymMuscleGroup, GymProgramExercise, GymSession as GymSessionType, GymSessionExercise } from "./types";

interface GymSessionProps {
  programId: string;
  areaId: string;
  onAutoCheckIn: () => void;
}

export function GymSessionView({ programId, areaId, onAutoCheckIn }: GymSessionProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const today = format(new Date(), "yyyy-MM-dd");

  const [days, setDays] = useState<GymProgramDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [groups, setGroups] = useState<(GymMuscleGroup & { exercises: GymProgramExercise[] })[]>([]);
  const [dailyExercises, setDailyExercises] = useState<GymProgramExercise[]>([]);
  const [session, setSession] = useState<GymSessionType | null>(null);
  const [sessionExercises, setSessionExercises] = useState<Record<string, GymSessionExercise>>({});
  const [loading, setLoading] = useState(true);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  // Weight edit drawer
  const [weightDrawer, setWeightDrawer] = useState<{ exercise: GymProgramExercise } | null>(null);
  const [weightValue, setWeightValue] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);

  const fetchSession = useCallback(async () => {
    if (!user) return;

    // Fetch days
    const { data: daysData } = await supabase
      .from("gym_program_days" as any)
      .select("*")
      .eq("program_id", programId)
      .order("order", { ascending: true });
    const allDays = (daysData as any[] || []) as GymProgramDay[];
    setDays(allDays);

    if (allDays.length === 0) { setLoading(false); return; }

    // Check existing today session
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
      // Auto-select next day based on last session
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
    setLoading(false);
  }, [user, programId, areaId, today]);

  const loadDayData = async (dayId: string, existingSession?: GymSessionType | null) => {
    // Load groups and exercises for this day
    const { data: groupsData } = await supabase
      .from("gym_muscle_groups" as any)
      .select("*")
      .eq("day_id", dayId)
      .order("order", { ascending: true });

    const gIds = (groupsData as any[] || []).map((g: any) => g.id);

    // Also get all daily exercises from ALL days
    const { data: allDaysData } = await supabase
      .from("gym_program_days" as any)
      .select("id")
      .eq("program_id", programId);
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

    const dailyExs = exercisesData.filter((e: any) => e.is_daily);
    setDailyExercises(dailyExs);

    const dayGroupsWithExercises = (groupsData as any[] || []).map((g: any) => ({
      ...g,
      exercises: exercisesData.filter((e: any) => e.group_id === g.id && !e.is_daily),
    }));
    setGroups(dayGroupsWithExercises);

    // Load session exercises if session exists
    const sess = existingSession ?? session;
    if (sess) {
      const { data: sessExData } = await supabase
        .from("gym_session_exercises" as any)
        .select("*")
        .eq("session_id", sess.id);
      const map: Record<string, GymSessionExercise> = {};
      for (const se of (sessExData as any[] || [])) {
        map[se.exercise_id] = se;
      }
      setSessionExercises(map);
    } else {
      setSessionExercises({});
    }
  };

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const ensureSession = async (dayId: string): Promise<string | null> => {
    if (session) return session.id;
    if (!user) return null;

    // Upsert session for today
    const { data, error } = await supabase
      .from("gym_sessions" as any)
      .upsert({
        area_id: areaId,
        user_id: user.id,
        day_id: dayId,
        date: today,
      } as any, { onConflict: "area_id,date" })
      .select("*")
      .single();

    if (error || !data) return null;
    setSession(data as any);
    return (data as any).id;
  };

  const handleToggleExercise = async (exercise: GymProgramExercise) => {
    if (!selectedDayId) return;
    const existing = sessionExercises[exercise.id];
    const isFirstCompletion = !session && Object.keys(sessionExercises).filter(k => sessionExercises[k].completed).length === 0;

    const sessionId = await ensureSession(selectedDayId);
    if (!sessionId) return;

    if (existing) {
      const newCompleted = !existing.completed;
      await supabase.from("gym_session_exercises" as any)
        .update({ completed: newCompleted } as any)
        .eq("id", existing.id);
      setSessionExercises(prev => ({
        ...prev,
        [exercise.id]: { ...prev[exercise.id], completed: newCompleted },
      }));
      if (newCompleted && isFirstCompletion) onAutoCheckIn();
    } else {
      const { data } = await supabase.from("gym_session_exercises" as any)
        .insert({
          session_id: sessionId,
          exercise_id: exercise.id,
          weight_used: exercise.default_weight,
          completed: true,
        } as any)
        .select("*")
        .single();
      if (data) {
        setSessionExercises(prev => ({ ...prev, [exercise.id]: data as any }));
        if (isFirstCompletion || Object.values(sessionExercises).every(se => !se.completed)) {
          onAutoCheckIn();
        }
      }
    }
  };

  const handleSelectDay = async (dayId: string) => {
    setDayPickerOpen(false);
    setSelectedDayId(dayId);

    if (!user) return;
    // Delete existing today session if different day
    if (session && session.day_id !== dayId) {
      await supabase.from("gym_sessions" as any).delete().eq("id", session.id);
      setSession(null);
      setSessionExercises({});
    }

    // Create or load session for selected day
    const { data } = await supabase
      .from("gym_sessions" as any)
      .upsert({
        area_id: areaId,
        user_id: user!.id,
        day_id: dayId,
        date: today,
      } as any, { onConflict: "area_id,date" })
      .select("*")
      .single();
    if (data) setSession(data as any);

    await loadDayData(dayId, data as any);
  };

  const handleOpenWeight = (exercise: GymProgramExercise) => {
    const se = sessionExercises[exercise.id];
    const currentWeight = se?.weight_used ?? exercise.default_weight;
    setWeightValue(currentWeight && currentWeight > 0 ? String(currentWeight) : "");
    setWeightDrawer({ exercise });
  };

  const handleSaveWeight = async () => {
    if (!weightDrawer || !selectedDayId) return;
    setWeightSaving(true);
    const newWeight = weightValue ? parseFloat(weightValue) : null;
    const ex = weightDrawer.exercise;

    const sessionId = await ensureSession(selectedDayId);
    if (!sessionId) { setWeightSaving(false); return; }

    // Upsert session exercise
    const existing = sessionExercises[ex.id];
    if (existing) {
      await supabase.from("gym_session_exercises" as any).update({ weight_used: newWeight } as any).eq("id", existing.id);
      setSessionExercises(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], weight_used: newWeight } }));
    } else {
      const { data } = await supabase.from("gym_session_exercises" as any)
        .insert({ session_id: sessionId, exercise_id: ex.id, weight_used: newWeight, completed: false } as any)
        .select("*").single();
      if (data) setSessionExercises(prev => ({ ...prev, [ex.id]: data as any }));
    }

    // Update default weight in program
    await supabase.from("gym_program_exercises" as any).update({ default_weight: newWeight } as any).eq("id", ex.id);

    setWeightDrawer(null);
    setWeightSaving(false);
  };

  const handleDeactivateFromWeight = async () => {
    if (!weightDrawer) return;
    setWeightSaving(true);
    await supabase.from("gym_program_exercises" as any).update({ active: false } as any).eq("id", weightDrawer.exercise.id);
    setWeightDrawer(null);
    setWeightSaving(false);
    // Refresh
    if (selectedDayId) await loadDayData(selectedDayId, session);
  };

  const formatEx = (ex: GymProgramExercise) => {
    const se = sessionExercises[ex.id];
    const w = se?.weight_used ?? ex.default_weight;
    if (w && w > 0) return `${ex.sets} × ${w}kg`;
    return `${ex.sets} × ${ex.reps}`;
  };

  const selectedDay = days.find(d => d.id === selectedDayId);
  const allExercises = [...dailyExercises, ...groups.flatMap(g => g.exercises)];
  const hasExercises = allExercises.length > 0;

  if (loading) {
    return <div className="h-20 rounded-lg bg-card animate-pulse" />;
  }

  return (
    <>
      {/* Day selector */}
      {days.length > 1 && (
        <button onClick={() => setDayPickerOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium min-h-[36px] hover:opacity-80">
          {selectedDay?.name || "—"} <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      )}

      {/* Checklist */}
      {!hasExercises ? (
        <div className="rounded-lg bg-card flex flex-col items-center justify-center py-6 gap-2 px-4">
          <p className="text-sm text-muted-foreground text-center">{t("gym.session.noExercises")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("gym.session.noExercisesSub")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Daily exercises */}
          {dailyExercises.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{t("gym.daily")}</p>
              {dailyExercises.map(ex => (
                <ExerciseRow key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                  onToggle={() => handleToggleExercise(ex)}
                  onEditWeight={() => handleOpenWeight(ex)}
                  formatEx={formatEx} />
              ))}
            </div>
          )}

          {/* Groups */}
          {groups.filter(g => g.exercises.length > 0).map(group => (
            <div key={group.id}>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{group.name}</p>
              {group.exercises.map(ex => (
                <ExerciseRow key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                  onToggle={() => handleToggleExercise(ex)}
                  onEditWeight={() => handleOpenWeight(ex)}
                  formatEx={formatEx} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Day picker */}
      <Drawer open={dayPickerOpen} onOpenChange={setDayPickerOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader><DrawerTitle>{t("gym.session.selectDay")}</DrawerTitle></DrawerHeader>
          <div className="px-4 pb-4 flex flex-col gap-1">
            {days.map(day => (
              <button key={day.id} onClick={() => handleSelectDay(day.id)}
                className={`text-left px-3 py-3 rounded-lg min-h-[44px] text-sm ${day.id === selectedDayId ? "bg-primary/20 text-primary font-medium" : "hover:bg-background"}`}>
                {day.name}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Weight edit drawer */}
      <Drawer open={!!weightDrawer} onOpenChange={(o) => !o && setWeightDrawer(null)}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader><DrawerTitle>{t("gym.form.weight")}</DrawerTitle></DrawerHeader>
          <div className="px-4">
            <Input type="number" inputMode="decimal" value={weightValue} onChange={(e) => setWeightValue(e.target.value)}
              placeholder={t("gym.form.weightPlaceholder")} className="bg-background border-border" />
          </div>
          <DrawerFooter className="flex flex-col gap-2">
            <button onClick={handleSaveWeight} disabled={weightSaving}
              className="w-full min-h-[48px] rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40">
              {t("gym.form.save")}
            </button>
            <button onClick={handleDeactivateFromWeight} disabled={weightSaving}
              className="w-full min-h-[44px] rounded-lg text-destructive font-medium text-sm hover:opacity-80 disabled:opacity-40">
              {t("gym.plan.deactivate")}
            </button>
            <button onClick={() => setWeightDrawer(null)} className="w-full min-h-[44px] text-sm text-muted-foreground">
              {t("gym.form.cancel")}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function ExerciseRow({ exercise, sessionEx, onToggle, onEditWeight, formatEx }: {
  exercise: GymProgramExercise;
  sessionEx?: GymSessionExercise;
  onToggle: () => void;
  onEditWeight: () => void;
  formatEx: (ex: GymProgramExercise) => string;
}) {
  const completed = sessionEx?.completed ?? false;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg min-h-[44px] ${completed ? "opacity-50" : ""}`}>
      <Checkbox checked={completed} onCheckedChange={onToggle} />
      <span className="text-sm font-medium flex-1">{exercise.name}</span>
      <button onClick={onEditWeight} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[32px] px-1">
        {formatEx(exercise)}
        <Pencil size={12} />
      </button>
    </div>
  );
}
