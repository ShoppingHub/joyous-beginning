import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { usePlusStatus } from "@/hooks/usePlusStatus";
import { useUserCards } from "@/hooks/useUserCards";
import { ArrowLeft, Loader2, Dumbbell, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { matchCardForArea, getCardName } from "@/lib/cards";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/i18n/translations";

type AreaType = Database["public"]["Enums"]["area_type"];
const typeOptions: AreaType[] = ["health", "study", "reduce", "finance", "career"];

const typeLabelKeys: Record<AreaType, TranslationKey> = {
  health: "areaType.health",
  study: "areaType.study",
  reduce: "areaType.reduce",
  finance: "areaType.finance",
  career: "areaType.career",
};

// Day labels (1=Mon..7=Sun)
const DAY_KEYS = [1, 2, 3, 4, 5, 6, 7] as const;

interface AreaFormProps { mode: "add" | "edit"; }

export default function AreaForm({ mode }: AreaFormProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { isPlusActive } = usePlusStatus();
  const navigate = useNavigate();
  const { isCardEnabled, toggleCard, refetch: refetchCards } = useUserCards();

  const preselectedType = searchParams.get("type") as AreaType | null;
  const [name, setName] = useState("");
  const [type, setType] = useState<AreaType | null>(mode === "add" && preselectedType && typeOptions.includes(preselectedType) ? preselectedType : null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [typeError, setTypeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(mode === "edit");

  // Reduce tracking mode fields
  const [trackingMode, setTrackingMode] = useState<"binary" | "quantity_reduce">("binary");
  const [unitLabel, setUnitLabel] = useState("");
  const [baselineInitial, setBaselineInitial] = useState<string>("");
  const [unitLabelError, setUnitLabelError] = useState("");
  const [baselineError, setBaselineError] = useState("");
  const [showQuickAddHome, setShowQuickAddHome] = useState(true);
  const [isGymTemplate, setIsGymTemplate] = useState(false);
  const [cardSuggestion, setCardSuggestion] = useState<{ cardType: string; cardName: string; route: string; areaId: string } | null>(null);

  // Recurrence
  const [recurrenceType, setRecurrenceType] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [biweeklyStartDate, setBiweeklyStartDate] = useState<string>(() => {
    // Default to current Monday
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split("T")[0];
  });
  const [selectedMonthlyDays, setSelectedMonthlyDays] = useState<number[]>([]);

  // Google Tasks sync
  const [googleTasksSync, setGoogleTasksSync] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  const dayLabels = locale === "it"
    ? ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  useEffect(() => {
    if (!user) return;
    supabase
      .from("google_oauth_tokens")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setGoogleConnected(data?.status === "active");
      });
  }, [user]);

  useEffect(() => {
    if (mode !== "edit" || !id || !user) return;
    (async () => {
      const [areaRes, daysRes, monthlyRes] = await Promise.all([
        supabase.from("areas").select("*").eq("id", id).single(),
        supabase.from("area_scheduled_days").select("day_of_week").eq("area_id", id).eq("user_id", user.id),
        supabase.from("area_monthly_days" as any).select("day_of_month").eq("area_id", id).eq("user_id", user.id),
      ]);
      if (areaRes.data) {
        const data = areaRes.data;
        setName(data.name);
        setType(data.type);
        setTrackingMode((data.tracking_mode as "binary" | "quantity_reduce") || "binary");
        setUnitLabel(data.unit_label || "");
        setBaselineInitial(data.baseline_initial != null ? String(data.baseline_initial) : "");
        setShowQuickAddHome(data.show_quick_add_home ?? true);
        setGoogleTasksSync(data.google_tasks_sync ?? false);
        setRecurrenceType((data.recurrence_type as "weekly" | "biweekly" | "monthly") || "weekly");
        if (data.biweekly_start_date) setBiweeklyStartDate(data.biweekly_start_date);
      }
      if (daysRes.data && daysRes.data.length > 0) {
        setSelectedDays(daysRes.data.map(d => d.day_of_week));
      }
      if (monthlyRes.data && (monthlyRes.data as any[]).length > 0) {
        setSelectedMonthlyDays((monthlyRes.data as any[]).map((d: any) => d.day_of_month));
      }
      setLoadingData(false);
    })();
  }, [mode, id, user]);

  const isReduce = type === "reduce";
  const isQuantity = isReduce && trackingMode === "quantity_reduce";
  const isBinary = trackingMode === "binary";

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleMonthlyDay = (day: number) => {
    setSelectedMonthlyDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const frequency = recurrenceType === "monthly"
    ? selectedMonthlyDays.length > 0 ? selectedMonthlyDays.length : 4
    : selectedDays.length > 0 ? selectedDays.length : 7;

  const validate = (): boolean => {
    if (!name.trim()) return false;
    if (!type) { setTypeError(t("areaForm.typeError")); return false; }
    if (isQuantity) {
      let valid = true;
      if (!unitLabel.trim()) { setUnitLabelError(t("reduce.unitLabelError")); valid = false; } else { setUnitLabelError(""); }
      if (baselineInitial === "") { setBaselineError(t("reduce.baselineError")); valid = false; } else { setBaselineError(""); }
      return valid;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!validate()) return;
    setTypeError(""); setSaving(true); setError("");

    const payload: Record<string, unknown> = {
      name: name.trim(),
      type,
      frequency_per_week: frequency,
      tracking_mode: isReduce ? trackingMode : "binary",
      unit_label: isQuantity ? unitLabel.trim() : null,
      baseline_initial: isQuantity ? parseInt(baselineInitial, 10) : null,
      show_quick_add_home: isQuantity ? showQuickAddHome : true,
      google_tasks_sync: isBinary ? googleTasksSync : false,
    };

    try {
      let savedAreaId: string | null = null;
      if (mode === "add") {
        const { data: inserted, error: insertError } = await supabase.from("areas").insert({ user_id: user.id, ...payload } as any).select("id").single();
        if (insertError) throw insertError;
        savedAreaId = inserted?.id ?? null;
      } else if (id) {
        const { error: updateError } = await supabase.from("areas").update(payload as any).eq("id", id);
        if (updateError) throw updateError;
        savedAreaId = id;
      }

      // Save scheduled days
      if (savedAreaId) {
        await supabase.from("area_scheduled_days").delete().eq("area_id", savedAreaId).eq("user_id", user.id);
        if (selectedDays.length > 0) {
          await supabase.from("area_scheduled_days").insert(
            selectedDays.map(day => ({
              area_id: savedAreaId!,
              user_id: user.id,
              day_of_week: day,
            }))
          );
        }
      }

      // Trigger Google Tasks sync if enabled
      const syncEnabled = isBinary ? googleTasksSync : false;
      if (syncEnabled && savedAreaId && googleConnected) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.functions.invoke("sync-google-tasks", {
            body: { area_id: savedAreaId },
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch((err) => console.error("Sync trigger failed:", err));
        }
      }

      if (mode === "add" && savedAreaId && type) {
        const matchedCard = matchCardForArea(type, name.trim());
        if (matchedCard && !isCardEnabled(matchedCard.id)) {
          setCardSuggestion({ cardType: matchedCard.id, cardName: getCardName(matchedCard, locale), route: matchedCard.route, areaId: savedAreaId });
          setSaving(false);
          return;
        }
        navigate("/", { replace: true });
      } else {
        navigate(`/activities/${id}`, { replace: true });
      }
    } catch { setError(t("areaForm.error")); setSaving(false); }
  };

  const handleArchive = async () => {
    if (!id) return;
    setArchiving(true); setError("");
    try {
      const { error: archiveError } = await supabase.from("areas").update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (archiveError) throw archiveError;
      navigate("/", { replace: true });
    } catch { setError(t("areaForm.error")); setArchiving(false); }
  };

  const isValid = name.trim().length > 0 && type !== null && (!isQuantity || (unitLabel.trim().length > 0 && baselineInitial !== ""));

  if (loadingData) {
    return (<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col min-h-full px-4 pt-2 pb-8">
      {/* Header with back + title + save */}
      <div className="flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(mode === "edit" ? `/activities/${id}` : "/")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </button>
          <h1 className="text-[18px] font-semibold">{mode === "add" ? t("areaForm.add.title") : t("areaForm.edit.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={!isValid || saving}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[36px]">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {mode === "add" ? t("areaForm.add.button") : t("areaForm.edit.button")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 mt-4 flex-1">
        {/* Name */}
        <div className="space-y-2">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={type ? t(`areaForm.namePlaceholder.${type}` as any) : t("areaForm.namePlaceholder")}
            className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
        </div>

        {/* Type dropdown */}
        <div className="space-y-2">
          <Select
            value={type || ""}
            onValueChange={(val) => { setType(val as AreaType); setTypeError(""); if (val !== "reduce") setTrackingMode("binary"); }}
          >
            <SelectTrigger className="w-full h-12 rounded-xl bg-card text-base ring-1 ring-border">
              <SelectValue placeholder={t("areaForm.typePlaceholder" as any)} />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((tp) => (
                <SelectItem key={tp} value={tp}>
                  {t(typeLabelKeys[tp])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {typeError && <p className="text-sm text-destructive">{typeError}</p>}

          {/* Gym template - only for Health in add mode */}
          {mode === "add" && type === "health" && (
            <button
              onClick={() => {
                const newVal = !isGymTemplate;
                setIsGymTemplate(newVal);
                if (newVal) setName(t("areaForm.gymTemplate" as any));
                else if (name === t("areaForm.gymTemplate" as any)) setName("");
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 border transition-colors mt-2 w-full ${
                isGymTemplate ? "bg-primary/10 border-primary text-foreground" : "bg-transparent border-border text-muted-foreground"
              }`}
            >
              <Dumbbell size={18} strokeWidth={1.5} />
              <div className="text-left">
                <p className="text-sm font-medium">{t("areaForm.gymTemplate" as any)}</p>
                <p className="text-xs text-muted-foreground">{t("areaForm.gymTemplateDesc" as any)}</p>
              </div>
            </button>
          )}
        </div>

        {/* Tracking mode - only for Reduce */}
        {isReduce && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("reduce.trackingLabel")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTrackingMode("binary")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors min-h-[36px] ${
                  trackingMode === "binary" ? "bg-primary/20 text-primary border-primary" : "bg-transparent border-border text-muted-foreground"
                }`}
              >
                {t("reduce.modeBinary")}
              </button>
              <button
                onClick={() => setTrackingMode("quantity_reduce")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors min-h-[36px] ${
                  trackingMode === "quantity_reduce" ? "bg-primary/20 text-primary border-primary" : "bg-transparent border-border text-muted-foreground"
                }`}
              >
                {t("reduce.modeQuantity")}
              </button>
            </div>

            {isQuantity && (
              <div className="space-y-4 mt-2">
                {!isPlusActive && (
                  <p className="text-sm text-primary">{t("plus.quantityFormWarning" as any)}</p>
                )}
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">{t("reduce.unitLabelLabel")}</label>
                  <input
                    type="text" value={unitLabel}
                    onChange={(e) => { setUnitLabel(e.target.value); setUnitLabelError(""); }}
                    placeholder={t("reduce.unitLabelPlaceholder")}
                    className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors"
                  />
                  {unitLabelError && <p className="text-sm text-destructive">{unitLabelError}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">{t("reduce.baselineLabel")}</label>
                  <input
                    type="number" inputMode="numeric" min={0} value={baselineInitial}
                    onChange={(e) => { setBaselineInitial(e.target.value); setBaselineError(""); }}
                    placeholder={t("reduce.baselinePlaceholder")}
                    className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors"
                  />
                  {baselineError && <p className="text-sm text-destructive">{baselineError}</p>}
                </div>

                {mode === "edit" && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("reduce.showQuickAdd")}</span>
                    <button
                      onClick={() => setShowQuickAddHome(!showQuickAddHome)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${showQuickAddHome ? "bg-primary" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-foreground rounded-full transition-transform ${showQuickAddHome ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Day of week picker */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {locale === "it" ? "Giorni della settimana" : "Days of the week"}
            {selectedDays.length > 0 && (
              <span className="ml-1 text-foreground font-medium">({selectedDays.length}x)</span>
            )}
            {selectedDays.length === 0 && (
              <span className="ml-1 text-muted-foreground/60">
                ({locale === "it" ? "ogni giorno" : "every day"})
              </span>
            )}
          </p>
          <div className="flex gap-1.5">
            {DAY_KEYS.map((day, i) => {
              const selected = selectedDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-card ring-1 ring-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {dayLabels[i]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Google Tasks Sync Toggle - only for binary tracking */}
        {isBinary && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{t("areaForm.googleTasksSync")}</p>
                <p className="text-xs text-muted-foreground">
                  {googleConnected ? t("areaForm.googleTasksSyncDesc") : t("areaForm.googleTasksSyncConnect")}
                </p>
              </div>
              <Switch checked={googleTasksSync} onCheckedChange={setGoogleTasksSync} disabled={!googleConnected} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Archive button at bottom for edit mode */}
        {mode === "edit" && (
          <button onClick={handleArchive} disabled={archiving}
            className="w-full text-sm text-destructive hover:opacity-80 transition-opacity min-h-[44px] flex items-center justify-center gap-2 mt-4">
            {archiving && <Loader2 size={16} className="animate-spin" />}
            {t("areaForm.archive")}
          </button>
        )}
      </div>
    </motion.div>

    {/* Card suggestion overlay */}
    <AnimatePresence>
      {cardSuggestion && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-x-0 bottom-0 z-50 p-4 pb-8"
        >
          <div className="rounded-2xl bg-card ring-1 ring-border p-5 shadow-lg flex flex-col gap-3">
            <p className="text-base font-medium text-foreground text-center">
              {t("cards.suggest")} {cardSuggestion.cardName}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  toggleCard(cardSuggestion.cardType, true);
                  // Also link area_id
                  if (user) {
                    supabase.from("user_cards" as any)
                      .update({ area_id: cardSuggestion.areaId } as any)
                      .eq("user_id", user.id)
                      .eq("card_type", cardSuggestion.cardType)
                      .then(() => refetchCards());
                  }
                  navigate(cardSuggestion.route, { replace: true });
                }}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
              >
                {t("cards.suggestSetup")}
              </button>
              <button
                onClick={() => { setCardSuggestion(null); navigate("/", { replace: true }); }}
                className="flex-1 h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                {t("cards.suggestNotNow")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
