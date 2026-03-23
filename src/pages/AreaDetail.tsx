import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { ArrowLeft, Dumbbell, ChevronRight, Pencil, Trash2, Heart, BookOpen, TrendingDown, Wallet, Briefcase } from "lucide-react";
import { AreaTypePill } from "@/components/AreaTypePill";
import { ScheduledDaysSection } from "@/components/area-detail/ScheduledDaysSection";
import { NotesHistorySection } from "@/components/area-detail/NotesHistorySection";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { getDemoAreas } from "@/lib/demoData";
import { track } from "@/lib/analytics";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];

const areaTypeIcons: Record<AreaType, React.ElementType> = {
  health: Heart,
  study: BookOpen,
  reduce: TrendingDown,
  finance: Wallet,
  career: Briefcase,
};

export default function AreaDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [area, setArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [keepData, setKeepData] = useState(true);
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

  useEffect(() => {
    if (area) {
      track("area_detail_viewed", { area_type: area.type });
    }
  }, [area?.id]);

  const handleDelete = async () => {
    if (!id) return;
    if (keepData) {
      // Archive but keep data for progress
      await supabase.from("areas").update({ archived_at: new Date().toISOString(), data_retained: true }).eq("id", id);
    } else {
      // Archive and mark data as not retained
      await supabase.from("areas").update({ archived_at: new Date().toISOString(), data_retained: false }).eq("id", id);
    }
    track("area_deleted", { area_type: area?.type, data_retained: keepData });
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
  const AreaIcon = areaTypeIcons[area.type];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8">
      {/* Row 1: pill left + action icons right */}
      <div className="flex items-center justify-between h-10">
        <AreaTypePill type={area.type} />
        {!isDemo && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => navigate(`/activities/${id}/edit`)}
              className="flex items-center justify-center h-9 w-9 min-h-[40px] min-w-[40px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t("areas.edit" as any)}
            >
              <Pencil size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center justify-center h-9 w-9 min-h-[40px] min-w-[40px] rounded-lg text-destructive hover:opacity-80 hover:bg-destructive/10 transition-colors"
              title={t("areas.delete" as any)}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Row 2: back + activity name */}
      <div className="flex items-center h-12">
        <button onClick={() => navigate("/activities")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px] shrink-0">
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
        <div className="flex-1 flex items-center justify-center -ml-10">
          <span className="text-[18px] font-semibold truncate max-w-[260px]">{area.name}</span>
        </div>
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

      {/* Gym Card link */}
      {isGymArea && (
        <button
          onClick={() => navigate("/cards/gym")}
          className="mt-6 flex items-center justify-between w-full bg-[#1F4A50]/60 rounded-lg border border-[#7DA3A0]/20 border-dashed p-4 transition-colors hover:bg-[#1F4A50]/80"
        >
          <div className="flex items-center gap-3">
            <Dumbbell size={20} strokeWidth={1.5} className="text-primary" />
            <span className="text-sm font-medium">{t("gym.title" as any)}</span>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground" />
        </button>
      )}

      {/* Notes History */}
      <div className="mt-6">
        <NotesHistorySection areaId={id!} isDemo={isDemo} />
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("areaForm.delete.confirm.title" as any)}</AlertDialogTitle>
            <AlertDialogDescription>{t("areaForm.delete.confirm.desc" as any)}</AlertDialogDescription>
          </AlertDialogHeader>

          {/* Keep data toggle */}
          <div className="flex items-start gap-3 rounded-lg border border-muted-foreground/20 p-3 my-1">
            <Switch checked={keepData} onCheckedChange={setKeepData} className="mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("areaForm.delete.keepData" as any)}</span>
              <span className="text-xs text-muted-foreground">{t("areaForm.delete.keepDataDesc" as any)}</span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("areaForm.delete.confirm.no" as any)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("areaForm.delete.confirm.yes" as any)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
