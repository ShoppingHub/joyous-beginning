import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Apple } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { MEAL_ORDER, MEAL_LABELS, type MealType } from "./types";

interface DietWizardProps {
  areaId: string;
  onCreated: () => void;
}

export function DietWizard({ areaId, onCreated }: DietWizardProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeMeals, setActiveMeals] = useState<Record<MealType, boolean>>({
    breakfast: true,
    morning_snack: false,
    lunch: true,
    afternoon_snack: false,
    dinner: true,
  });
  const [mealItems, setMealItems] = useState<Record<MealType, string[]>>({
    breakfast: [""],
    morning_snack: [""],
    lunch: [""],
    afternoon_snack: [""],
    dinner: [""],
  });
  const [freeMeals, setFreeMeals] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const toggleMeal = (meal: MealType) => {
    setActiveMeals(prev => ({ ...prev, [meal]: !prev[meal] }));
  };

  const hasAtLeastOneMeal = MEAL_ORDER.some(m => activeMeals[m]);

  const addItem = (meal: MealType) => {
    setMealItems(prev => ({ ...prev, [meal]: [...prev[meal], ""] }));
  };

  const updateItem = (meal: MealType, idx: number, value: string) => {
    setMealItems(prev => ({
      ...prev,
      [meal]: prev[meal].map((v, i) => (i === idx ? value : v)),
    }));
  };

  const removeItem = (meal: MealType, idx: number) => {
    setMealItems(prev => ({
      ...prev,
      [meal]: prev[meal].filter((_, i) => i !== idx),
    }));
  };

  const activeWithItems = MEAL_ORDER.filter(m => activeMeals[m]);
  const allMealsHaveItems = activeWithItems.every(
    m => mealItems[m].some(v => v.trim().length > 0)
  );

  const handleCreate = async () => {
    if (!user) return;
    setSaving(true);

    // Create program
    const { data: program } = await supabase
      .from("diet_programs" as any)
      .insert({ area_id: areaId, user_id: user.id, free_meals_per_week: freeMeals } as any)
      .select("id")
      .single();

    if (!program) { setSaving(false); return; }
    const programId = (program as any).id;

    // Create meals
    for (let i = 0; i < MEAL_ORDER.length; i++) {
      const mealType = MEAL_ORDER[i];
      if (!activeMeals[mealType]) continue;

      const { data: meal } = await supabase
        .from("diet_program_meals" as any)
        .insert({ program_id: programId, meal_type: mealType, order: i } as any)
        .select("id")
        .single();

      if (!meal) continue;
      const mealId = (meal as any).id;

      // Create items
      const items = mealItems[mealType].filter(v => v.trim());
      for (let j = 0; j < items.length; j++) {
        await supabase
          .from("diet_meal_items" as any)
          .insert({ meal_id: mealId, name: items[j].trim(), order: j } as any);
      }
    }

    setSaving(false);
    setOpen(false);
    onCreated();
  };

  const getMealLabel = (m: MealType) => MEAL_LABELS[m][locale as "en" | "it"] || MEAL_LABELS[m].en;

  return (
    <>
      {/* Empty state card */}
      <div className="flex flex-col items-center justify-center gap-4 py-10 px-4">
        <Apple size={48} className="text-primary" strokeWidth={1.5} />
        <h2 className="text-base font-semibold text-center">
          {t("diet.wizard.title")}
        </h2>
        <p className="text-sm text-muted-foreground text-center">
          {t("diet.wizard.subtitle")}
        </p>
        <button
          onClick={() => { setOpen(true); setStep(1); }}
          className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base min-h-[44px]"
        >
          {t("diet.wizard.cta")}
        </button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {step === 1
                ? (locale === "it" ? "Seleziona pasti" : "Select meals")
                : step === 2
                ? (locale === "it" ? "Componenti" : "Components")
                : (locale === "it" ? "Pasti liberi" : "Free meals")}
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-4 overflow-y-auto max-h-[50vh]">
            {step === 1 && (
              <div className="flex flex-col gap-3">
                {MEAL_ORDER.map(m => (
                  <div key={m} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">{getMealLabel(m)}</span>
                    <Switch checked={activeMeals[m]} onCheckedChange={() => toggleMeal(m)} />
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-4">
                {activeWithItems.map(m => (
                  <div key={m} className="flex flex-col gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      {getMealLabel(m)}
                    </p>
                    {mealItems[m].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={item}
                          onChange={e => updateItem(m, idx, e.target.value)}
                          placeholder={locale === "it" ? "es. Yogurt" : "e.g. Yogurt"}
                          className="bg-background border-border h-9 text-sm flex-1"
                        />
                        {mealItems[m].length > 1 && (
                          <button
                            onClick={() => removeItem(m, idx)}
                            className="text-muted-foreground text-xs min-h-[32px] px-1 hover:text-destructive"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addItem(m)}
                      className="text-xs text-primary hover:opacity-80 min-h-[32px]"
                    >
                      + {locale === "it" ? "Aggiungi" : "Add"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {locale === "it"
                    ? "Quanti pasti liberi a settimana vuoi concederti?"
                    : "How many free meals per week do you allow?"}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFreeMeals(Math.max(0, freeMeals - 1))}
                    className="w-10 h-10 rounded-lg bg-background border border-border text-lg font-medium min-h-[44px]"
                  >
                    −
                  </button>
                  <span className="text-2xl font-semibold w-10 text-center">{freeMeals}</span>
                  <button
                    onClick={() => setFreeMeals(Math.min(14, freeMeals + 1))}
                    className="w-10 h-10 rounded-lg bg-background border border-border text-lg font-medium min-h-[44px]"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <DrawerFooter>
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!hasAtLeastOneMeal}
                className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40"
              >
                {locale === "it" ? "Avanti" : "Next"}
              </button>
            )}
            {step === 2 && (
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setStep(1)}
                  className="min-h-[48px] px-4 rounded-xl ring-1 ring-border text-sm font-medium"
                >
                  ←
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!allMealsHaveItems}
                  className="flex-1 min-h-[48px] rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40"
                >
                  {locale === "it" ? "Avanti" : "Next"}
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setStep(2)}
                  className="min-h-[48px] px-4 rounded-xl ring-1 ring-border text-sm font-medium"
                >
                  ←
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 min-h-[48px] rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40"
                >
                  {saving
                    ? "..."
                    : t("diet.wizard.createPlan")}
                </button>
              </div>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
