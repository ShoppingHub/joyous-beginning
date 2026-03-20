import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, LayoutGrid, TrendingDown, Palette } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/hooks/useI18n";
import { usePlusStatus } from "@/hooks/usePlusStatus";

const features = [
  { icon: LayoutGrid, titleKey: "plus.feature.cards" as const, descKey: "plus.feature.cards.desc" as const },
  { icon: TrendingDown, titleKey: "plus.feature.reduce" as const, descKey: "plus.feature.reduce.desc" as const },
  { icon: Palette, titleKey: "plus.feature.themes" as const, descKey: "plus.feature.themes.desc" as const },
];

export default function PlusPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isPlusActive } = usePlusStatus();
  const [showComingSoon, setShowComingSoon] = useState(false);

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
        <div className="flex justify-center">
          <span className="text-sm font-medium text-primary">{t("plus.active" as any)}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setShowComingSoon(true)}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
          >
            {t("plus.cta" as any)}
          </button>
          {showComingSoon && (
            <p className="text-sm text-muted-foreground">{t("plus.comingSoon" as any)}</p>
          )}
          <button
            onClick={() => setShowComingSoon(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("plus.restore" as any)}
          </button>
        </div>
      )}
    </motion.div>
  );
}
