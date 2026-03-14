import { useMemo } from "react";
import { subDays, format, isFuture, isToday } from "date-fns";

interface CalendarHeatmapProps {
  checkins: Record<string, boolean>; // date string -> completed
  loading?: boolean;
}

export function CalendarHeatmap({ checkins, loading }: CalendarHeatmapProps) {
  const days = useMemo(() => {
    const result: { date: string; status: "completed" | "missed" | "future" }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      if (isFuture(d) && !isToday(d)) {
        result.push({ date: dateStr, status: "future" });
      } else if (checkins[dateStr]) {
        result.push({ date: dateStr, status: "completed" });
      } else {
        result.push({ date: dateStr, status: "missed" });
      }
    }
    return result;
  }, [checkins]);

  if (loading) {
    return (
      <div className="flex gap-0.5 overflow-x-auto py-2">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="w-7 h-7 rounded-sm bg-card animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  const statusStyles = {
    completed: "bg-[#7DA3A0]/60",
    missed: "bg-[#BFA37A]/40",
    future: "bg-[#1F4A50]/30",
  };

  return (
    <div className="flex gap-0.5 overflow-x-auto py-2">
      {days.map((day) => (
        <div
          key={day.date}
          className={`w-7 h-7 rounded-sm flex-shrink-0 ${statusStyles[day.status]}`}
        />
      ))}
    </div>
  );
}
