import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboarding, AreaDraft } from "@/pages/OnboardingLayout";
import { useI18n } from "@/hooks/useI18n";
import { AreaTypePill } from "@/components/AreaTypePill";
import { Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import type { TranslationKey } from "@/i18n/translations";

const PRESET_KEYS: { nameKey: TranslationKey; type: "health" | "study" | "reduce" | "finance" }[] = [
  { nameKey: "onboarding.areas.preset.morning", type: "health" },
  { nameKey: "onboarding.areas.preset.reading", type: "study" },
  { nameKey: "onboarding.areas.preset.screen", type: "reduce" },
  { nameKey: "onboarding.areas.preset.saving", type: "finance" },
];

export default function OnboardingAreas() {
  const { areas, setAreas } = useOnboarding();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");

  const presets: (AreaDraft & { key: TranslationKey })[] = PRESET_KEYS.map((p) => ({
    name: t(p.nameKey),
    type: p.type,
    frequency: 7,
    isPreset: true,
    key: p.nameKey,
  }));

  const isSelected = (name: string) => areas.some((a) => a.name === name);

  const togglePreset = (preset: AreaDraft) => {
    if (isSelected(preset.name)) {
      setAreas(areas.filter((a) => a.name !== preset.name));
    } else {
      setAreas([...areas, preset]);
    }
  };

  const addCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed || isSelected(trimmed)) return;
    setAreas([...areas, { name: trimmed, type: null, frequency: 7, isPreset: false }]);
    setCustomName("");
    setShowCustomInput(false);
  };

  const removeCustom = (name: string) => { setAreas(areas.filter((a) => a.name !== name)); };
  const customAreas = areas.filter((a) => !a.isPreset);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-1 flex-col gap-8">
      <h1 className="text-[28px] font-semibold leading-[1.2]">{t("onboarding.areas.title")}</h1>

      <div className="flex flex-wrap gap-3">
        {presets.map((preset) => {
          const selected = isSelected(preset.name);
          return (
            <button key={preset.key} onClick={() => togglePreset(preset)}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-base font-medium border transition-colors min-h-[44px] ${selected ? "bg-card border-primary text-foreground" : "bg-transparent border-border text-muted-foreground"}`}>
              {preset.name}
              {preset.type && <AreaTypePill type={preset.type} />}
            </button>
          );
        })}
      </div>

      {customAreas.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {customAreas.map((area) => (
            <div key={area.name} className="flex items-center gap-2 rounded-xl px-4 py-3 bg-card border border-primary text-foreground text-base font-medium min-h-[44px]">
              {area.name}
              <button onClick={() => removeCustom(area.name)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {showCustomInput ? (
        <div className="flex gap-2">
          <input autoFocus type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder={t("onboarding.areas.namePlaceholder")}
            className="flex-1 h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
          <button onClick={addCustom} disabled={!customName.trim()} className="h-12 px-4 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 min-h-[44px]">{t("onboarding.areas.addButton")}</button>
        </div>
      ) : (
        <button onClick={() => setShowCustomInput(true)} className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity min-h-[44px]">
          <Plus size={16} />{t("onboarding.areas.addCustom")}
        </button>
      )}

      <div className="mt-auto pt-8">
        <button onClick={() => navigate("/onboarding/frequency")} disabled={areas.length === 0}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
          {t("onboarding.areas.continue")}
        </button>
      </div>
    </motion.div>
  );
}
