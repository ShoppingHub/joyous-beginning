import { useNavigate } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";
import { AVAILABLE_CARDS, getCardName, getCardDescription } from "@/lib/cards";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

const CardsHub = () => {
  const { t, locale } = useI18n();
  const { enabledCards } = useUserCards();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col px-4 pt-6 pb-8 gap-6"
    >
      <h1 className="text-xl font-semibold">{t("nav.cards")}</h1>

      <div className="flex flex-col gap-3">
        {enabledCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => navigate(card.id === "gym" ? "/cards/gym/edit" : card.route)}
              className="flex items-center gap-3 rounded-xl bg-card ring-1 ring-border px-4 py-4 text-left hover:opacity-90 transition-opacity min-h-[44px]"
            >
              <Icon size={24} strokeWidth={1.5} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium">{getCardName(card, locale)}</p>
                <p className="text-xs text-muted-foreground">{getCardDescription(card, locale)}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>

      {enabledCards.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {locale === "it" ? "Nessuna scheda attiva. Attivale nelle Impostazioni." : "No cards enabled. Enable them in Settings."}
        </p>
      )}
    </motion.div>
  );
};

export default CardsHub;
