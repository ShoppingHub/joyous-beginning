import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { ArrowLeft } from "lucide-react";
import { AreaTypePill } from "@/components/AreaTypePill";
import { ScheduledDaysSection } from "@/components/area-detail/ScheduledDaysSection";
import { NotesHistorySection } from "@/components/area-detail/NotesHistorySection";
import { GymCard } from "@/components/GymCard";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { getDemoAreas } from "@/lib/demoData";
import { track } from "@/lib/analytics";
import { getDemoAreas } from "@/lib/demoData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

export default function AreaDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [area, setArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    if (!id) return;
    if (isDemo) {
      const demoArea = getDemoAreas().find((a) => a.id === id);
      setArea(demoArea || null);
      setLoading(false);
      return;
    }
    if (!user) return;
    const { data } = await supabase.from("areas").select("*").eq("id", id).single();
    setArea(data || null);
    setLoading(false);
  }, [user, isDemo, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Track area detail viewed
  useEffect(() => {
    if (area) {
      track("area_detail_viewed", { area_type: area.type });
    }
  }, [area?.id]);

  const handleArchive = async () => {
    if (!id) return;
    await supabase.from("areas").update({ archived_at: new Date().toISOString() }).eq("id", id);
    navigate("/activities", { replace: true });
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8 gap-4">
        <div className="flex items-center gap-3 h-14">
          <div className="h-6 w-6 rounded bg-card animate-pulse" />
          <div className="h-5 w-32 rounded bg-card animate-pulse" />
        </div>
        <div className="rounded-xl bg-card animate-pulse h-24" />
        <div className="rounded-xl bg-card animate-pulse h-24" />
      </motion.div>
    );
  }

  if (!area) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          {locale === "it" ? "Attività non trovata" : "Activity not found"}
        </p>
      </div>
    );
  }

  const isGymArea = area.type === "health" && /^(gym|palestra)$/i.test(area.name);

  const handleAutoCheckIn = async () => {
    if (!user || !id) return;
    try {
      await supabase.from("checkins").upsert(
        { area_id: id, user_id: user.id, date: today, completed: true },
        { onConflict: "area_id,date" }
      );
      const { data: sessionData } = await supabase.auth.getSession();
      await supabase.functions.invoke("calculate-score", {
        body: { area_id: id, date: today },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
    } catch { /* silent */ }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/activities")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </button>
          <span className="text-[18px] font-semibold">{area.name}</span>
          <AreaTypePill type={area.type} />
        </div>
        {!isDemo && (
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/activities/${id}/edit`)} className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] flex items-center">
              {t("areas.edit" as any)}
            </button>
            <button onClick={() => setShowArchiveDialog(true)} className="text-sm text-destructive hover:opacity-80 transition-opacity min-h-[44px] flex items-center">
              {t("areas.archive" as any)}
            </button>
          </div>
        )}
      </div>

      {/* Scheduled Days */}
      <div className="mt-6">
        <ScheduledDaysSection
          areaId={id!}
          frequencyPerWeek={area.frequency_per_week}
          isDemo={isDemo}
          recurrenceType={area.recurrence_type}
          biweeklyStartDate={area.biweekly_start_date}
          onBiweeklyStartDateChange={(d) => setArea(prev => prev ? { ...prev, biweekly_start_date: d } : prev)}
        />
      </div>

      {/* Gym Card */}
      {!isDemo && isGymArea && id && (
        <div className="mt-6">
          <GymCard areaId={id} onAutoCheckIn={handleAutoCheckIn} />
        </div>
      )}

      {/* Notes History */}
      <div className="mt-6">
        <NotesHistorySection areaId={id!} isDemo={isDemo} />
      </div>

      {/* Archive confirmation */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("areaForm.delete.confirm.title" as any)}</AlertDialogTitle>
            <AlertDialogDescription>{t("areaForm.delete.confirm.desc" as any)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("areaForm.delete.confirm.no" as any)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>{t("areaForm.delete.confirm.yes" as any)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}