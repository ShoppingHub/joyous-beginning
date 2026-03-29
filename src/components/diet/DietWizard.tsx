import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Apple } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [activeMeals, setActiveMeals] = useState<Record<MealType, boolean>>({
    breakfast: true,
    morning_snack: false,
    lunch: true,
    afternoon_snack: false,
    dinner: true,
  });
  const [mealItems, setMealItems] = useState<Record<MealType, { name: string; grams: string }[]>>({
    breakfast: [{ name: "", grams: "" }],
    morning_snack: [{ name: "", grams: "" }],
    lunch: [{ name: "", grams: "" }],
    afternoon_snack: [{ name: "", grams: "" }],
    dinner: [{ name: "", grams: "" }],
  });
  const [freeMeals, setFreeMeals] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const toggleMeal = (meal: MealType) => {
    setActiveMeals(prev => ({ ...prev, [meal]: !prev[meal] }));
  };

  const hasAtLeastOneMeal = MEAL_ORDER.some(m => activeMeals[m]);

  const addItem = (meal: MealType) => {
    setMealItems(prev => ({ ...prev, [meal]: [...prev[meal], { name: "", grams: "" }] }));
  };

  const updateItem = (meal: MealType, idx: number, field: "name" | "grams", value: string) => {
    setMealItems(prev => ({
      ...prev,
      [meal]: prev[meal].map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
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
    m => mealItems[m].some(v => v.name.trim().length > 0)
  );

  const handleCreate = async () => {
    if (!user) return;
    setSaving(true);

    const { data: program } = await supabase
      .from("diet_programs" as any)
      .insert({ area_id: areaId, user_id: user.id, free_meals_per_week: freeMeals } as any)
      .select("id")
      .single();

    if (!program) { setSaving(false); return; }
    const programId = (program as any).id;

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

      const items = mealItems[mealType].filter(v => v.name.trim());
      for (let j = 0; j < items.length; j++) {
        const gramsVal = items[j].grams ? parseInt(items[j].grams) : null;
        await supabase
          .from("diet_meal_items" as any)
          .insert({ meal_id: mealId, name: items[j].name.trim(), grams: gramsVal, order: j } as any);
      }
    }

    setSaving(false);
    onCreated();
  };

  const getMealLabel = (m: MealType) => MEAL_LABELS[m][locale as "en" | "it"] || MEAL_LABELS[m].en;

  const stepTitle = step === 1
    ? (locale === "it" ? "Seleziona pasti" : "Select meals")
    : step === 2
    ? (locale === "it" ? "Componenti" : "Components")
    : (locale === "it" ? "Pasti liberi" : "Free meals");

  return (
    <div className="flex flex-col gap-4 mt-2">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "w-8 bg-primary" : "w-4 bg-muted"}`} />
        ))}
      </div>

      <h2 className="text-base font-semibold text-center">{stepTitle}</h2>

      {step === 1 && (
        <div className="flex flex-col gap-1">
          {MEAL_ORDER.map(m => (
            <div key={m} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-card">
              <span className="text-sm font-medium">{getMealLabel(m)}</span>
              <Switch checked={activeMeals[m]} onCheckedChange={() => toggleMeal(m)} />
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          {activeWithItems.map(m => (
            <div key={m} className="flex flex-col gap-2 rounded-xl bg-card p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {getMealLabel(m)}
              </p>
              {mealItems[m].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={e => updateItem(m, idx, "name", e.target.value)}
                    placeholder={locale === "it" ? "es. Yogurt" : "e.g. Yogurt"}
                    className="bg-background border-border h-9 text-sm flex-1"
                  />
                  <Input
                    value={item.grams}
                    onChange={e => updateItem(m, idx, "grams", e.target.value)}
                    type="number"
                    inputMode="numeric"
                    placeholder="g"
                    className="bg-background border-border h-9 text-sm w-16 text-center"
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
        <div className="flex flex-col gap-3 rounded-xl bg-card p-4">
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

      {/* Navigation buttons */}
      <div className="flex gap-2 mt-2">
        {step > 1 && (
          <button
            onClick={() => setStep((step - 1) as 1 | 2)}
            className="min-h-[48px] px-4 rounded-xl ring-1 ring-border text-sm font-medium"
          >
            ←
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={() => setStep((step + 1) as 2 | 3)}
            disabled={step === 1 ? !hasAtLeastOneMeal : !allMealsHaveItems}
            className="flex-1 min-h-[48px] rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40"
          >
            {locale === "it" ? "Avanti" : "Next"}
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 min-h-[48px] rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40"
          >
            {saving ? "..." : t("diet.wizard.createPlan")}
          </button>
        )}
      </div>
    </div>
  );
}
