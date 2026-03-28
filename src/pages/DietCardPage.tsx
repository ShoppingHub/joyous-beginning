import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";

import { ArrowLeft, Apple, Settings, ChevronDown, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfWeek, addDays } from "date-fns";
import { track } from "@/lib/analytics";
import { Checkbox } from "@/components/ui/checkbox";
import { DietWizard } from "@/components/diet/DietWizard";
import { MEAL_ORDER, MEAL_LABELS, type DietProgram, type DietProgramMeal, type DietMealItem, type DietSession, type DietSessionMeal, type DietSessionItem, type MealType } from "@/components/diet/types";

const DietCardPage = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { getUserCard } = useUserCards();
  
  const [searchParams] = useSearchParams();
  const userCard = getUserCard("diet");
  const [resolvedAreaId, setResolvedAreaId] = useState<string | null>(userCard?.area_id ?? null);

  // Fallback: if no user_cards record links to an area, find it by pattern
  useEffect(() => {
    if (resolvedAreaId || !user) return;
    if (userCard?.area_id) { setResolvedAreaId(userCard.area_id); return; }
    (async () => {
      const { data } = await supabase.from("areas").select("id, name")
        .eq("user_id", user.id).eq("type", "health").is("archived_at", null);
      if (data) {
        const match = (data as any[]).find((a: any) => /dieta|diet|alimentazione|nutrition/i.test(a.name));
        if (match) {
          setResolvedAreaId(match.id);
          // Also upsert user_cards for future use
          await supabase.from("user_cards" as any).upsert(
            { user_id: user.id, card_type: "diet", area_id: match.id, enabled: true } as any,
            { onConflict: "user_id,card_type" } as any
          );
        }
      }
    })();
  }, [user, userCard, resolvedAreaId]);

  const areaId = resolvedAreaId;

  const today = format(new Date(), "yyyy-MM-dd");
  const [program, setProgram] = useState<DietProgram | null>(null);
  const [meals, setMeals] = useState<(DietProgramMeal & { items: DietMealItem[] })[]>([]);
  const [session, setSession] = useState<DietSession | null>(null);
  const [sessionMeals, setSessionMeals] = useState<Record<string, DietSessionMeal>>({});
  const [sessionItems, setSessionItems] = useState<Record<string, DietSessionItem>>({});
  const [loading, setLoading] = useState(true);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [freeMealsUsed, setFreeMealsUsed] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [weeklyItemCounts, setWeeklyItemCounts] = useState<Record<string, number>>({});
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const title = locale === "it" ? "Scheda Dieta" : "Diet Card";

  const fetchAll = useCallback(async () => {
    if (!user || !areaId) { setLoading(false); return; }
    
    const { data: progData } = await supabase.from("diet_programs" as any).select("*").eq("area_id", areaId).single();
    if (!progData) { setProgram(null); setLoading(false); return; }
    const prog = progData as any as DietProgram;
    setProgram(prog);

    const { data: mealsData } = await supabase.from("diet_program_meals" as any).select("*").eq("program_id", prog.id).eq("active", true).order("order", { ascending: true });
    const allMeals = (mealsData as any[] || []) as DietProgramMeal[];
    const mealIds = allMeals.map(m => m.id);

    let allItems: DietMealItem[] = [];
    if (mealIds.length > 0) {
      const { data: itemsData } = await supabase.from("diet_meal_items" as any).select("*").in("meal_id", mealIds).eq("active", true).order("order", { ascending: true });
      allItems = (itemsData as any[] || []) as DietMealItem[];
    }

    const mealsWithItems = allMeals.map(m => ({ ...m, items: allItems.filter(i => i.meal_id === m.id) }));
    setMeals(mealsWithItems);

    const { data: sessData } = await supabase.from("diet_sessions" as any).select("*").eq("area_id", areaId).eq("date", today).single();
    const sess = sessData as any as DietSession | null;
    setSession(sess);
    setNoteText(sess?.notes || "");

    if (sess) {
      const { data: smData } = await supabase.from("diet_session_meals" as any).select("*").eq("session_id", sess.id);
      const smMap: Record<string, DietSessionMeal> = {};
      for (const sm of (smData as any[] || [])) smMap[sm.program_meal_id] = sm;
      setSessionMeals(smMap);

      const smIds = (smData as any[] || []).map((sm: any) => sm.id);
      if (smIds.length > 0) {
        const { data: siData } = await supabase.from("diet_session_items" as any).select("*").in("session_meal_id", smIds);
        const siMap: Record<string, DietSessionItem> = {};
        for (const si of (siData as any[] || [])) siMap[si.meal_item_id] = si;
        setSessionItems(siMap);
      }
    }

    // Weekly counts
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), "yyyy-MM-dd");
    const { data: weekSessions } = await supabase.from("diet_sessions" as any).select("id").eq("area_id", areaId).gte("date", weekStart).lte("date", weekEnd);
    if (weekSessions && (weekSessions as any[]).length > 0) {
      const weekSessIds = (weekSessions as any[]).map((s: any) => s.id);
      const { data: weekSM } = await supabase.from("diet_session_meals" as any).select("*").in("session_id", weekSessIds).eq("is_free", true);
      setFreeMealsUsed((weekSM as any[] || []).length);

      const { data: allWeekSM } = await supabase.from("diet_session_meals" as any).select("id").in("session_id", weekSessIds);
      if (allWeekSM && (allWeekSM as any[]).length > 0) {
        const allWeekSMIds = (allWeekSM as any[]).map((sm: any) => sm.id);
        const { data: weekSI } = await supabase.from("diet_session_items" as any).select("meal_item_id").in("session_meal_id", allWeekSMIds).eq("consumed", true);
        const counts: Record<string, number> = {};
        for (const si of (weekSI as any[] || [])) counts[si.meal_item_id] = (counts[si.meal_item_id] || 0) + 1;
        setWeeklyItemCounts(counts);
      }
    }

    // History
    const { data: histData } = await supabase.from("diet_sessions" as any).select("*").eq("area_id", areaId).neq("date", today).order("date", { ascending: false }).limit(20);
    if (histData && (histData as any[]).length > 0) {
      const histSessions = histData as any[];
      const histSessIds = histSessions.map(s => s.id);
      const { data: histSM } = await supabase.from("diet_session_meals" as any).select("*").in("session_id", histSessIds);
      const completedSessions = histSessions.filter(s =>
        (histSM as any[] || []).some(sm => sm.session_id === s.id && (sm.completed || sm.is_free))
      );
      const histSMIds = (histSM as any[] || []).map((sm: any) => sm.id);
      let histSI: any[] = [];
      if (histSMIds.length > 0) {
        const { data } = await supabase.from("diet_session_items" as any).select("*").in("session_meal_id", histSMIds).eq("consumed", true);
        histSI = (data as any[] || []);
      }
      setHistorySessions(completedSessions.map(s => ({
        ...s,
        sessionMeals: (histSM as any[] || []).filter((sm: any) => sm.session_id === s.id),
        sessionItems: histSI.filter((si: any) =>
          (histSM as any[] || []).some((sm: any) => sm.id === si.session_meal_id && sm.session_id === s.id)
        ),
      })));
    }

    setLoading(false);
  }, [user, areaId, today]);

  useEffect(() => { fetchAll(); track("card_opened", { card_type: "diet" }); }, [fetchAll]);

  // Auto-expand meal from query param
  useEffect(() => {
    const mealParam = searchParams.get("meal");
    if (mealParam && meals.length > 0 && !expandedMeal) {
      const target = meals.find(m => m.meal_type === mealParam);
      if (target) setExpandedMeal(target.id);
    }
  }, [searchParams, meals, expandedMeal]);

  const ensureSession = async (): Promise<string | null> => {
    if (session) return session.id;
    if (!user || !areaId) return null;
    const { data, error } = await supabase.from("diet_sessions" as any)
      .upsert({ area_id: areaId, user_id: user.id, date: today } as any, { onConflict: "area_id,date" })
      .select("*").single();
    if (error || !data) return null;
    setSession(data as any);
    return (data as any).id;
  };

  const ensureSessionMeal = async (programMealId: string): Promise<string | null> => {
    if (sessionMeals[programMealId]) return sessionMeals[programMealId].id;
    const sessionId = await ensureSession();
    if (!sessionId) return null;
    const { data } = await supabase.from("diet_session_meals" as any)
      .insert({ session_id: sessionId, program_meal_id: programMealId } as any)
      .select("*").single();
    if (!data) return null;
    setSessionMeals(prev => ({ ...prev, [programMealId]: data as any }));
    return (data as any).id;
  };

  const handleToggleItem = async (mealId: string, itemId: string) => {
    const sessionMealId = await ensureSessionMeal(mealId);
    if (!sessionMealId) return;
    const existing = sessionItems[itemId];
    if (existing) {
      const newConsumed = !existing.consumed;
      await supabase.from("diet_session_items" as any).update({ consumed: newConsumed } as any).eq("id", existing.id);
      setSessionItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], consumed: newConsumed } }));
    } else {
      const { data } = await supabase.from("diet_session_items" as any)
        .insert({ session_meal_id: sessionMealId, meal_item_id: itemId, consumed: true } as any)
        .select("*").single();
      if (data) setSessionItems(prev => ({ ...prev, [itemId]: data as any }));
    }
  };

  const handleCompleteMeal = async (mealId: string) => {
    const sm = sessionMeals[mealId];
    if (sm?.completed) {
      await supabase.from("diet_session_meals" as any).update({ completed: false } as any).eq("id", sm.id);
      setSessionMeals(prev => ({ ...prev, [mealId]: { ...prev[mealId], completed: false } }));
    } else {
      const sessionMealId = await ensureSessionMeal(mealId);
      if (!sessionMealId) return;
      await supabase.from("diet_session_meals" as any).update({ completed: true } as any).eq("id", sessionMealId);
      const updated = { ...sessionMeals, [mealId]: { ...sessionMeals[mealId], completed: true, id: sessionMealId, session_id: "", program_meal_id: mealId, is_free: sessionMeals[mealId]?.is_free ?? false } };
      setSessionMeals(updated);
      checkAutoCheckIn(updated);
    }
  };

  const handleFreeMeal = async (mealId: string) => {
    const sm = sessionMeals[mealId];
    if (sm?.is_free) {
      await supabase.from("diet_session_meals" as any).update({ is_free: false } as any).eq("id", sm.id);
      setSessionMeals(prev => ({ ...prev, [mealId]: { ...prev[mealId], is_free: false } }));
      setFreeMealsUsed(prev => prev - 1);
    } else {
      const sessionMealId = await ensureSessionMeal(mealId);
      if (!sessionMealId) return;
      await supabase.from("diet_session_meals" as any).update({ is_free: true } as any).eq("id", sessionMealId);
      const updated = { ...sessionMeals, [mealId]: { ...sessionMeals[mealId], is_free: true, id: sessionMealId, session_id: "", program_meal_id: mealId, completed: sessionMeals[mealId]?.completed ?? false } };
      setSessionMeals(updated);
      setFreeMealsUsed(prev => prev + 1);
      checkAutoCheckIn(updated);
    }
  };

  const checkAutoCheckIn = async (updatedSM: Record<string, DietSessionMeal>) => {
    if (!user || !areaId) return;
    const activeMealIds = meals.map(m => m.id);
    const allDone = activeMealIds.every(id => {
      const sm = updatedSM[id];
      return sm?.completed || sm?.is_free;
    });
    if (allDone) {
      await supabase.from("checkins").upsert({ area_id: areaId, user_id: user.id, date: today, completed: true }, { onConflict: "area_id,date" });
      track("diet_all_meals_completed");
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.access_token) {
        supabase.functions.invoke("calculate-score", { body: { area_id: areaId, date: today }, headers: { Authorization: `Bearer ${authSession.access_token}` } }).catch(console.error);
      }
    }
  };

  const getMealLabel = (m: MealType) => MEAL_LABELS[m]?.[locale as "en" | "it"] || MEAL_LABELS[m]?.en || m;
  const sortedMeals = [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type));
  const canUseFree = program ? freeMealsUsed < program.free_meals_per_week : false;

  const handleSaveNote = async () => {
    if (!session && !user) return;
    setNoteSaving(true);
    const sessionId = await ensureSession();
    if (sessionId) {
      await supabase.from("diet_sessions" as any).update({ notes: noteText.trim() || null } as any).eq("id", sessionId);
    }
    setNoteSaving(false);
    setNoteOpen(false);
  };


  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader title={title} locale={locale} onBack={() => navigate("/activities")} onSettings={() => navigate("/cards/diet/edit")} />
        <div className="h-32 rounded-xl bg-card animate-pulse mt-4" />
      </div>
    );
  }

  if (!areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader title={title} locale={locale} onBack={() => navigate("/activities")} onSettings={() => navigate("/cards/diet/edit")} />
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <Apple size={48} className="text-primary" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("diet.empty")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("diet.emptySub")}</p>
        </div>
      </motion.div>
    );
  }

  if (!program) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col px-4 pt-2 pb-8">
        <PageHeader title={title} locale={locale} onBack={() => navigate("/activities")} onSettings={() => navigate("/cards/diet/edit")} />
        <DietWizard areaId={areaId} onCreated={fetchAll} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col px-4 pt-2 pb-24">
      <PageHeader title={title} locale={locale} onBack={() => navigate("/activities")} onSettings={() => navigate("/cards/diet/edit")} />

      {sortedMeals.length === 0 ? (
        <div className="rounded-xl bg-card flex flex-col items-center justify-center py-6 gap-2 px-4">
          <p className="text-sm text-muted-foreground text-center">
            {locale === "it" ? "Nessun pasto previsto per oggi" : "No meals planned for today"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedMeals.map(meal => {
            const sm = sessionMeals[meal.id];
            const isCompleted = sm?.completed;
            const isFree = sm?.is_free;
            const isDone = isCompleted || isFree;
            const isExpanded = expandedMeal === meal.id;

            return (
              <div key={meal.id} className={`rounded-xl bg-card border border-border overflow-hidden ${isDone ? "opacity-50" : ""}`}>
                <button onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                  className="w-full flex items-center justify-between p-3 min-h-[44px]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{getMealLabel(meal.meal_type)}</span>
                    {isCompleted && <Check size={14} className="text-primary" />}
                    {isFree && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        {locale === "it" ? "Libero" : "Free"}
                      </span>
                    )}
                  </div>
                  {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 flex flex-col gap-2">
                        {meal.items.length === 0 ? (
                          <div className="flex flex-col gap-1 py-2">
                            <p className="text-xs text-muted-foreground">
                              {locale === "it" ? "Nessun componente attivo per questo pasto" : "No active components for this meal"}
                            </p>
                            <button onClick={() => navigate("/cards/diet/edit")} className="text-xs text-primary hover:opacity-80">
                              {locale === "it" ? "Aggiungi componenti dallo schema" : "Add components from your plan"}
                            </button>
                          </div>
                        ) : (
                          meal.items.map(item => {
                            const si = sessionItems[item.id];
                            const consumed = si?.consumed ?? false;
                            const weekCount = weeklyItemCounts[item.id] || 0;
                            const hasMax = item.max_per_week != null;
                            const overLimit = hasMax && weekCount >= item.max_per_week!;
                            return (
                              <div key={item.id} className="flex items-center gap-3 min-h-[36px]">
                                <Checkbox checked={consumed} onCheckedChange={() => handleToggleItem(meal.id, item.id)} />
                                <span className="text-sm flex-1">{item.name}</span>
                                {hasMax && (
                                  <span className={`text-[11px] font-medium ${overLimit ? "text-[#BFA37A]" : "text-muted-foreground"}`}>
                                    {weekCount}/{item.max_per_week}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => handleCompleteMeal(meal.id)}
                            className={`flex-1 min-h-[40px] rounded-lg text-sm font-medium transition-colors ${
                              isCompleted ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"
                            }`}>
                            {isCompleted ? (locale === "it" ? "Completato" : "Completed") : (locale === "it" ? "Completa" : "Complete")}
                          </button>
                          {(canUseFree || isFree) && (
                            <button onClick={() => handleFreeMeal(meal.id)}
                              className={`min-h-[40px] px-3 rounded-lg text-sm font-medium transition-colors ${
                                isFree ? "bg-primary/15 text-primary" : "ring-1 ring-border text-muted-foreground hover:text-foreground"
                              }`}>
                              {locale === "it" ? "Pasto libero" : "Free meal"}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {program.free_meals_per_week > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-1">
              {locale === "it" ? "Pasti liberi" : "Free meals"}: {freeMealsUsed}/{program.free_meals_per_week} {locale === "it" ? "usati" : "used"}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="mt-4">
        <button onClick={() => setNoteOpen(!noteOpen)}
          className="flex items-center gap-2 text-sm font-semibold mb-2 min-h-[36px]">
          {noteOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {locale === "it" ? "Note" : "Notes"}
          {noteText.trim() && !noteOpen && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
        <AnimatePresence>
          {noteOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="flex flex-col gap-2">
                <textarea
                  value={noteText}
                  onChange={(e) => { if (e.target.value.length <= 1500) setNoteText(e.target.value); }}
                  rows={3}
                  className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder={locale === "it" ? "Aggiungi note sulla giornata..." : "Add notes about your day..."}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${1500 - noteText.length <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {1500 - noteText.length}
                  </span>
                  <button onClick={handleSaveNote} disabled={noteSaving}
                    className="text-sm font-medium text-primary hover:opacity-80 transition-opacity min-h-[36px] px-3">
                    {noteSaving ? "..." : (locale === "it" ? "Salva" : "Save")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History */}
      {historySessions.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center gap-2 text-sm font-semibold mb-2 min-h-[36px]">
            {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {locale === "it" ? "Storico" : "History"}
          </button>
          <AnimatePresence>
            {historyOpen && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="flex flex-col gap-2">
                  {historySessions.map(hs => {
                    const completedCount = hs.sessionMeals.filter((sm: any) => sm.completed || sm.is_free).length;
                    const totalCount = meals.length;
                    const isExpanded = expandedHistory === hs.id;
                    const dateLabel = new Date(hs.date).toLocaleDateString(locale === "it" ? "it-IT" : "en-US", { weekday: "short", day: "numeric", month: "short" });
                    return (
                      <div key={hs.id} className="rounded-xl bg-card border border-border overflow-hidden">
                        <button onClick={() => setExpandedHistory(isExpanded ? null : hs.id)}
                          className="w-full flex items-center justify-between p-3 min-h-[44px]">
                          <span className="text-sm font-medium">{dateLabel}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} {locale === "it" ? "pasti" : "meals"}</span>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="px-3 pb-3 flex flex-col gap-2">
                                {hs.sessionMeals.filter((sm: any) => sm.completed || sm.is_free).map((sm: any) => {
                                  const mealDef = meals.find(m => m.id === sm.program_meal_id);
                                  if (!mealDef) return null;
                                  const consumedItems = hs.sessionItems.filter((si: any) => si.session_meal_id === sm.id && si.consumed);
                                  return (
                                    <div key={sm.id}>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold">{getMealLabel(mealDef.meal_type)}</p>
                                        {sm.is_free && (
                                          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                            {locale === "it" ? "Libero" : "Free"}
                                          </span>
                                        )}
                                      </div>
                                      {consumedItems.length > 0 && (
                                        <div className="ml-2 mt-1 flex flex-col gap-0.5">
                                          {consumedItems.map((si: any) => {
                                            const itemDef = mealDef.items.find(i => i.id === si.meal_item_id);
                                            return itemDef ? <span key={si.id} className="text-xs text-muted-foreground">• {itemDef.name}</span> : null;
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
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
      )}
    </motion.div>
  );
};

function PageHeader({ title, locale, onBack, onSettings }: { title: string; locale: string; onBack: () => void; onSettings: () => void }) {
  return (
    <div className="relative flex items-center justify-center h-14">
      <button onClick={onBack} className="absolute left-0 flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
        <ArrowLeft size={22} strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-2">
        <Apple size={20} strokeWidth={1.5} className="text-primary" />
        <h1 className="text-[17px] font-semibold">{title}</h1>
      </div>
      <button onClick={onSettings} className="absolute right-0 flex items-center justify-center min-h-[44px] min-w-[44px]">
        <Settings size={18} strokeWidth={1.5} className="text-muted-foreground" />
      </button>
    </div>
  );
}

export default DietCardPage;
