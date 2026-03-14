import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Eye } from "lucide-react";
import { motion } from "framer-motion";
import { format, isAfter, isSameDay, getISODay } from "date-fns";
import { getDemoAreas, getDemoTodayCheckins } from "@/lib/demoData";
import { WeekSelector } from "@/components/home/WeekSelector";
import { ActivityCard } from "@/components/home/ActivityCard";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

interface GymDayInfo {
  areaId: string;
  dayLabel: string;
  dayName: string;
  hasProgram: boolean;
}

interface ScheduledDay {
  area_id: string;
  day_of_week: number;
}

const Index = () => {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [areas, setAreas] = useState<Area[]>([]);
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [checkInLoadingId, setCheckInLoadingId] = useState<string | null>(null);
  const [gymDayInfo, setGymDayInfo] = useState<GymDayInfo | null>(null);
  const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set());
  const [scheduledDays, setScheduledDays] = useState<ScheduledDay[]>([]);

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const isFutureDay = isAfter(selectedDate, today) && !isSameDay(selectedDate, today);
  const selectedDayOfWeek = getISODay(selectedDate); // 1=Mon ... 7=Sun

  // Fetch areas once
  useEffect(() => {
    if (isDemo) {
      setAreas(getDemoAreas());
      return;
    }
    if (!user) return;
    (async () => {
      const [areasRes, scheduledRes] = await Promise.all([
        supabase
          .from("areas")
          .select("*")
          .eq("user_id", user.id)
          .is("archived_at", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("area_scheduled_days")
          .select("area_id, day_of_week")
          .eq("user_id", user.id),
      ]);
      setAreas(areasRes.data || []);
      setScheduledDays((scheduledRes.data as ScheduledDay[]) || []);
    })();
  }, [user, isDemo]);

  // Filter areas by scheduled day
  const filteredAreas = useMemo(() => {
    return areas.filter(area => {
      const areaSchedule = scheduledDays.filter(sd => sd.area_id === area.id);
      if (areaSchedule.length === 0) return true; // no schedule = show every day
      return areaSchedule.some(sd => sd.day_of_week === selectedDayOfWeek);
    });
  }, [areas, scheduledDays, selectedDayOfWeek]);

  // Fetch check-ins + notes for selected date
  const fetchDayData = useCallback(async () => {
    if (isDemo) {
      setCheckedIn(getDemoTodayCheckins());
      setNotes({});
      setLoading(false);
      return;
    }
    if (!user) return;
    setLoading(true);

    const [checkinsRes, notesRes] = await Promise.all([
      supabase
        .from("checkins")
        .select("area_id, completed")
        .eq("user_id", user.id)
        .eq("date", selectedDateStr)
        .eq("completed", true),
      supabase
        .from("activity_notes" as any)
        .select("area_id, content")
        .eq("user_id", user.id)
        .eq("date", selectedDateStr),
    ]);

    const map: Record<string, boolean> = {};
    if (checkinsRes.data) {
      for (const c of checkinsRes.data) map[c.area_id] = true;
    }
    setCheckedIn(map);

    const noteMap: Record<string, string> = {};
    if (notesRes.data) {
      for (const n of notesRes.data as any[]) noteMap[n.area_id] = n.content;
    }
    setNotes(noteMap);

    setLoading(false);
  }, [user, isDemo, selectedDateStr]);

  useEffect(() => {
    fetchDayData();
  }, [fetchDayData]);

  // Fetch week check-in dots
  useEffect(() => {
    if (isDemo || !user) return;
    (async () => {
      const { addDays, startOfWeek } = await import("date-fns");
      const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7);
      const weekEnd = addDays(weekStart, 6);
      const { data } = await supabase
        .from("checkins")
        .select("date")
        .eq("user_id", user.id)
        .eq("completed", true)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));
      if (data) {
        setCheckedDates(new Set(data.map((r) => r.date)));
      }
    })();
  }, [user, isDemo, weekOffset, today, checkedIn]);

  // Fetch gym day info
  useEffect(() => {
    if (isDemo || !user || areas.length === 0) return;
    const gymArea = areas.find(
      (a) => a.type === "health" && /^(gym|palestra)$/i.test(a.name)
    );
    if (!gymArea) { setGymDayInfo(null); return; }

    (async () => {
      try {
        const { data: program } = await supabase
          .from("gym_programs")
          .select("id")
          .eq("area_id", gymArea.id)
          .single();
        if (!program) { setGymDayInfo({ areaId: gymArea.id, dayLabel: "", dayName: "", hasProgram: false }); return; }

        const { data: days } = await supabase
          .from("gym_program_days")
          .select("id, name, order")
          .eq("program_id", program.id)
          .order("order");
        if (!days || days.length === 0) { setGymDayInfo({ areaId: gymArea.id, dayLabel: "", dayName: "", hasProgram: true }); return; }

        const { data: lastSession } = await supabase
          .from("gym_sessions")
          .select("day_id")
          .eq("area_id", gymArea.id)
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(1)
          .single();

        let nextDay = days[0];
        if (lastSession) {
          const lastIdx = days.findIndex((d) => d.id === lastSession.day_id);
          nextDay = days[(lastIdx + 1) % days.length];
        }

        const { data: groups } = await supabase
          .from("gym_muscle_groups")
          .select("name")
          .eq("day_id", nextDay.id)
          .order("order");
        const groupNames = groups?.map((g) => g.name).join(", ") || "";
        const dayNumber = nextDay.order + 1;
        const dayLabel = locale === "it" ? `Giorno ${dayNumber}` : `Day ${dayNumber}`;

        setGymDayInfo({ areaId: gymArea.id, dayLabel, dayName: groupNames, hasProgram: true });
      } catch {
        setGymDayInfo(null);
      }
    })();
  }, [user, isDemo, areas, locale]);

  // Check-in handler
  const handleCheckIn = async (areaId: string) => {
    if (isDemo || !user) return;
    setCheckInLoadingId(areaId);
    setCheckedIn((prev) => ({ ...prev, [areaId]: true }));
    try {
      const { error } = await supabase.from("checkins").upsert(
        { area_id: areaId, user_id: user.id, date: selectedDateStr, completed: true },
        { onConflict: "area_id,date" }
      );
      if (error) throw error;
      if (isSameDay(selectedDate, today)) {
        const { data: sessionData } = await supabase.auth.getSession();
        await supabase.functions.invoke("calculate-score", {
          body: { area_id: areaId, date: selectedDateStr },
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
        });
      }
    } catch {
      setCheckedIn((prev) => ({ ...prev, [areaId]: false }));
    } finally {
      setCheckInLoadingId(null);
    }
  };

  // Undo check-in
  const handleUndoCheckIn = async (areaId: string) => {
    if (isDemo || !user) return;
    setCheckInLoadingId(areaId);
    setCheckedIn((prev) => ({ ...prev, [areaId]: false }));
    try {
      const { error } = await supabase
        .from("checkins")
        .delete()
        .eq("area_id", areaId)
        .eq("user_id", user.id)
        .eq("date", selectedDateStr);
      if (error) throw error;
    } catch {
      setCheckedIn((prev) => ({ ...prev, [areaId]: true }));
    } finally {
      setCheckInLoadingId(null);
    }
  };

  // Save note
  const handleSaveNote = async (areaId: string, content: string) => {
    if (isDemo || !user) return;
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      setNotes((prev) => { const n = { ...prev }; delete n[areaId]; return n; });
      await supabase
        .from("activity_notes" as any)
        .delete()
        .eq("area_id", areaId)
        .eq("user_id", user.id)
        .eq("date", selectedDateStr);
    } else {
      setNotes((prev) => ({ ...prev, [areaId]: trimmed }));
      await (supabase.from("activity_notes" as any) as any).upsert(
        { area_id: areaId, user_id: user.id, date: selectedDateStr, content: trimmed },
        { onConflict: "area_id,date,user_id" }
      );
    }
  };

  const allCheckedIn = filteredAreas.length > 0 && filteredAreas.every((a) => checkedIn[a.id]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14">
        <span className="text-[18px] font-semibold">
          <span className="text-foreground">opad</span>
          <span style={{ color: "#B5453A" }}>.me</span>
        </span>
      </div>

      {/* Week selector */}
      <div className="px-2 pb-3">
        <WeekSelector
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          weekOffset={weekOffset}
          onChangeWeek={(d) => setWeekOffset((o) => o + d)}
          locale={locale}
          checkedDates={checkedDates}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-card animate-pulse h-20" />
          ))}
        </div>
      ) : areas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <Eye size={48} className="text-primary" strokeWidth={1.5} />
          <div className="text-center space-y-2">
            <p className="text-[18px] font-medium">{t("home.empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("home.empty.description")}</p>
          </div>
          <button
            onClick={() => navigate("/activities")}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
          >
            {t("home.empty.button")}
          </button>
        </div>
      ) : filteredAreas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <p className="text-sm text-muted-foreground text-center">{t("home.noScheduled")}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex flex-col gap-3 px-4 pb-4"
        >
          {filteredAreas.map((area) => {
            const isGym =
              area.type === "health" && /^(gym|palestra)$/i.test(area.name);
            const hasGymProgram = isGym && (gymDayInfo?.areaId === area.id) && (gymDayInfo?.hasProgram ?? false);

            return (
              <ActivityCard
                key={area.id}
                area={area}
                isCheckedIn={!!checkedIn[area.id]}
                isLoading={checkInLoadingId === area.id}
                isFutureDay={isFutureDay}
                selectedDateStr={selectedDateStr}
                onCheckIn={handleCheckIn}
                onUndoCheckIn={handleUndoCheckIn}
                isGym={isGym}
                hasGymProgram={hasGymProgram}
                gymDayLabel={gymDayInfo?.areaId === area.id ? gymDayInfo.dayLabel : undefined}
                gymDayName={gymDayInfo?.areaId === area.id ? gymDayInfo.dayName : undefined}
                note={notes[area.id] || ""}
                onSaveNote={handleSaveNote}
              />
            );
          })}

          {allCheckedIn && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              {t("home.allLogged")}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default Index;
