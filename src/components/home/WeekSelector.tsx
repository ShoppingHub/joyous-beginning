import { useMemo } from "react";
import { addDays, startOfWeek, format, isAfter, isSameDay } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "@/i18n/translations";

interface WeekSelectorProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  weekOffset: number;
  onChangeWeek: (delta: number) => void;
  locale: Locale;
  checkedDates: Set<string>;
}

export function WeekSelector({
  selectedDate,
  onSelectDate,
  weekOffset,
  onChangeWeek,
  locale,
  checkedDates,
}: WeekSelectorProps) {
  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(
    () => addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7),
    [today, weekOffset]
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const dtLocale = locale === "it" ? it : enUS;

  // Can't go forward beyond current week
  const canGoForward = weekOffset < 0;

  return (
    <div className="flex items-center gap-1 px-2">
      <button
        onClick={() => onChangeWeek(-1)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground transition-colors min-h-[36px]"
        aria-label="Previous week"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex flex-1 justify-between gap-1">
        {days.map((day) => {
          const isFuture = isAfter(day, today) && !isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const dateStr = format(day, "yyyy-MM-dd");
          const hasCheckin = checkedDates.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => !isFuture && onSelectDate(day)}
              disabled={isFuture}
              className={`flex flex-col items-center justify-center w-10 h-14 rounded-xl text-xs font-medium transition-all relative ${
                isFuture
                  ? "opacity-30 cursor-not-allowed"
                  : isSelected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                  ? "ring-1 ring-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <span className="text-[10px] uppercase leading-none">
                {format(day, "EEE", { locale: dtLocale }).slice(0, 2)}
              </span>
              <span className="text-sm font-semibold mt-0.5">
                {format(day, "d")}
              </span>
              {hasCheckin && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
              {hasCheckin && isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-foreground" />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => canGoForward && onChangeWeek(1)}
        disabled={!canGoForward}
        className={`flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground transition-colors min-h-[36px] ${
          !canGoForward ? "opacity-30 cursor-not-allowed" : ""
        }`}
        aria-label="Next week"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
