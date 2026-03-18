import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Plus, ChevronRight, Heart, BookOpen, TrendingDown, Wallet, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { getDemoAreas } from "@/lib/demoData";
import { CardEntryPoints } from "@/components/CardEntryPoints";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { TranslationKey } from "@/i18n/translations";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];

const sections: { type: AreaType; labelKey: TranslationKey; icon: typeof Heart }[] = [
  { type: "health", labelKey: "areas.section.health", icon: Heart },
  { type: "study", labelKey: "areas.section.study", icon: BookOpen },
  { type: "reduce", labelKey: "areas.section.reduce", icon: TrendingDown },
  { type: "finance", labelKey: "areas.section.finance", icon: Wallet },
];

const Areas = () => {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayQuantities, setTodayQuantities] = useState<Record<string, number>>({});
  const [archiveTarget, setArchiveTarget] = useState<Area | null>(null);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const fetchAreas = useCallback(async () => {
    if (isDemo) {
      setAreas(getDemoAreas());
      setLoading(false);
      return;
    }
    if (!user) return;
    const { data } = await supabase
      .from("areas").select("*").eq("user_id", user.id)
      .is("archived_at", null).order("created_at", { ascending: true });
    if (data) {
      setAreas(data);
      const qAreas = data.filter((a) => a.tracking_mode === "quantity_reduce");
      if (qAreas.length > 0) {
        const { data: qData } = await supabase
          .from("habit_quantity_daily" as any)
          .select("area_id, quantity")
          .in("area_id", qAreas.map((a) => a.id))
          .eq("date", todayStr);
        if (qData) {
          const map: Record<string, number> = {};
          for (const r of qData as any[]) map[r.area_id] = r.quantity;
          setTodayQuantities(map);
        }
      }
    }
    setLoading(false);
  }, [user, isDemo, todayStr]);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  const handleArchive = async () => {
    if (!archiveTarget) return;
    await supabase.from("areas").update({ archived_at: new Date().toISOString() }).eq("id", archiveTarget.id);
    setArchiveTarget(null);
    fetchAreas();
  };

  const grouped = (type: AreaType) => areas.filter((a) => a.type === type);

  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <div className="flex items-center justify-between h-14">
          <div className="h-5 w-16 rounded bg-card animate-pulse" />
          <div className="h-8 w-8 rounded bg-card animate-pulse" />
        </div>
        <div className="flex flex-col gap-8 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-24 rounded bg-card animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-card animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8">
      <div className="flex items-center justify-between h-12">
        <h1 className="text-[18px] font-semibold">{t("areas.title")}</h1>
        {!isDemo && (
          <button onClick={() => navigate("/activities/new")}
            className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <Plus size={24} strokeWidth={1.5} className="text-primary" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-8 mt-2">
        {sections.map(({ type, labelKey, icon: Icon }) => {
          const items = grouped(type);
          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon size={16} strokeWidth={1.5} className="text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{t(labelKey)}</span>
              </div>
              {items.map((area) => {
                const isQuantity = area.tracking_mode === "quantity_reduce";
                const qty = todayQuantities[area.id] ?? 0;
                return (
                  <div key={area.id} className="flex items-center gap-1">
                    <button onClick={() => navigate(`/activities/${area.id}`)}
                      className="flex-1 flex items-center justify-between rounded-lg bg-card px-4 min-h-[48px] hover:opacity-90 transition-opacity">
                      <span className="text-base text-foreground truncate mr-3">{area.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isQuantity && (
                          <span className="text-sm text-muted-foreground">
                            {qty} {t("reduce.today")}
                          </span>
                        )}
                        <ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground" />
                      </div>
                    </button>
                    {!isDemo && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors">
                            <MoreVertical size={18} strokeWidth={1.5} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/activities/${area.id}/edit`)}>
                            {t("areas.edit" as any)}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setArchiveTarget(area)}
                          >
                            {t("areas.archive" as any)}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
              {/* Card entry points for this section */}
              <CardEntryPoints section={type} areas={items.map(a => ({ id: a.id, name: a.name }))} />
              {!isDemo && (
                <button onClick={() => navigate(`/activities/new?type=${type}`)}
                  className="text-sm font-medium text-primary hover:opacity-80 transition-opacity min-h-[36px] flex items-center">
                  {t("areas.add")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Archive confirmation dialog */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
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
};

export default Areas;
