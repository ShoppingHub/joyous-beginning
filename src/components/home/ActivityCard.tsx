import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil, Check, Repeat, CalendarDays } from "lucide-react";
import { getISODay } from "date-fns";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";

import { QuantityCounter } from "./QuantityCounter";
import { MEAL_ORDER, MEAL_LABELS, type MealType } from "@/components/diet/types";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

const NOTE_MAX = 1500;

const WEEKDAY_SHORT: Record<string, string[]> = {
  it: ["", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"],
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

interface ActivityCardProps {
  area: Area;
  isCheckedIn: boolean;
  isLoading: boolean;
  isFutureDay: boolean;
  selectedDateStr: string;
  onCheckIn: (areaId: string) => void;
  onUndoCheckIn: (areaId: string) => void;
  isGym: boolean;
  hasGymProgram: boolean;
  gymDayLabel?: string;
  gymDayName?: string;
  gymDayOfWeek?: number | null;
  gymDayId?: string;
  isDiet?: boolean;
  dietDayInfo?: {
    areaId: string;
    hasProgram: boolean;
    meals: { mealId: string; mealType: string; completed: boolean; isFree: boolean }[];
  };
  note: string;
  onSaveNote: (areaId: string, content: string) => void;
}

export function ActivityCard({
  area,
  isCheckedIn,
  isLoading,
  isFutureDay,
  selectedDateStr,
  onCheckIn,
  onUndoCheckIn,
  isGym,
  hasGymProgram,
  gymDayLabel,
  gymDayName,
  gymDayOfWeek,
  gymDayId,
  isDiet,
  dietDayInfo,
  note,
  onSaveNote,
}: ActivityCardProps) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { isCardEnabled } = useUserCards();
  
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(note);
  const [undoConfirm, setUndoConfirm] = useState(false);

  const hasNote = note.length > 0;
  const isQuantityReduce = area.tracking_mode === "quantity_reduce" && area.show_quick_add_home;
  const isQuantityNoQuickAdd = area.tracking_mode === "quantity_reduce" && !area.show_quick_add_home;

  const todayDow = getISODay(new Date());
  const isGymToday = gymDayOfWeek != null && gymDayOfWeek === todayDow;
  const weekdays = WEEKDAY_SHORT[locale] || WEEKDAY_SHORT.en;

  const recurrenceType = (area as any).recurrence_type || "weekly";
  const recurrenceBadge = recurrenceType !== "weekly" ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">
      {recurrenceType === "biweekly" ? <Repeat size={11} /> : <CalendarDays size={11} />}
      {t(`recurrence.${recurrenceType}` as any)}
    </span>
  ) : null;

  const handleCTAClick = () => {
    if (isFutureDay) return;
    if (isCheckedIn) {
      setUndoConfirm(true);
      return;
    }
    if (isGym && hasGymProgram) {
      if (isCardEnabled("gym")) {
        navigate("/cards/gym");
      } else {
        onCheckIn(area.id);
        navigate(`/activities/${area.id}`);
      }
      return;
    }
    onCheckIn(area.id);
  };

  const handleDoneClick = () => {
    if (isFutureDay || isLoading) return;
    if (isCheckedIn) {
      setUndoConfirm(true);
    } else {
      onCheckIn(area.id);
    }
  };

  const showGymDay = isGym && hasGymProgram && gymDayLabel && isCardEnabled("gym");
  const showDietMeals = isDiet && isCardEnabled("diet") && dietDayInfo?.hasProgram && (dietDayInfo?.meals?.length ?? 0) > 0;

  // Diet progress: completed or free meals count
  const dietTotal = showDietMeals ? dietDayInfo!.meals.length : 0;
  const dietCompleted = showDietMeals ? dietDayInfo!.meals.filter(m => m.completed || m.isFree).length : 0;
  const dietAllDone = showDietMeals && dietTotal > 0 && dietCompleted === dietTotal;

  // Auto check-in when all diet meals are completed
  useEffect(() => {
    if (dietAllDone && !isCheckedIn && !isFutureDay && !isLoading) {
      onCheckIn(area.id);
    }
  }, [dietAllDone, isCheckedIn, isFutureDay, isLoading, area.id, onCheckIn]);


  const doneButton = (
    undoConfirm ? (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">{t("home.undo.confirm")}</span>
        <button
          onClick={() => { onUndoCheckIn(area.id); setUndoConfirm(false); }}
          className="text-xs font-medium text-destructive min-h-[36px] px-2"
        >
          {t("home.undo.yes")}
        </button>
        <button
          onClick={() => setUndoConfirm(false)}
          className="text-xs font-medium text-muted-foreground min-h-[36px] px-2"
        >
          {t("home.undo.no")}
        </button>
      </div>
    ) : (
      <button
        onClick={handleDoneClick}
        disabled={isLoading || isFutureDay}
        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
          isCheckedIn
            ? "bg-primary/20 text-primary"
            : "border border-border text-muted-foreground hover:text-foreground hover:border-primary"
        } ${isLoading || isFutureDay ? "opacity-30 cursor-not-allowed" : ""}`}
      >
        {isLoading ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Check size={16} />
        )}
      </button>
    )
  );

  // Quantity reduce card with quick-add (Plus active)
  if (isQuantityReduce) {
    return (
      <div className="rounded-xl bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-base font-medium truncate flex-1">{area.name}</p>
          {recurrenceBadge}
          {doneButton}
        </div>
        <div className="flex justify-center">
          <QuantityCounter areaId={area.id} date={selectedDateStr} isFutureDay={isFutureDay} />
        </div>
      </div>
    );
  }

  // Quantity reduce card without quick-add (Plus active)
  if (isQuantityNoQuickAdd) {
    return (
      <div className="rounded-xl bg-card p-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(`/activities/${area.id}`)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-base font-medium truncate">{area.name}</p>
          {recurrenceBadge}
        </button>
        {doneButton}
      </div>
    );
  }

  // Standard binary card (also used for quantity_reduce when Plus is locked)
  return (
    <div className="rounded-xl bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium truncate">{area.name}</p>
          {recurrenceBadge}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showDietMeals && (
            <span className={`text-xs font-medium ${dietAllDone ? "text-primary" : "text-muted-foreground"}`}>
              {dietCompleted}/{dietTotal}
            </span>
          )}
          {doneButton}
        </div>
      </div>

      {/* Gym day CTA - centered below name, with weekday badge */}
      {showGymDay && (
        <button
          onClick={() => isCardEnabled("gym") ? navigate(gymDayId ? `/cards/gym/${gymDayId}` : "/cards/gym") : navigate(`/activities/${area.id}`)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
        >
          {gymDayOfWeek != null && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${isGymToday ? "bg-primary text-primary-foreground font-semibold" : "bg-primary/20 text-primary"}`}>
              {weekdays[gymDayOfWeek]}
            </span>
          )}
          {gymDayLabel} →
        </button>
      )}

      {/* Diet CTA - like Gym, single button to /cards/diet + progress counter */}
      {showDietMeals && (
        <button
          onClick={() => navigate("/cards/diet")}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
        >
          {locale === "it" ? "Registra pasti" : "Log meals"} →
        </button>
      )}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setNoteOpen(!noteOpen);
            if (!noteOpen) setNoteText(note);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notes"
        >
          {hasNote ? (
            <Pencil size={16} className="text-primary" />
          ) : (
            <FileText size={16} />
          )}
        </button>
      </div>

      {/* Note expanded */}
      {noteOpen && (
        <div className="flex flex-col gap-2 mt-1">
          <textarea
            value={noteText}
            onChange={(e) => {
              if (e.target.value.length <= NOTE_MAX) setNoteText(e.target.value);
            }}
            rows={3}
            className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
            placeholder={t("gym.form.notesPlaceholder")}
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${NOTE_MAX - noteText.length <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {NOTE_MAX - noteText.length}
            </span>
            <button
              onClick={() => {
                onSaveNote(area.id, noteText);
                setNoteOpen(false);
              }}
              className="text-sm font-medium text-primary hover:opacity-80 transition-opacity min-h-[36px] px-3"
            >
              {t("home.note.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
