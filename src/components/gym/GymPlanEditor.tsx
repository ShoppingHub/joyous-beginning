import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { GymProgramDay, GymMuscleGroup, GymProgramExercise } from "./types";

interface GymPlanEditorProps {
  programId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function GymPlanEditor({ programId, open, onOpenChange, onChanged }: GymPlanEditorProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [days, setDays] = useState<(GymProgramDay & { groups: (GymMuscleGroup & { exercises: GymProgramExercise[] })[] })[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Sub-drawers
  const [groupDrawer, setGroupDrawer] = useState<{ dayId: string } | null>(null);
  const [groupName, setGroupName] = useState("");
  const [exDrawer, setExDrawer] = useState<{ groupId: string; exercise?: GymProgramExercise } | null>(null);
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState("");
  const [exReps, setExReps] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exDaily, setExDaily] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPlan = useCallback(async () => {
    if (!programId) return;
    const { data: daysData } = await supabase
      .from("gym_program_days" as any)
      .select("*")
      .eq("program_id", programId)
      .order("order", { ascending: true });
    if (!daysData || (daysData as any[]).length === 0) { setDays([]); setLoading(false); return; }

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

    const grouped = (daysData as any[]).map((day: any) => {
      const dayGroups = (groupsData as any[] || [])
        .filter((g: any) => g.day_id === day.id)
        .map((g: any) => ({
          ...g,
          exercises: exercisesData.filter((e: any) => e.group_id === g.id),
        }));
      return { ...day, groups: dayGroups };
    });

    setDays(grouped);
    if (!expandedDay && grouped.length > 0) setExpandedDay(grouped[0].id);
    setLoading(false);
  }, [programId, expandedDay]);

  useEffect(() => { if (open) fetchPlan(); }, [open, fetchPlan]);

  const handleAddGroup = async () => {
    if (!groupDrawer || !groupName.trim()) return;
    setSaving(true);
    const dayGroups = days.find(d => d.id === groupDrawer.dayId)?.groups || [];
    await supabase.from("gym_muscle_groups" as any).insert({
      day_id: groupDrawer.dayId,
      name: groupName.trim(),
      order: dayGroups.length,
    } as any);
    setGroupDrawer(null);
    setGroupName("");
    setSaving(false);
    fetchPlan();
    onChanged();
  };

  const openExerciseDrawer = (groupId: string, exercise?: GymProgramExercise) => {
    setExDrawer({ groupId, exercise });
    setExName(exercise?.name || "");
    setExSets(exercise ? String(exercise.sets) : "");
    setExReps(exercise ? String(exercise.reps) : "");
    setExWeight(exercise?.default_weight ? String(exercise.default_weight) : "");
    setExDaily(exercise?.is_daily || false);
  };

  const handleSaveExercise = async () => {
    if (!exDrawer || !exName.trim() || !parseInt(exSets) || !parseInt(exReps)) return;
    setSaving(true);
    const payload: any = {
      name: exName.trim(),
      sets: parseInt(exSets),
      reps: parseInt(exReps),
      default_weight: exWeight ? parseFloat(exWeight) : null,
      is_daily: exDaily,
    };

    if (exDrawer.exercise) {
      await supabase.from("gym_program_exercises" as any).update(payload).eq("id", exDrawer.exercise.id);
    } else {
      const groupExercises = days.flatMap(d => d.groups).find(g => g.id === exDrawer.groupId)?.exercises || [];
      payload.group_id = exDrawer.groupId;
      payload.order = groupExercises.length;
      await supabase.from("gym_program_exercises" as any).insert(payload as any);
    }

    setExDrawer(null);
    setSaving(false);
    fetchPlan();
    onChanged();
  };

  const handleDeactivateExercise = async () => {
    if (!exDrawer?.exercise) return;
    setSaving(true);
    await supabase.from("gym_program_exercises" as any).update({ active: false } as any).eq("id", exDrawer.exercise.id);
    setExDrawer(null);
    setSaving(false);
    fetchPlan();
    onChanged();
  };

  const formatEx = (ex: GymProgramExercise) => {
    if (ex.default_weight && ex.default_weight > 0) return `${ex.sets} × ${ex.default_weight}kg`;
    return `${ex.sets} × ${ex.reps}`;
  };

  // Collect daily exercises across all days
  const dailyExercises = days.flatMap(d => d.groups.flatMap(g => g.exercises.filter(e => e.is_daily)));

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-card border-border max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{t("gym.plan.title")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto flex flex-col gap-3">
            {loading ? (
              <div className="h-20 rounded-lg bg-background animate-pulse" />
            ) : (
              <>
                {/* Daily exercises section */}
                {dailyExercises.length > 0 && (
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-xs text-muted-foreground font-medium mb-2">{t("gym.daily")}</p>
                    {dailyExercises.map(ex => (
                      <button key={ex.id} onClick={() => openExerciseDrawer(ex.group_id, ex)}
                        className="flex items-center justify-between w-full py-1.5 text-left hover:opacity-80">
                        <span className="text-sm font-medium">{ex.name}</span>
                        <span className="text-xs text-muted-foreground">{formatEx(ex)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {days.map(day => {
                  const isExpanded = expandedDay === day.id;
                  return (
                    <div key={day.id} className="rounded-lg bg-background overflow-hidden">
                      <button
                        onClick={() => setExpandedDay(isExpanded ? null : day.id)}
                        className="flex items-center justify-between w-full px-3 py-3 min-h-[44px]"
                      >
                        <span className="text-sm font-medium">{day.name}</span>
                        {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 flex flex-col gap-2">
                          {day.groups.map(group => (
                            <div key={group.id}>
                              <p className="text-xs text-muted-foreground font-medium mb-1">{group.name}</p>
                              {group.exercises.filter(e => !e.is_daily).map(ex => (
                                <button key={ex.id} onClick={() => openExerciseDrawer(group.id, ex)}
                                  className="flex items-center justify-between w-full py-1.5 text-left hover:opacity-80">
                                  <span className="text-sm">{ex.name}</span>
                                  <span className="text-xs text-muted-foreground">{formatEx(ex)}</span>
                                </button>
                              ))}
                              <button onClick={() => openExerciseDrawer(group.id)}
                                className="flex items-center gap-1 text-xs text-primary mt-1 min-h-[36px] hover:opacity-80">
                                <Plus size={14} /> {t("gym.addExercise")}
                              </button>
                            </div>
                          ))}
                          <button onClick={() => { setGroupDrawer({ dayId: day.id }); setGroupName(""); }}
                            className="flex items-center gap-1 text-xs text-primary mt-1 min-h-[36px] hover:opacity-80">
                            <Plus size={14} /> {t("gym.plan.addGroup")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <button className="w-full min-h-[44px] text-sm text-muted-foreground">{t("gym.form.cancel")}</button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add Group Drawer */}
      <Drawer open={!!groupDrawer} onOpenChange={(o) => !o && setGroupDrawer(null)}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader><DrawerTitle>{t("gym.plan.addGroup")}</DrawerTitle></DrawerHeader>
          <div className="px-4">
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t("gym.plan.groupPlaceholder")} className="bg-background border-border" />
          </div>
          <DrawerFooter>
            <button onClick={handleAddGroup} disabled={!groupName.trim() || saving}
              className="w-full min-h-[48px] rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40">
              {t("gym.form.save")}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Add/Edit Exercise Drawer */}
      <Drawer open={!!exDrawer} onOpenChange={(o) => !o && setExDrawer(null)}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader>
            <DrawerTitle>{exDrawer?.exercise ? t("gym.editExercise") : t("gym.addExercise")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 flex flex-col gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.name")}</label>
              <Input value={exName} onChange={(e) => setExName(e.target.value)} placeholder={t("gym.form.namePlaceholder")} className="bg-background border-border" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.sets")}</label>
                <Input type="number" inputMode="numeric" value={exSets} onChange={(e) => setExSets(e.target.value)} min={1} className="bg-background border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.reps")}</label>
                <Input type="number" inputMode="numeric" value={exReps} onChange={(e) => setExReps(e.target.value)} min={1} className="bg-background border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.weight")}</label>
                <Input type="number" inputMode="decimal" value={exWeight} onChange={(e) => setExWeight(e.target.value)} placeholder={t("gym.form.weightPlaceholder")} className="bg-background border-border" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">{t("gym.daily")}</p>
                <p className="text-xs text-muted-foreground">{t("gym.dailySub")}</p>
              </div>
              <Switch checked={exDaily} onCheckedChange={setExDaily} />
            </div>
          </div>
          <DrawerFooter className="flex flex-col gap-2">
            <button onClick={handleSaveExercise} disabled={!exName.trim() || !parseInt(exSets) || !parseInt(exReps) || saving}
              className="w-full min-h-[48px] rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40">
              {t("gym.form.save")}
            </button>
            {exDrawer?.exercise && (
              <button onClick={handleDeactivateExercise} disabled={saving}
                className="w-full min-h-[44px] rounded-lg text-destructive font-medium text-sm hover:opacity-80 disabled:opacity-40">
                {t("gym.plan.deactivate")}
              </button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
