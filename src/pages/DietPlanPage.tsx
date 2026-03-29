import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";

import { ArrowLeft, Apple, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { DietWizard } from "@/components/diet/DietWizard";
import { MEAL_ORDER, MEAL_LABELS, type DietProgram, type DietProgramMeal, type DietMealItem, type MealType } from "@/components/diet/types";

const DietPlanPage = () => {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { getUserCard } = useUserCards();
  
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
          await supabase.from("user_cards" as any).upsert(
            { user_id: user.id, card_type: "diet", area_id: match.id, enabled: true } as any,
            { onConflict: "user_id,card_type" } as any
          );
        }
      }
    })();
  }, [user, userCard, resolvedAreaId]);

  const areaId = resolvedAreaId;

  const [program, setProgram] = useState<DietProgram | null>(null);
  const [meals, setMeals] = useState<(DietProgramMeal & { items: DietMealItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [freeMeals, setFreeMeals] = useState(0);
  const [editingItem, setEditingItem] = useState<{ mealId: string; item?: DietMealItem } | null>(null);
  const [itemForm, setItemForm] = useState({ name: "", maxPerWeek: "", grams: "" });

  const title = locale === "it" ? "Schema dieta" : "Diet plan";

  const fetchMeals = async (programId: string) => {
    const { data: mealsData } = await supabase
      .from("diet_program_meals" as any).select("*").eq("program_id", programId).order("order", { ascending: true });
    const allMeals = (mealsData as any[] || []) as DietProgramMeal[];
    const mealIds = allMeals.map(m => m.id);
    let allItems: DietMealItem[] = [];
    if (mealIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("diet_meal_items" as any).select("*").in("meal_id", mealIds).eq("active", true).order("order", { ascending: true });
      allItems = (itemsData as any[] || []) as DietMealItem[];
    }
    setMeals(allMeals.map(m => ({ ...m, items: allItems.filter(i => i.meal_id === m.id) })));
  };

  const fetchProgram = useCallback(async () => {
    if (!user || !areaId) { setLoading(false); return; }
    const { data } = await supabase.from("diet_programs" as any).select("*").eq("area_id", areaId).single();
    if (data) {
      const prog = data as any as DietProgram;
      setProgram(prog);
      setFreeMeals(prog.free_meals_per_week);
      await fetchMeals(prog.id);
    } else {
      setProgram(null);
    }
    setLoading(false);
  }, [user, areaId]);

  useEffect(() => { fetchProgram(); }, [fetchProgram]);

  const getMealLabel = (m: MealType) => MEAL_LABELS[m]?.[locale as "en" | "it"] || MEAL_LABELS[m]?.en || m;

  const handleToggleMeal = async (meal: DietProgramMeal) => {
    const newActive = !meal.active;
    await supabase.from("diet_program_meals" as any).update({ active: newActive } as any).eq("id", meal.id);
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, active: newActive } : m));
  };

  const handleFreeMealsChange = async (val: number) => {
    const clamped = Math.max(0, Math.min(14, val));
    setFreeMeals(clamped);
    if (program) {
      await supabase.from("diet_programs" as any).update({ free_meals_per_week: clamped } as any).eq("id", program.id);
    }
  };

  const openItemForm = (mealId: string, item?: DietMealItem) => {
    setEditingItem({ mealId, item });
    setItemForm({ name: item?.name || "", maxPerWeek: item?.max_per_week != null ? String(item.max_per_week) : "", grams: item?.grams != null ? String(item.grams) : "" });
  };

  const handleSaveItem = async () => {
    if (!editingItem || !itemForm.name.trim()) return;
    const maxPW = itemForm.maxPerWeek ? parseInt(itemForm.maxPerWeek) : null;
    const gramsVal = itemForm.grams ? parseInt(itemForm.grams) : null;
    if (editingItem.item) {
      await supabase.from("diet_meal_items" as any).update({ name: itemForm.name.trim(), max_per_week: maxPW, grams: gramsVal } as any).eq("id", editingItem.item.id);
    } else {
      const currentItems = meals.find(m => m.id === editingItem.mealId)?.items.length || 0;
      await supabase.from("diet_meal_items" as any).insert({ meal_id: editingItem.mealId, name: itemForm.name.trim(), max_per_week: maxPW, grams: gramsVal, order: currentItems } as any);
    }
    setEditingItem(null);
    if (program) await fetchMeals(program.id);
  };

  const handleDeactivateItem = async () => {
    if (!editingItem?.item) return;
    await supabase.from("diet_meal_items" as any).update({ active: false } as any).eq("id", editingItem.item.id);
    setEditingItem(null);
    if (program) await fetchMeals(program.id);
  };


  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <Header title={title} onBack={() => navigate("/activities")} />
        <div className="h-32 rounded-xl bg-card animate-pulse mt-4" />
      </div>
    );
  }

  if (!areaId) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col px-4 pt-2 pb-8">
        <Header title={title} onBack={() => navigate("/activities")} />
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <Apple size={48} className="text-primary" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center">{t("diet.empty")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("diet.emptySub")}</p>
          <button onClick={() => navigate("/activities/new?type=health")}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium min-h-[44px]">
            {t("diet.createArea")}
          </button>
        </div>
      </motion.div>
    );
  }

  if (!program) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col px-4 pt-2 pb-8">
        <Header title={title} onBack={() => navigate("/activities")} />
        <DietWizard areaId={areaId} onCreated={fetchProgram} />
      </motion.div>
    );
  }

  const sortedMeals = [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col px-4 pt-2 pb-24">
      <Header title={title} onBack={() => navigate("/activities")} />

      <button onClick={() => navigate("/cards/diet")}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base mb-4 min-h-[44px] hover:opacity-90 transition-opacity">
        {locale === "it" ? "Registra oggi" : "Log today"}
      </button>

      <div className="flex flex-col gap-3">
        {sortedMeals.map(meal => (
          <div key={meal.id} className={`rounded-xl bg-card p-3 ${!meal.active ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{getMealLabel(meal.meal_type)}</p>
              <Switch checked={meal.active} onCheckedChange={() => handleToggleMeal(meal)} />
            </div>
            {meal.active && (
              <>
                {meal.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">
                    {locale === "it" ? "Nessun componente" : "No components"}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {meal.items.map(item => (
                      <button key={item.id} onClick={() => openItemForm(meal.id, item)}
                        className="flex items-center justify-between py-1.5 text-left hover:opacity-80 min-h-[36px]">
                        <span className="text-sm font-medium">{item.name}</span>
                        <div className="flex items-center gap-1.5">
                          {item.grams != null && (
                            <span className="text-[11px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-md">
                              {item.grams}g
                            </span>
                          )}
                          {item.max_per_week != null && (
                            <span className="text-[11px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-md">
                              max {item.max_per_week}/{locale === "it" ? "sett" : "wk"}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => openItemForm(meal.id)}
                  className="flex items-center gap-1 text-xs text-primary mt-1 min-h-[36px] hover:opacity-80">
                  <Plus size={14} /> {locale === "it" ? "Aggiungi componente" : "Add component"}
                </button>
              </>
            )}
          </div>
        ))}

        <div className="rounded-xl bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
            {locale === "it" ? "Pasti liberi a settimana" : "Free meals per week"}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={() => handleFreeMealsChange(freeMeals - 1)}
              className="w-9 h-9 rounded-lg bg-background border border-border text-lg font-medium min-h-[36px]">−</button>
            <span className="text-xl font-semibold w-8 text-center">{freeMeals}</span>
            <button onClick={() => handleFreeMealsChange(freeMeals + 1)}
              className="w-9 h-9 rounded-lg bg-background border border-border text-lg font-medium min-h-[36px]">+</button>
          </div>
        </div>
      </div>

      <Drawer open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader>
            <DrawerTitle>
              {editingItem?.item ? (locale === "it" ? "Modifica componente" : "Edit component") : (locale === "it" ? "Aggiungi componente" : "Add component")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">{locale === "it" ? "Nome" : "Name"}</label>
              <Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                placeholder={locale === "it" ? "es. Yogurt" : "e.g. Yogurt"} className="bg-background border-border" autoFocus />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">
                {locale === "it" ? "Grammi" : "Grams"}
              </label>
              <Input type="number" inputMode="numeric" value={itemForm.grams}
                onChange={e => setItemForm(f => ({ ...f, grams: e.target.value }))} placeholder="—" className="bg-background border-border" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">
                {locale === "it" ? "Max a settimana" : "Max per week"} ({locale === "it" ? "opzionale" : "optional"})
              </label>
              <Input type="number" inputMode="numeric" value={itemForm.maxPerWeek}
                onChange={e => setItemForm(f => ({ ...f, maxPerWeek: e.target.value }))} placeholder="—" className="bg-background border-border" />
            </div>
          </div>
          <DrawerFooter className="flex flex-col gap-2">
            <button onClick={handleSaveItem} disabled={!itemForm.name.trim()}
              className="w-full min-h-[48px] rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40">
              {locale === "it" ? "Salva" : "Save"}
            </button>
            {editingItem?.item && (
              <button onClick={handleDeactivateItem}
                className="w-full min-h-[44px] rounded-lg text-[#E24A4A] font-medium text-sm hover:opacity-80">
                {locale === "it" ? "Disattiva componente" : "Deactivate component"}
              </button>
            )}
            <button onClick={() => setEditingItem(null)} className="w-full min-h-[44px] text-sm text-muted-foreground">
              {locale === "it" ? "Annulla" : "Cancel"}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </motion.div>
  );
};

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="relative flex items-center justify-center h-14">
      <button onClick={onBack} className="absolute left-0 flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
        <ArrowLeft size={22} strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-2">
        <Apple size={20} strokeWidth={1.5} className="text-primary" />
        <h1 className="text-[17px] font-semibold">{title}</h1>
      </div>
    </div>
  );
}

export default DietPlanPage;
