import { useState, useMemo } from "react";
import { getISOWeek, startOfWeek, addDays, isSameWeek, format } from "date-fns";
import { it as itLocale, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "@/i18n/translations";

interface WeekBannerProps {
  weekOffset: number;
  onGoToWeek: (offset: number) => void;
  locale: Locale;
}

export function WeekBanner({ weekOffset, onGoToWeek, locale }: WeekBannerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);

  const currentWeekStart = useMemo(
    () => addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7),
    [today, weekOffset]
  );

  const weekNumber = getISOWeek(currentWeekStart);
  const label = locale === "it" ? `Settimana ${weekNumber}` : `Week ${weekNumber}`;

  const [selectedDay, setSelectedDay] = useState<Date | undefined>(currentWeekStart);
  const [calMonth, setCalMonth] = useState<Date>(currentWeekStart);

  const dtLocale = locale === "it" ? itLocale : enUS;

  const handleOpen = () => {
    setSelectedDay(currentWeekStart);
    setCalMonth(currentWeekStart);
    setOpen(true);
  };

  const handleGoToSelected = () => {
    if (!selectedDay) return;
    const selWeekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const diffMs = selWeekStart.getTime() - todayWeekStart.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    onGoToWeek(diffWeeks);
    setOpen(false);
  };

  const handleGoToToday = () => {
    onGoToWeek(0);
    setOpen(false);
  };

  // Highlight the entire selected week
  const selectedWeekDays = useMemo(() => {
    if (!selectedDay) return [];
    const ws = startOfWeek(selectedDay, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [selectedDay]);

  const monthYear = format(calMonth, "MMMM yyyy", { locale: dtLocale });

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center justify-center py-1.5 rounded-lg bg-card text-sm font-medium text-foreground hover:bg-accent transition-colors"
      >
        <span>{label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[360px] p-0 gap-0">
          <DialogTitle className="sr-only">{label}</DialogTitle>

          {/* Month + Year header */}
          <div className="text-center py-3 text-base font-semibold capitalize border-b border-border">
            {monthYear}
          </div>

          {/* Calendar */}
          <div className="flex justify-center px-2 py-2">
            <DayPicker
              mode="single"
              selected={selectedDay}
              onSelect={setSelectedDay}
              month={calMonth}
              onMonthChange={setCalMonth}
              weekStartsOn={1}
              locale={dtLocale}
              showOutsideDays
              modifiers={{ weekHighlight: selectedWeekDays }}
              modifiersClassNames={{
                weekHighlight: "bg-primary/10 rounded-none",
              }}
              className={cn("p-3 pointer-events-auto")}
              classNames={{
                months: "flex flex-col space-y-4",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  buttonVariants({ variant: "outline" }),
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                day: cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
                ),
                day_selected:
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "ring-1 ring-primary text-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_hidden: "invisible",
              }}
              components={{
                IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                IconRight: () => <ChevronRight className="h-4 w-4" />,
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 px-4 pb-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleGoToToday}
            >
              ← {locale === "it" ? "Oggi" : "Today"}
            </Button>
            <Button
              className="flex-1"
              onClick={handleGoToSelected}
            >
              {locale === "it" ? "Vai" : "Go"} →
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
