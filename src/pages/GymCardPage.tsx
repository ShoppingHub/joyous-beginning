import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";
import { ArrowLeft, Dumbbell, Plus, ChevronDown, ChevronUp, Pencil, X, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { GymProgram, GymProgramDay, GymMuscleGroup, GymProgramExercise, GymSession, GymSessionExercise } from "@/components/gym/types";
import { GymWizard } from "@/components/gym/GymWizard";
import { GymHistory } from "@/components/gym/GymHistory";

const GymCardPage = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { getUserCard } = useUserCards();
  const userCard = getUserCard("gym");
  const areaId = userCard?.area_id;

  const [program, setProgram] = useState<GymProgram | null>(null);
  const [loading, setLoading] = useState(true);

  // Session state
  const today = format(new Date(), "yyyy-MM-dd");
  const [days, setDays] = useState<GymProgramDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [groups, setGroups] = useState<(GymMuscleGroup & { exercises: GymProgramExercise[] })[]>([]);
  const [dailyExercises, setDailyExercises] = useState<GymProgramExercise[]>([]);
  const [session, setSession] = useState<GymSession | null>(null);
  const [sessionExercises, setSessionExercises] = useState<Record<string, GymSessionExercise>>({});

  // Inline weight editing
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [weightValue, setWeightValue] = useState("");

  // Plan editing state
  const [planExpanded, setPlanExpanded] = useState(false);
  const [expandedPlanDay, setExpandedPlanDay] = useState<string | null>(null);
  const [planDays, setPlanDays] = useState<(GymProgramDay & { groups: (GymMuscleGroup & { exercises: GymProgramExercise[] })[] })[]>([]);

  // Inline add group
  const [addingGroupDayId, setAddingGroupDayId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  // Inline add/edit exercise
  const [editingExercise, setEditingExercise] = useState<{ groupId: string; exercise?: GymProgramExercise } | null>(null);
  const [exForm, setExForm] = useState({ name: "", sets: "", reps: "", weight: "", daily: false });

  const title = locale === "it" ? "Scheda Palestra" : "Gym Card";

  // Fetch program
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

  // Fetch session data
  const fetchSession = useCallback(async () => {
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

  const loadDayData = async (dayId: string, existingSession?: GymSession | null) => {
    if (!program) return;
    const { data: groupsData } = await supabase
      .from("gym_muscle_groups" as any)
      .select("*")
      .eq("day_id", dayId)
      .order("order", { ascending: true });

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

  // Fetch plan data for editing
  const fetchPlan = useCallback(async () => {
    if (!program) return;
    const { data: daysData } = await supabase
      .from("gym_program_days" as any)
      .select("*")
      .eq("program_id", program.id)
      .order("order", { ascending: true });
    if (!daysData || (daysData as any[]).length === 0) { setPlanDays([]); return; }

    const dayIds = (daysData as any[]).map((d: any) => d.id);
    const { data: groupsData } = await supabase
      .from("gym_muscle_groups" as any)
      .select("*")
      .in("day_id", dayIds)
      .order("order", { ascending: true });

    const groupIds = (groupsData as any[] || []).map((g: any) => g.id);
    let exercisesData: any[] = [];
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from("gym_program_exercises" as any)
        .select("*")
        .in("group_id", groupIds)
        .eq("active", true)
        .order("order", { ascending: true });
      exercisesData = (data as any[]) || [];
    }

    setPlanDays((daysData as any[]).map((day: any) => ({
      ...day,
      groups: (groupsData as any[] || [])
        .filter((g: any) => g.day_id === day.id)
        .map((g: any) => ({
          ...g,
          exercises: exercisesData.filter((e: any) => e.group_id === g.id),
        })),
    })));
  }, [program]);

  useEffect(() => { fetchProgram(); }, [fetchProgram]);
  useEffect(() => { if (program) { fetchSession(); fetchPlan(); } }, [program, fetchSession, fetchPlan]);

  // Session actions
  const ensureSession = async (dayId: string): Promise<string | null> => {
    if (session) return session.id;
    if (!user) return null;
    const { data, error } = await supabase
      .from("gym_sessions" as any)
      .upsert({ area_id: areaId, user_id: user.id, day_id: dayId, date: today } as any, { onConflict: "area_id,date" })
      .select("*")
      .single();
    if (error || !data) return null;
    setSession(data as any);
    return (data as any).id;
  };

  const handleAutoCheckIn = useCallback(async () => {
    if (!user || !areaId) return;
    await supabase.from("checkins").upsert(
      { area_id: areaId, user_id: user.id, date: today, completed: true },
      { onConflict: "area_id,date" }
    );
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (authSession?.access_token) {
      supabase.functions.invoke("calculate-score", {
        body: { area_id: areaId, date: today },
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      }).catch(console.error);
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
      const { data } = await supabase.from("gym_session_exercises" as any)
        .insert({ session_id: sessionId, exercise_id: exercise.id, weight_used: exercise.default_weight, completed: true } as any)
        .select("*").single();
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
    const { data } = await supabase
      .from("gym_sessions" as any)
      .upsert({ area_id: areaId, user_id: user.id, day_id: dayId, date: today } as any, { onConflict: "area_id,date" })
      .select("*").single();
    if (data) setSession(data as any);
    await loadDayData(dayId, data as any);
  };

  // Inline weight save
  const handleSaveWeight = async (exercise: GymProgramExercise) => {
    if (!selectedDayId) return;
    const newWeight = weightValue ? parseFloat(weightValue) : null;
    const sessionId = await ensureSession(selectedDayId);
    if (!sessionId) return;

    const existing = sessionExercises[exercise.id];
    if (existing) {
      await supabase.from("gym_session_exercises" as any).update({ weight_used: newWeight } as any).eq("id", existing.id);
      setSessionExercises(prev => ({ ...prev, [exercise.id]: { ...prev[exercise.id], weight_used: newWeight } }));
    } else {
      const { data } = await supabase.from("gym_session_exercises" as any)
        .insert({ session_id: sessionId, exercise_id: exercise.id, weight_used: newWeight, completed: false } as any)
        .select("*").single();
      if (data) setSessionExercises(prev => ({ ...prev, [exercise.id]: data as any }));
    }
    await supabase.from("gym_program_exercises" as any).update({ default_weight: newWeight } as any).eq("id", exercise.id);
    setEditingWeightId(null);
  };

  // Plan editing actions
  const handleAddGroup = async (dayId: string) => {
    if (!newGroupName.trim()) return;
    const dayGroups = planDays.find(d => d.id === dayId)?.groups || [];
    await supabase.from("gym_muscle_groups" as any).insert({ day_id: dayId, name: newGroupName.trim(), order: dayGroups.length } as any);
    setAddingGroupDayId(null);
    setNewGroupName("");
    fetchPlan();
  };

  const handleSaveExercise = async () => {
    if (!editingExercise || !exForm.name.trim() || !parseInt(exForm.sets) || !parseInt(exForm.reps)) return;
    const payload: any = {
      name: exForm.name.trim(),
      sets: parseInt(exForm.sets),
      reps: parseInt(exForm.reps),
      default_weight: exForm.weight ? parseFloat(exForm.weight) : null,
      is_daily: exForm.daily,
    };

    if (editingExercise.exercise) {
      await supabase.from("gym_program_exercises" as any).update(payload).eq("id", editingExercise.exercise.id);
    } else {
      const groupExercises = planDays.flatMap(d => d.groups).find(g => g.id === editingExercise.groupId)?.exercises || [];
      payload.group_id = editingExercise.groupId;
      payload.order = groupExercises.length;
      await supabase.from("gym_program_exercises" as any).insert(payload as any);
    }

    setEditingExercise(null);
    fetchPlan();
    if (selectedDayId) loadDayData(selectedDayId, session);
  };

  const handleDeactivateExercise = async (exerciseId: string) => {
    await supabase.from("gym_program_exercises" as any).update({ active: false } as any).eq("id", exerciseId);
    fetchPlan();
    if (selectedDayId) loadDayData(selectedDayId, session);
  };

  const openExerciseForm = (groupId: string, exercise?: GymProgramExercise) => {
    setEditingExercise({ groupId, exercise });
    setExForm({
      name: exercise?.name || "",
      sets: exercise ? String(exercise.sets) : "",
      reps: exercise ? String(exercise.reps) : "",
      weight: exercise?.default_weight ? String(exercise.default_weight) : "",
      daily: exercise?.is_daily || false,
    });
  };

  const formatEx = (ex: GymProgramExercise) => {
    const se = sessionExercises[ex.id];
    const w = se?.weight_used ?? ex.default_weight;
    if (w && w > 0) return `${ex.sets} × ${w}kg`;
    return `${ex.sets} × ${ex.reps}`;
  };

  const formatExPlan = (ex: GymProgramExercise) => {
    if (ex.default_weight && ex.default_weight > 0) return `${ex.sets} × ${ex.default_weight}kg`;
    return `${ex.sets} × ${ex.reps}`;
  };

  // No area linked
  if (!loading && !areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex flex-col px-4 pt-2 pb-8">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate("/cards")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
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
          <button onClick={() => navigate("/cards")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </button>
          <div className="h-5 w-32 rounded bg-card animate-pulse" />
        </div>
        <div className="h-32 rounded-xl bg-card animate-pulse mt-4" />
      </div>
    );
  }

  if (!program && areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex flex-col px-4 pt-2 pb-8">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate("/cards")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </button>
          <h1 className="text-[18px] font-semibold">{title}</h1>
        </div>
        <GymWizard areaId={areaId} onCreated={fetchProgram} />
      </motion.div>
    );
  }

  const selectedDay = days.find(d => d.id === selectedDayId);
  const allExercises = [...dailyExercises, ...groups.flatMap(g => g.exercises)];
  const planDailyExercises = planDays.flatMap(d => d.groups.flatMap(g => g.exercises.filter(e => e.is_daily)));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="flex flex-col px-4 pt-2 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 h-14">
        <button onClick={() => navigate("/cards")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
        <h1 className="text-[18px] font-semibold">{title}</h1>
      </div>

      {/* === TODAY'S SESSION === */}
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell size={18} strokeWidth={1.5} className="text-primary" />
        <h2 className="text-base font-semibold">{t("gym.title")}</h2>
      </div>

      {/* Inline day tabs */}
      {days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {days.map(day => (
            <button key={day.id} onClick={() => handleSelectDay(day.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors min-h-[36px] ${
                day.id === selectedDayId
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border"
              }`}>
              {day.name}
            </button>
          ))}
        </div>
      )}

      {/* Exercise checklist */}
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
                <ExerciseRow key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                  onToggle={() => handleToggleExercise(ex)}
                  formatEx={formatEx}
                  isEditingWeight={editingWeightId === ex.id}
                  weightValue={weightValue}
                  onStartEditWeight={() => { setEditingWeightId(ex.id); setWeightValue((sessionExercises[ex.id]?.weight_used ?? ex.default_weight ?? "").toString()); }}
                  onWeightChange={setWeightValue}
                  onSaveWeight={() => handleSaveWeight(ex)}
                  onCancelWeight={() => setEditingWeightId(null)}
                />
              ))}
            </div>
          )}
          {groups.filter(g => g.exercises.length > 0).map(group => (
            <div key={group.id}>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{group.name}</p>
              {group.exercises.map(ex => (
                <ExerciseRow key={ex.id} exercise={ex} sessionEx={sessionExercises[ex.id]}
                  onToggle={() => handleToggleExercise(ex)}
                  formatEx={formatEx}
                  isEditingWeight={editingWeightId === ex.id}
                  weightValue={weightValue}
                  onStartEditWeight={() => { setEditingWeightId(ex.id); setWeightValue((sessionExercises[ex.id]?.weight_used ?? ex.default_weight ?? "").toString()); }}
                  onWeightChange={setWeightValue}
                  onSaveWeight={() => handleSaveWeight(ex)}
                  onCancelWeight={() => setEditingWeightId(null)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* === HISTORY === */}
      {program && areaId && <GymHistory areaId={areaId} programId={program.id} />}

      {/* === PLAN EDITOR (inline) === */}
      <div className="mt-8">
        <button onClick={() => setPlanExpanded(!planExpanded)}
          className="flex items-center justify-between w-full min-h-[44px]">
          <h2 className="text-base font-semibold">{t("gym.plan.title")}</h2>
          {planExpanded ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {planExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3 pt-3">
                {/* Daily exercises */}
                {planDailyExercises.length > 0 && (
                  <div className="rounded-xl bg-card p-3">
                    <p className="text-xs text-muted-foreground font-medium mb-2">{t("gym.daily")}</p>
                    {planDailyExercises.map(ex => (
                      <div key={ex.id} className="flex items-center justify-between py-1.5">
                        <button onClick={() => openExerciseForm(ex.group_id, ex)} className="text-sm font-medium text-left flex-1 hover:opacity-80">{ex.name}</button>
                        <span className="text-xs text-muted-foreground">{formatExPlan(ex)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Days */}
                {planDays.map(day => {
                  const isExpanded = expandedPlanDay === day.id;
                  return (
                    <div key={day.id} className="rounded-xl bg-card overflow-hidden">
                      <button onClick={() => setExpandedPlanDay(isExpanded ? null : day.id)}
                        className="flex items-center justify-between w-full px-3 py-3 min-h-[44px]">
                        <span className="text-sm font-medium">{day.name}</span>
                        {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 flex flex-col gap-2">
                              {day.groups.map(group => (
                                <div key={group.id}>
                                  <p className="text-xs text-muted-foreground font-medium mb-1">{group.name}</p>
                                  {group.exercises.filter(e => !e.is_daily).map(ex => (
                                    <div key={ex.id}>
                                      {editingExercise?.exercise?.id === ex.id ? (
                                        <InlineExerciseForm
                                          form={exForm}
                                          onChange={setExForm}
                                          onSave={handleSaveExercise}
                                          onCancel={() => setEditingExercise(null)}
                                          onDeactivate={() => handleDeactivateExercise(ex.id)}
                                          isEditing
                                          t={t}
                                        />
                                      ) : (
                                        <button onClick={() => openExerciseForm(group.id, ex)}
                                          className="flex items-center justify-between w-full py-1.5 text-left hover:opacity-80">
                                          <span className="text-sm">{ex.name}</span>
                                          <span className="text-xs text-muted-foreground">{formatExPlan(ex)}</span>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {editingExercise && !editingExercise.exercise && editingExercise.groupId === group.id ? (
                                    <InlineExerciseForm
                                      form={exForm}
                                      onChange={setExForm}
                                      onSave={handleSaveExercise}
                                      onCancel={() => setEditingExercise(null)}
                                      t={t}
                                    />
                                  ) : (
                                    <button onClick={() => openExerciseForm(group.id)}
                                      className="flex items-center gap-1 text-xs text-primary mt-1 min-h-[36px] hover:opacity-80">
                                      <Plus size={14} /> {t("gym.addExercise")}
                                    </button>
                                  )}
                                </div>
                              ))}
                              {/* Add group */}
                              {addingGroupDayId === day.id ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder={t("gym.plan.groupPlaceholder")}
                                    className="bg-background border-border flex-1 h-9 text-sm"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === "Enter") handleAddGroup(day.id); if (e.key === "Escape") setAddingGroupDayId(null); }}
                                  />
                                  <button onClick={() => handleAddGroup(day.id)} className="text-primary text-sm font-medium min-h-[36px] px-2">{t("gym.form.save")}</button>
                                  <button onClick={() => setAddingGroupDayId(null)} className="text-muted-foreground min-h-[36px] px-1"><X size={16} /></button>
                                </div>
                              ) : (
                                <button onClick={() => { setAddingGroupDayId(day.id); setNewGroupName(""); }}
                                  className="flex items-center gap-1 text-xs text-primary mt-1 min-h-[36px] hover:opacity-80">
                                  <Plus size={14} /> {t("gym.plan.addGroup")}
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// === Inline exercise form ===
function InlineExerciseForm({ form, onChange, onSave, onCancel, onDeactivate, isEditing, t }: {
  form: { name: string; sets: string; reps: string; weight: string; daily: boolean };
  onChange: (f: typeof form) => void;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate?: () => void;
  isEditing?: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="rounded-lg bg-background p-3 my-1 flex flex-col gap-3">
      <Input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder={t("gym.form.namePlaceholder")} className="bg-card border-border h-9 text-sm" autoFocus />
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs">{t("gym.daily")}</p>
          <p className="text-[11px] text-muted-foreground">{t("gym.dailySub")}</p>
        </div>
        <Switch checked={form.daily} onCheckedChange={(v) => onChange({ ...form, daily: v })} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={!form.name.trim() || !parseInt(form.sets) || !parseInt(form.reps)}
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

// === Exercise row with inline weight editing ===
function ExerciseRow({ exercise, sessionEx, onToggle, formatEx, isEditingWeight, weightValue, onStartEditWeight, onWeightChange, onSaveWeight, onCancelWeight }: {
  exercise: GymProgramExercise;
  sessionEx?: GymSessionExercise;
  onToggle: () => void;
  formatEx: (ex: GymProgramExercise) => string;
  isEditingWeight: boolean;
  weightValue: string;
  onStartEditWeight: () => void;
  onWeightChange: (v: string) => void;
  onSaveWeight: () => void;
  onCancelWeight: () => void;
}) {
  const completed = sessionEx?.completed ?? false;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg min-h-[44px] ${completed ? "opacity-50" : ""}`}>
      <Checkbox checked={completed} onCheckedChange={onToggle} />
      <span className="text-sm font-medium flex-1">{exercise.name}</span>
      {isEditingWeight ? (
        <div className="flex items-center gap-1">
          <Input type="number" inputMode="decimal" value={weightValue} onChange={(e) => onWeightChange(e.target.value)}
            className="w-16 h-7 text-xs bg-background border-border px-2" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSaveWeight(); if (e.key === "Escape") onCancelWeight(); }} />
          <span className="text-[11px] text-muted-foreground">kg</span>
          <button onClick={onSaveWeight} className="text-primary text-xs font-medium px-1 min-h-[28px]">✓</button>
        </div>
      ) : (
        <button onClick={onStartEditWeight} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[32px] px-1">
          {formatEx(exercise)}
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}

export default GymCardPage;
