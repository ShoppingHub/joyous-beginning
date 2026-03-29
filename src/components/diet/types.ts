export interface DietProgram {
  id: string;
  area_id: string;
  user_id: string;
  name: string;
  mode: string;
  free_meals_per_week: number;
  created_at: string;
}

export interface DietProgramMeal {
  id: string;
  program_id: string;
  meal_type: MealType;
  active: boolean;
  order: number;
}

export interface DietMealItem {
  id: string;
  meal_id: string;
  name: string;
  grams: number | null;
  max_per_week: number | null;
  active: boolean;
  order: number;
}

export interface DietSession {
  id: string;
  area_id: string;
  user_id: string;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface DietSessionMeal {
  id: string;
  session_id: string;
  program_meal_id: string;
  completed: boolean;
  is_free: boolean;
}

export interface DietSessionItem {
  id: string;
  session_meal_id: string;
  meal_item_id: string;
  consumed: boolean;
}

export type MealType = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner";

export const MEAL_ORDER: MealType[] = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];

export const MEAL_LABELS: Record<MealType, { en: string; it: string }> = {
  breakfast: { en: "Breakfast", it: "Colazione" },
  morning_snack: { en: "Morning snack", it: "Spuntino mattina" },
  lunch: { en: "Lunch", it: "Pranzo" },
  afternoon_snack: { en: "Afternoon snack", it: "Spuntino pomeriggio" },
  dinner: { en: "Dinner", it: "Cena" },
};
