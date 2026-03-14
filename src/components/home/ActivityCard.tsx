import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { QuantityCounter } from "./QuantityCounter";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

const NOTE_MAX = 1500;

interface ActivityCardProps {
  area: Area;
  isCheckedIn: boolean;
  isLoading: boolean;
  isFutureDay: boolean;
  selectedDateStr: string;
  onCheckIn: (areaId: string) => void;
  onUndoCheckIn: (areaId: string) => void;
  // Gym
  isGym: boolean;
  hasGymProgram: boolean;
  gymDayLabel?: string;
  gymDayName?: string;
  // Notes
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
  note,
  onSaveNote,
}: ActivityCardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(note);
  const [undoConfirm, setUndoConfirm] = useState(false);

  const hasNote = note.length > 0;
  const isQuantityReduce = area.tracking_mode === "quantity_reduce" && area.show_quick_add_home;
  const isQuantityNoQuickAdd = area.tracking_mode === "quantity_reduce" && !area.show_quick_add_home;

  // Determine CTA
  const handleCTAClick = () => {
    if (isFutureDay) return;

    if (isCheckedIn) {
      setUndoConfirm(true);
      return;
    }

    if (isGym && hasGymProgram) {
      onCheckIn(area.id);
      navigate(`/activities/${area.id}`);
      return;
    }

    onCheckIn(area.id);
  };

  const ctaLabel = isCheckedIn
    ? t("home.cta.observed")
    : isGym && hasGymProgram
    ? t("home.cta.openSession")
    : t("home.cta.done");

  const showGymDay = isGym && hasGymProgram && !isCheckedIn && gymDayLabel;

  // Quantity reduce card with quick-add
  if (isQuantityReduce) {
    return (
      <div className="rounded-xl bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-base font-medium truncate">{area.name}</p>
        </div>
        <QuantityCounter areaId={area.id} date={selectedDateStr} isFutureDay={isFutureDay} />
      </div>
    );
  }

  // Quantity reduce card without quick-add (just navigates)
  if (isQuantityNoQuickAdd) {
    return (
      <button
        onClick={() => navigate(`/activities/${area.id}`)}
        className="rounded-xl bg-card p-4 flex items-center justify-between w-full text-left hover:opacity-90 transition-opacity"
      >
        <p className="text-base font-medium truncate">{area.name}</p>
        <span className="text-sm text-muted-foreground">›</span>
      </button>
    );
  }

  // Standard binary card
  return (
    <div className="rounded-xl bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium truncate">{area.name}</p>
          {showGymDay && (
            <button
              onClick={() => navigate(`/activities/${area.id}`)}
              className="text-sm text-muted-foreground mt-0.5 hover:text-foreground transition-colors text-left"
            >
              {gymDayLabel}{gymDayName ? ` — ${gymDayName}` : ""} →
            </button>
          )}
        </div>

        {undoConfirm ? (
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
            onClick={handleCTAClick}
            disabled={isLoading || isFutureDay}
            className={`flex-shrink-0 min-h-[36px] px-4 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
              isCheckedIn
                ? "bg-primary/20 text-primary border-primary"
                : "bg-transparent text-foreground border-primary"
            } ${isLoading || isFutureDay ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              ctaLabel
            )}
          </button>
        )}
      </div>

      {/* Note toggle icon */}
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
