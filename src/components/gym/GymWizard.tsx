import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Dumbbell } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

interface GymWizardProps {
  areaId: string;
  onCreated: () => void;
}

export function GymWizard({ areaId, onCreated }: GymWizardProps) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [numDays, setNumDays] = useState(3);
  const [dayNames, setDayNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const dayPlaceholder = (i: number) =>
    locale === "it" ? `Giorno ${i + 1}` : `Day ${i + 1}`;

  const handleOpen = () => {
    const names = Array.from({ length: numDays }, (_, i) => dayPlaceholder(i));
    setDayNames(names);
    setOpen(true);
  };

  const handleNumChange = (val: number) => {
    const clamped = Math.max(1, Math.min(7, val));
    setNumDays(clamped);
    setDayNames(Array.from({ length: clamped }, (_, i) =>
      i < dayNames.length ? dayNames[i] : dayPlaceholder(i)
    ));
  };

  const handleCreate = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: program } = await supabase
        .from("gym_programs" as any)
        .insert({ area_id: areaId, user_id: user.id } as any)
        .select("id")
        .single();
      if (!program) return;

      const days = dayNames.map((name, i) => ({
        program_id: (program as any).id,
        name: name.trim() || dayPlaceholder(i),
        order: i,
      }));
      await supabase.from("gym_program_days" as any).insert(days as any);

      setOpen(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Dumbbell size={18} strokeWidth={1.5} className="text-primary" />
          <h2 className="text-base font-semibold">{t("gym.title")}</h2>
        </div>
        <div className="rounded-lg bg-card flex flex-col items-center justify-center py-8 gap-3 px-6">
          <p className="text-sm font-medium text-center">{t("gym.wizard.title")}</p>
          <p className="text-xs text-muted-foreground text-center">{t("gym.wizard.subtitle")}</p>
          <button
            onClick={handleOpen}
            className="mt-2 min-h-[44px] px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
          >
            {t("gym.wizard.cta")}
          </button>
        </div>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader>
            <DrawerTitle>{t("gym.wizard.title")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 flex flex-col gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("gym.wizard.howManyDays")}</label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={7}
                value={numDays}
                onChange={(e) => handleNumChange(parseInt(e.target.value) || 1)}
                className="bg-background border-border w-20"
              />
            </div>
            <div className="flex flex-col gap-2">
              {dayNames.map((name, i) => (
                <Input
                  key={i}
                  value={name}
                  onChange={(e) => {
                    const updated = [...dayNames];
                    updated[i] = e.target.value;
                    setDayNames(updated);
                  }}
                  placeholder={dayPlaceholder(i)}
                  className="bg-background border-border"
                />
              ))}
            </div>
          </div>
          <DrawerFooter>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full min-h-[48px] rounded-lg bg-primary text-primary-foreground font-medium text-base disabled:opacity-40"
            >
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mx-auto" /> : t("gym.wizard.createPlan")}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
