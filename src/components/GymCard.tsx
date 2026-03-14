import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Dumbbell, Settings } from "lucide-react";
import { GymWizard } from "./gym/GymWizard";
import { GymPlanEditor } from "./gym/GymPlanEditor";
import { GymSessionView } from "./gym/GymSession";
import { GymHistory } from "./gym/GymHistory";
import type { GymProgram } from "./gym/types";

interface GymCardProps {
  areaId: string;
  onAutoCheckIn: () => void;
}

export function GymCard({ areaId, onAutoCheckIn }: GymCardProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [program, setProgram] = useState<GymProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchProgram = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("gym_programs" as any)
      .select("*")
      .eq("area_id", areaId)
      .single();
    setProgram((data as any) || null);
    setLoading(false);
  }, [user, areaId]);

  useEffect(() => { fetchProgram(); }, [fetchProgram]);

  if (loading) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <div className="h-5 w-32 rounded bg-card animate-pulse" />
        <div className="h-14 rounded-lg bg-card animate-pulse" />
      </div>
    );
  }

  if (!program) {
    return <GymWizard areaId={areaId} onCreated={() => { fetchProgram(); }} />;
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={18} strokeWidth={1.5} className="text-primary" />
          <h2 className="text-base font-semibold">{t("gym.title")}</h2>
        </div>
        <button onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[36px] px-2">
          <Settings size={14} />
          {t("gym.plan.edit")}
        </button>
      </div>

      <GymSessionView
        key={refreshKey}
        programId={program.id}
        areaId={areaId}
        onAutoCheckIn={onAutoCheckIn}
      />

      <GymHistory areaId={areaId} programId={program.id} />

      <GymPlanEditor
        programId={program.id}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onChanged={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
