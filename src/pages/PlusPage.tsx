import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, LayoutGrid, TrendingDown, Palette, Loader2, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/hooks/useI18n";
import { usePlusStatus } from "@/hooks/usePlusStatus";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VALID_PROMO_CODES = ["MCAI2026"];

const features = [
  { icon: LayoutGrid, titleKey: "plus.feature.cards" as const, descKey: "plus.feature.cards.desc" as const },
  { icon: TrendingDown, titleKey: "plus.feature.reduce" as const, descKey: "plus.feature.reduce.desc" as const },
  { icon: Palette, titleKey: "plus.feature.themes" as const, descKey: "plus.feature.themes.desc" as const },
];

export default function PlusPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { isPlusActive, refreshPlusStatus, enablePlus } = usePlusStatus();
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);
  const [cancelMsg, setCancelMsg] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Handle return from Stripe
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccessMsg(true);
      refreshPlusStatus();
      setSearchParams({}, { replace: true });
      const timer = setTimeout(() => setSuccessMsg(false), 5000);
      return () => clearTimeout(timer);
    }
    if (searchParams.get("canceled") === "true") {
      setCancelMsg(true);
      setSearchParams({}, { replace: true });
      const timer = setTimeout(() => setCancelMsg(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams, refreshPlusStatus]);

  const handleActivate = async () => {
    setPromoError("");

    // Demo mode: instant activation
    if (isDemo) {
      setLoading(true);
      await enablePlus();
      setSuccessMsg(true);
      setLoading(false);
      setTimeout(() => setSuccessMsg(false), 5000);
      return;
    }

    // Promo code: validate and activate directly
    const trimmedCode = promoCode.trim().toUpperCase();
    if (trimmedCode) {
      if (VALID_PROMO_CODES.includes(trimmedCode)) {
        setLoading(true);
        await enablePlus();
        setSuccessMsg(true);
        setLoading(false);
        setTimeout(() => setSuccessMsg(false), 5000);
        return;
      } else {
        setPromoError(t("plus.promoInvalid" as any) || "Invalid promo code");
        return;
      }
    }

    // Normal Stripe checkout
    if (!user?.email) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { promoCode: trimmedCode || undefined },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col px-4 pt-2 pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 h-14">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={24} strokeWidth={1.5} />
        </button>
        <h1 className="text-[18px] font-semibold">Plus</h1>
      </div>

      {/* Success / Cancel messages */}
      {successMsg && (
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 mb-4 text-center">
          <p className="text-sm font-medium text-primary">{t("plus.success" as any)}</p>
        </div>
      )}
      {cancelMsg && (
        <div className="rounded-xl bg-muted p-4 mb-4 text-center">
          <p className="text-sm text-muted-foreground">{t("plus.canceled" as any)}</p>
        </div>
      )}

      {/* Hero */}
      <div className="flex flex-col items-center gap-3 mt-6 mb-8">
        <Sparkles size={40} strokeWidth={1.5} className="text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">opad.me Plus</h2>
        <p className="text-sm text-muted-foreground text-center max-w-[280px]">
          {t("plus.subtitle" as any)}
        </p>
      </div>

      {/* Feature cards */}
      <div className="flex flex-col gap-3 mb-8">
        {features.map(({ icon: Icon, titleKey, descKey }) => (
          <div
            key={titleKey}
            className="flex items-start gap-4 rounded-xl bg-card p-4 ring-1 ring-border"
          >
            <Icon size={24} strokeWidth={1.5} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-medium">{t(titleKey as any)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t(descKey as any)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {isPlusActive ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <span className="text-sm font-medium text-primary">{t("plus.active" as any)}</span>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          >
            {portalLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CreditCard size={16} />
            )}
            {t("plus.manage" as any)}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* Promo code - hidden in demo mode */}
          {!isDemo && (
            <div className="w-full">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromoError(""); }}
                placeholder={t("plus.promoPlaceholder" as any)}
                className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {promoError && <p className="text-sm text-destructive mt-1">{promoError}</p>}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {isDemo ? "Activating..." : t("plus.redirecting" as any)}
              </>
            ) : (
              isDemo ? t("plus.cta" as any) : t("plus.cta" as any)
            )}
          </button>

          {!isDemo && <p className="text-xs text-muted-foreground">{t("plus.price" as any)}</p>}

          {!isDemo && (
            <button
              onClick={async () => {
                setLoading(true);
                await refreshPlusStatus();
                setLoading(false);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("plus.restore" as any)}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
