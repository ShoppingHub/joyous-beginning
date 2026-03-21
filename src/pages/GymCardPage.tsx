import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";
import { ArrowLeft, Dumbbell, Plus, ChevronDown, ChevronUp, Pencil, X, Trash2, Check, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { GymProgram, GymProgramDay, GymMuscleGroup, GymProgramExercise, GymSession, GymSessionExercise } from "@/components/gym/types";
import { GymWizard } from "@/components/gym/GymWizard";
import { GymHistory } from "@/components/gym/GymHistory";

const WEEKDAY_KEYS = ["gym.weekday.mon", "gym.weekday.tue", "gym.weekday.wed", "gym.weekday.thu", "gym.weekday.fri", "gym.weekday.sat", "gym.weekday.sun"] as const;

const GymCardPage = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { getUserCard } = useUserCards();
  const userCard = getUserCard("gym");
  const areaId = userCard?.area_id;

  const [program, setProgram] = useState<GymProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Session state
  const today = format(new Date(), "yyyy-MM-dd");
  const [days, setDays] = useState<GymProgramDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [groups, setGroups] = useState<(GymMuscleGroup & { exercises: GymProgramExercise[] })[]>([]);
  const [dailyExercises, setDailyExercises] = useState<GymProgramExercise[]>([]);
  const [session, setSession] = useState<GymSession | null>(null);
  const [sessionExercises, setSessionExercises] = useState<Record<string, GymSessionExercise>>({});

  // Edit mode state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [addingGroupDayId, setAddingGroupDayId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingExercise, setEditingExercise] = useState<{ groupId: string; exercise?: GymProgramExercise } | null>(null);
  const [exForm, setExForm] = useState({ name: "", sets: "", reps: "", weight: "", daily: false, exerciseType: "strength" as "strength" | "cardio", duration: "", intensity: "" });
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<string | null>(null);

  // Weekly summary
  const [weekSessions, setWeekSessions] = useState<number>(0);
  const [weekTotal, setWeekTotal] = useState<number>(0);

  // Auto-save debounce refs
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
      const { data: lastSession } = await supabase.from("gym_sessions" as any).select("day_id").eq("area_id", areaId).eq("user_id", user.id).order("date", { ascending: false }).limit(1).single();
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

  useEffect(() => { fetchProgram(); }, [fetchProgram]);
  useEffect(() => { if (program) fetchSession(); }, [program, fetchSession]);

  // ─── Weekly summary ───
  const fetchWeeklySummary = useCallback(async () => {
    if (!user || !areaId || !program) return;
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const { data, count } = await supabase.from("gym_sessions" as any)
      .select("id", { count: "exact" })
      .eq("area_id", areaId)
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", weekEnd);
    setWeekSessions(count ?? 0);
    setWeekTotal(days.length || 0);
  }, [user, areaId, program, days.length]);

  useEffect(() => { fetchWeeklySummary(); }, [fetchWeeklySummary]);

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
    if (!selectedDayId || isEditing) return;
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

  const handleSelectDay = async (dayId: string) => {
    if (!user || dayId === selectedDayId) return;
    setSelectedDayId(dayId);
    if (session && session.day_id !== dayId) {
      await supabase.from("gym_sessions" as any).delete().eq("id", session.id);
      setSession(null);
      setSessionExercises({});
    }
    const { data } = await supabase.from("gym_sessions" as any)
      .upsert({ area_id: areaId, user_id: user.id, day_id: dayId, date: today } as any, { onConflict: "area_id,date" })
      .select("*").single();
    if (data) setSession(data as any);
    await loadDayData(dayId, data as any);
  };

  // ─── Auto-save for session values ───
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

  // ─── Edit mode actions ───
  const handleSaveGroupName = async (groupId: string) => {
    if (!editGroupName.trim()) return;
    await supabase.from("gym_muscle_groups" as any).update({ name: editGroupName.trim() } as any).eq("id", groupId);
    setEditingGroupId(null);
    if (selectedDayId) await loadDayData(selectedDayId, session);
  };

  const handleDeleteGroup = async (groupId: string, deleteExercises: boolean) => {
    if (deleteExercises) {
      await supabase.from("gym_program_exercises" as any).update({ active: false } as any).eq("group_id", groupId);
    }
    await supabase.from("gym_muscle_groups" as any).delete().eq("id", groupId);
    setDeleteGroupConfirm(null);
    if (selectedDayId) await loadDayData(selectedDayId, session);
  };

  const handleAddGroup = async (dayId: string) => {
    if (!newGroupName.trim()) return;
    const currentGroups = groups.length;
    await supabase.from("gym_muscle_groups" as any).insert({ day_id: dayId, name: newGroupName.trim(), order: currentGroups } as any);
    setAddingGroupDayId(null);
    setNewGroupName("");
    if (selectedDayId) await loadDayData(selectedDayId, session);
  };

  const handleSaveExercise = async () => {
    if (!editingExercise || !exForm.name.trim()) return;
    const isCardio = exForm.exerciseType === "cardio";
    if (!isCardio && (!parseInt(exForm.sets) || !parseInt(exForm.reps))) return;

    const payload: any = {
      name: exForm.name.trim(),
      exercise_type: exForm.exerciseType,
      is_daily: exForm.daily,
    };

    if (isCardio) {
      payload.sets = 1;
      payload.reps = 1;
      payload.duration_minutes = exForm.duration ? parseFloat(exForm.duration) : null;
      payload.intensity = exForm.intensity ? parseFloat(exForm.intensity) : null;
      payload.default_weight = null;
    } else {
      payload.sets = parseInt(exForm.sets);
      payload.reps = parseInt(exForm.reps);
      payload.default_weight = exForm.weight ? parseFloat(exForm.weight) : null;
      payload.duration_minutes = null;
      payload.intensity = null;
    }

    if (editingExercise.exercise) {
      await supabase.from("gym_program_exercises" as any).update(payload).eq("id", editingExercise.exercise.id);
    } else {
      payload.group_id = editingExercise.groupId;
      payload.order = groups.flatMap(g => g.exercises).length;
      await supabase.from("gym_program_exercises" as any).insert(payload as any);
    }

    setEditingExercise(null);
    if (selectedDayId) await loadDayData(selectedDayId, session);
  };

  const handleDeactivateExercise = async (exerciseId: string) => {
    await supabase.from("gym_program_exercises" as any).update({ active: false } as any).eq("id", exerciseId);
    if (selectedDayId) await loadDayData(selectedDayId, session);
  };

  const openExerciseForm = (groupId: string, exercise?: GymProgramExercise) => {
    setEditingExercise({ groupId, exercise });
    const isCardio = exercise?.exercise_type === "cardio";
    setExForm({
      name: exercise?.name || "",
      sets: exercise && !isCardio ? String(exercise.sets) : "",
      reps: exercise && !isCardio ? String(exercise.reps) : "",
      weight: exercise?.default_weight ? String(exercise.default_weight) : "",
      daily: exercise?.is_daily || false,
      exerciseType: exercise?.exercise_type || "strength",
      duration: exercise?.duration_minutes ? String(exercise.duration_minutes) : "",
      intensity: exercise?.intensity ? String(exercise.intensity) : "",
    });
  };

  // ─── Reorder helpers ───
  const handleMoveExercise = async (groupId: string, exerciseId: string, direction: "up" | "down") => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const idx = group.exercises.findIndex(e => e.id === exerciseId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= group.exercises.length) return;

    const exercises = [...group.exercises];
    [exercises[idx], exercises[newIdx]] = [exercises[newIdx], exercises[idx]];

    // Optimistic update
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, exercises } : g));

    // Persist
    await Promise.all(exercises.map((ex, i) =>
      supabase.from("gym_program_exercises" as any).update({ order: i } as any).eq("id", ex.id)
    ));
  };

  const handleMoveGroup = async (groupId: string, direction: "up" | "down") => {
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= groups.length) return;

    const newGroups = [...groups];
    [newGroups[idx], newGroups[newIdx]] = [newGroups[newIdx], newGroups[newIdx]];
    [newGroups[idx], newGroups[newIdx]] = [newGroups[newIdx], newGroups[idx]];

    // Fix: proper swap
    const g = [...groups];
    [g[idx], g[newIdx]] = [g[newIdx], g[idx]];
    setGroups(g);

    await Promise.all(g.map((gr, i) =>
      supabase.from("gym_muscle_groups" as any).update({ order: i } as any).eq("id", gr.id)
    ));
  };

  // ─── Weekday assignment ───
  const handleSetDayOfWeek = async (dayId: string, dayOfWeek: number | null) => {
    await supabase.from("gym_program_days" as any).update({ day_of_week: dayOfWeek } as any).eq("id", dayId);
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, day_of_week: dayOfWeek } : d));
  };

  const getWeekdayLabel = (dow: number | null): string => {
    if (dow === null || dow === undefined) return "";
    return t(WEEKDAY_KEYS[dow - 1] as any);
  };

  // ─── Formatters ───
  const formatExView = (ex: GymProgramExercise) => {
    if (ex.exercise_type === "cardio") {
      const parts: string[] = [];
      if (ex.duration_minutes) parts.push(`${ex.duration_minutes} min`);
      if (ex.intensity) parts.push(`int. ${ex.intensity}`);
      return parts.join(" · ") || "Cardio";
    }
    if (ex.default_weight && ex.default_weight > 0) return `${ex.sets} × ${ex.default_weight}kg`;
    return `${ex.sets} × ${ex.reps}`;
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
    if (w && w > 0) return `${ex.sets} × ${w}kg`;
    return `${ex.sets} × ${ex.reps}`;
  };

  // ─── Header ───
  const PageHeader = ({ showEdit = false }: { showEdit?: boolean }) => (
    <div className="relative flex items-center justify-center h-14">
      <button onClick={() => navigate("/cards")} className="absolute left-0 flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
        <ArrowLeft size={22} strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-2">
        <Dumbbell size={20} strokeWidth={1.5} className="text-primary" />
        <h1 className="text-[17px] font-semibold">{title}</h1>
      </div>
      {showEdit && (
        <button onClick={() => setIsEditing(!isEditing)}
          className="absolute right-0 flex items-center justify-center min-h-[44px] px-2 text-sm font-medium text-primary">
          {isEditing ? t("gym.done") : t("gym.edit")}
        </button>
      )}
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
      <PageHeader showEdit={!!program} />

      {/* Day tabs */}
      {days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {days.map(day => (
            <button key={day.id} onClick={() => handleSelectDay(day.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors min-h-[36px] flex items-center gap-1 ${
                day.id === selectedDayId ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border"
              }`}>
              {day.name}
              {day.day_of_week !== null && day.day_of_week !== undefined && (
                <span className={`text-[10px] font-normal ${day.id === selectedDayId ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                  {getWeekdayLabel(day.day_of_week)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Weekly summary */}
      {!isEditing && weekTotal > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Calendar size={14} className="text-muted-foreground" strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground">
            {t("gym.weeklySummary")}: <span className="font-semibold text-foreground">{weekSessions}/{weekTotal}</span> {t("gym.weeklySessions")}
          </span>
        </div>
      )}

      {/* ═══ VIEW MODE ═══ */}
      {!isEditing && (
        <>
          {allExercises.length === 0 ? (
            <div className="rounded-xl bg-card flex flex-col items-center justify-center py-6 gap-2 px-4">
              <p className="text-sm text-muted-foreground text-center">{t("gym.session.noExercises")}</p>
              <p className="text-xs text-muted-foreground text-center">{t("gym.session.noExercisesSub")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dailyExercises.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">{t("gym.daily")}</p>
                  {dailyExercises.map(ex => (
                    <SessionExerciseRow key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                      onToggle={() => handleToggleExercise(ex)} formatEx={formatExSession}
                      onValueChange={(field, val) => debouncedSave(ex, field, val)} />
                  ))}
                </div>
              )}
              {groups.filter(g => g.exercises.length > 0).map(group => (
                <div key={group.id}>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">{group.name}</p>
                  {group.exercises.map(ex => (
                    <SessionExerciseRow key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                      onToggle={() => handleToggleExercise(ex)} formatEx={formatExSession}
                      onValueChange={(field, val) => debouncedSave(ex, field, val)} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {program && areaId && <GymHistory areaId={areaId} programId={program.id} />}
        </>
      )}

      {/* ═══ EDIT MODE ═══ */}
      {isEditing && (
        <div className="flex flex-col gap-3">
          {/* Weekday assignment for selected day */}
          {selectedDayId && (
            <div className="rounded-xl bg-card p-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">{t("gym.weekday.assign")}</p>
              <div className="flex gap-1 flex-wrap">
                {WEEKDAY_KEYS.map((key, i) => {
                  const isoDay = i + 1; // 1=Mon ... 7=Sun
                  const selectedDay = days.find(d => d.id === selectedDayId);
                  const isAssigned = selectedDay?.day_of_week === isoDay;
                  const usedByOther = days.some(d => d.id !== selectedDayId && d.day_of_week === isoDay);
                  return (
                    <button key={isoDay}
                      onClick={() => handleSetDayOfWeek(selectedDayId, isAssigned ? null : isoDay)}
                      disabled={usedByOther}
                      className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        isAssigned ? "bg-primary text-primary-foreground" : usedByOther ? "bg-muted text-muted-foreground/40" : "bg-background text-muted-foreground hover:text-foreground ring-1 ring-border"
                      }`}>
                      {t(key as any)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily exercises with full editing */}
          {dailyExercises.length > 0 && (
            <div className="rounded-xl bg-card p-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">{t("gym.daily")}</p>
              {dailyExercises.map((ex, ei) => (
                <div key={ex.id}>
                  {editingExercise?.exercise?.id === ex.id ? (
                    <InlineExerciseForm form={exForm} onChange={setExForm} onSave={handleSaveExercise}
                      onCancel={() => setEditingExercise(null)} onDeactivate={() => handleDeactivateExercise(ex.id)} isEditing t={t} />
                  ) : (
                    <EditExerciseRow exercise={ex} formatEx={formatExView}
                      onEdit={() => openExerciseForm(ex.group_id, ex)}
                      onDeactivate={() => handleDeactivateExercise(ex.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Groups with reorder */}
          {groups.map((group, gi) => (
            <div key={group.id} className="rounded-xl bg-card p-3">
              {/* Group header */}
              {editingGroupId === group.id ? (
                <div className="flex items-center gap-2 mb-2">
                  <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)}
                    className="bg-background border-border flex-1 h-8 text-sm" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveGroupName(group.id); if (e.key === "Escape") setEditingGroupId(null); }} />
                  <button onClick={() => handleSaveGroupName(group.id)} className="text-primary min-h-[32px] px-1"><Check size={16} /></button>
                  <button onClick={() => setEditingGroupId(null)} className="text-muted-foreground min-h-[32px] px-1"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {/* Reorder group buttons */}
                    <div className="flex flex-col">
                      <button onClick={() => handleMoveGroup(group.id, "up")} disabled={gi === 0}
                        className="text-muted-foreground disabled:opacity-20 min-h-[20px] px-0.5 hover:text-foreground">
                        <ChevronUp size={12} />
                      </button>
                      <button onClick={() => handleMoveGroup(group.id, "down")} disabled={gi === groups.length - 1}
                        className="text-muted-foreground disabled:opacity-20 min-h-[20px] px-0.5 hover:text-foreground">
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{group.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }}
                      className="text-muted-foreground min-h-[32px] px-1 hover:text-foreground"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteGroupConfirm(group.id)}
                      className="text-muted-foreground min-h-[32px] px-1 hover:text-destructive"><Trash2 size={13} /></button>
                  </div>
                </div>
              )}

              {/* Delete group confirm */}
              {deleteGroupConfirm === group.id && (
                <div className="rounded-lg bg-background p-3 mb-2 flex flex-col gap-2">
                  <p className="text-sm">{t("gym.plan.deleteGroupConfirm")}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteGroup(group.id, true)}
                      className="flex-1 min-h-[36px] rounded-lg bg-destructive text-destructive-foreground text-xs font-medium">
                      {t("gym.plan.deleteGroupAll")}
                    </button>
                    <button onClick={() => setDeleteGroupConfirm(null)}
                      className="flex-1 min-h-[36px] rounded-lg ring-1 ring-border text-xs font-medium">
                      {t("gym.form.cancel")}
                    </button>
                  </div>
                </div>
              )}

              {/* Exercises with reorder */}
              {group.exercises.map((ex, ei) => (
                <div key={ex.id}>
                  {editingExercise?.exercise?.id === ex.id ? (
                    <InlineExerciseForm form={exForm} onChange={setExForm} onSave={handleSaveExercise}
                      onCancel={() => setEditingExercise(null)} onDeactivate={() => handleDeactivateExercise(ex.id)} isEditing t={t} />
                  ) : (
                    <EditExerciseRow exercise={ex} formatEx={formatExView}
                      onEdit={() => openExerciseForm(group.id, ex)}
                      onDeactivate={() => handleDeactivateExercise(ex.id)}
                      onMoveUp={ei > 0 ? () => handleMoveExercise(group.id, ex.id, "up") : undefined}
                      onMoveDown={ei < group.exercises.length - 1 ? () => handleMoveExercise(group.id, ex.id, "down") : undefined}
                    />
                  )}
                </div>
              ))}

              {/* Add exercise */}
              {editingExercise && !editingExercise.exercise && editingExercise.groupId === group.id ? (
                <InlineExerciseForm form={exForm} onChange={setExForm} onSave={handleSaveExercise}
                  onCancel={() => setEditingExercise(null)} t={t} />
              ) : (
                <button onClick={() => openExerciseForm(group.id)}
                  className="flex items-center gap-1 text-xs text-primary mt-1 min-h-[36px] hover:opacity-80">
                  <Plus size={14} /> {t("gym.addExercise")}
                </button>
              )}
            </div>
          ))}

          {/* Add group */}
          {selectedDayId && (
            addingGroupDayId === selectedDayId ? (
              <div className="flex items-center gap-2">
                <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t("gym.plan.groupPlaceholder")} className="bg-card border-border flex-1 h-9 text-sm" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddGroup(selectedDayId); if (e.key === "Escape") setAddingGroupDayId(null); }} />
                <button onClick={() => handleAddGroup(selectedDayId)} className="text-primary text-sm font-medium min-h-[36px] px-2">{t("gym.form.save")}</button>
                <button onClick={() => setAddingGroupDayId(null)} className="text-muted-foreground min-h-[36px] px-1"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => { setAddingGroupDayId(selectedDayId); setNewGroupName(""); }}
                className="flex items-center gap-1 text-sm text-primary min-h-[44px] hover:opacity-80">
                <Plus size={16} /> {t("gym.plan.addGroup")}
              </button>
            )
          )}
        </div>
      )}
    </motion.div>
  );
};

// ─── Session exercise row ───
function SessionExerciseRow({ exercise, sessionEx, onToggle, formatEx, onValueChange }: {
  exercise: GymProgramExercise;
  sessionEx?: GymSessionExercise;
  onToggle: () => void;
  formatEx: (ex: GymProgramExercise) => string;
  onValueChange: (field: string, value: number | null) => void;
}) {
  const completed = sessionEx?.completed ?? false;
  const isCardio = exercise.exercise_type === "cardio";

  const [localWeight, setLocalWeight] = useState<string>("");
  const [localDuration, setLocalDuration] = useState<string>("");
  const [localIntensity, setLocalIntensity] = useState<string>("");
  const [expandedField, setExpandedField] = useState<string | null>(null);

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
    <div className={`flex flex-col rounded-lg min-h-[44px] ${completed ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Checkbox checked={completed} onCheckedChange={onToggle} />
        <span className="text-sm font-medium flex-1">{exercise.name}</span>
        <button onClick={() => setExpandedField(expandedField ? null : (isCardio ? "duration" : "weight"))}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[32px] px-1">
          {formatEx(exercise)}
          <Pencil size={12} />
        </button>
      </div>

      <AnimatePresence>
        {expandedField && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="flex items-center gap-2 px-3 pb-2.5 pl-10">
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
              <button onClick={() => setExpandedField(null)} className="text-primary text-xs font-medium px-1 min-h-[28px]">
                <Check size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Edit mode exercise row with reorder ───
function EditExerciseRow({ exercise, formatEx, onEdit, onDeactivate, onMoveUp, onMoveDown }: {
  exercise: GymProgramExercise;
  formatEx: (ex: GymProgramExercise) => string;
  onEdit: () => void;
  onDeactivate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 group">
      <div className="flex items-center gap-1.5">
        {/* Reorder buttons */}
        <div className="flex flex-col">
          <button onClick={onMoveUp} disabled={!onMoveUp}
            className="text-muted-foreground disabled:opacity-20 min-h-[16px] px-0.5 hover:text-foreground">
            <ChevronUp size={11} />
          </button>
          <button onClick={onMoveDown} disabled={!onMoveDown}
            className="text-muted-foreground disabled:opacity-20 min-h-[16px] px-0.5 hover:text-foreground">
            <ChevronDown size={11} />
          </button>
        </div>
        <button onClick={onEdit} className="text-sm font-medium text-left hover:opacity-80">{exercise.name}</button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{formatEx(exercise)}</span>
        <button onClick={onDeactivate} className="text-muted-foreground hover:text-destructive min-h-[32px] px-1">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Inline exercise form ───
function InlineExerciseForm({ form, onChange, onSave, onCancel, onDeactivate, isEditing, t }: {
  form: { name: string; sets: string; reps: string; weight: string; daily: boolean; exerciseType: "strength" | "cardio"; duration: string; intensity: string };
  onChange: (f: typeof form) => void;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate?: () => void;
  isEditing?: boolean;
  t: (k: string) => string;
}) {
  const isCardio = form.exerciseType === "cardio";

  return (
    <div className="rounded-lg bg-background p-3 my-1 flex flex-col gap-3">
      <Input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder={t("gym.form.namePlaceholder")} className="bg-card border-border h-9 text-sm" autoFocus />

      <div className="flex rounded-lg bg-card p-0.5 gap-0.5">
        <button onClick={() => onChange({ ...form, exerciseType: "strength" })}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${!isCardio ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {t("gym.exerciseType.strength")}
        </button>
        <button onClick={() => onChange({ ...form, exerciseType: "cardio" })}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${isCardio ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {t("gym.exerciseType.cardio")}
        </button>
      </div>

      {isCardio ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground mb-0.5 block">{t("gym.form.duration")}</label>
            <Input type="number" inputMode="decimal" value={form.duration} onChange={(e) => onChange({ ...form, duration: e.target.value })}
              placeholder="—" className="bg-card border-border h-9 text-sm" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-0.5 block">{t("gym.form.intensity")}</label>
            <Input type="number" inputMode="decimal" value={form.intensity} onChange={(e) => onChange({ ...form, intensity: e.target.value })}
              placeholder="—" className="bg-card border-border h-9 text-sm" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground mb-0.5 block">{t("gym.form.sets")}</label>
            <Input type="number" inputMode="numeric" value={form.sets} onChange={(e) => onChange({ ...form, sets: e.target.value })} min={1} className="bg-card border-border h-9 text-sm" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-0.5 block">{t("gym.form.reps")}</label>
            <Input type="number" inputMode="numeric" value={form.reps} onChange={(e) => onChange({ ...form, reps: e.target.value })} min={1} className="bg-card border-border h-9 text-sm" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-0.5 block">{t("gym.form.weight")}</label>
            <Input type="number" inputMode="decimal" value={form.weight} onChange={(e) => onChange({ ...form, weight: e.target.value })} placeholder="—" className="bg-card border-border h-9 text-sm" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs">{t("gym.daily")}</p>
          <p className="text-[11px] text-muted-foreground">{t("gym.dailySub")}</p>
        </div>
        <Switch checked={form.daily} onCheckedChange={(v) => onChange({ ...form, daily: v })} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onSave}
          disabled={!form.name.trim() || (!isCardio && (!parseInt(form.sets) || !parseInt(form.reps)))}
          className="flex-1 min-h-[40px] rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">
          {t("gym.form.save")}
        </button>
        {isEditing && onDeactivate && (
          <button onClick={onDeactivate} className="min-h-[40px] px-3 rounded-lg text-destructive text-sm hover:opacity-80">
            <Trash2 size={16} />
          </button>
        )}
        <button onClick={onCancel} className="min-h-[40px] px-3 text-muted-foreground"><X size={18} /></button>
      </div>
    </div>
  );
}

export default GymCardPage;
