import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import { useUserCards } from "@/hooks/useUserCards";

import { AVAILABLE_CARDS, getCardName, getCardDescription } from "@/lib/cards";
import { ChevronRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import type { CardDefinition } from "@/lib/cards";
import type { Database } from "@/integrations/supabase/types";

type AreaType = Database["public"]["Enums"]["area_type"];

interface CardEntryPointsProps {
  section: AreaType;
  areas: { id: string; name: string }[];
}

export function CardEntryPoints({ section, areas }: CardEntryPointsProps) {
  const { locale, t } = useI18n();
  const { getCardsForSection, getUserCard } = useUserCards();
  
  const navigate = useNavigate();
  const [previewCard, setPreviewCard] = useState<CardDefinition | null>(null);

  const sectionCards = getCardsForSection(section);
  if (sectionCards.length === 0) return null;

  const isConfigured = (card: CardDefinition): boolean => {
    const uc = getUserCard(card.id);
    if (!uc?.area_id) return false;
    return true;
  };

  return (
    <>
      {sectionCards.map((card) => {
        const configured = isConfigured(card);
        const Icon = card.icon;

        const badgeLabel = configured ? t("cards.configured") : t("cards.notConfigured");
        const badgeColor = configured ? "text-primary" : "text-accent";

        return (
          <button
            key={card.id}
            onClick={() => setPreviewCard(card)}
            className="flex items-center gap-3 rounded-lg bg-primary/5 border border-dashed border-primary/20 px-4 min-h-[48px] hover:opacity-90 transition-opacity"
          >
            <Icon size={20} strokeWidth={1.5} className="text-primary flex-shrink-0" />
            <span className="text-base text-foreground truncate flex-1 text-left">{getCardName(card, locale)}</span>
            <span className={`text-xs flex-shrink-0 ${badgeColor}`}>{badgeLabel}</span>
            <ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0" />
          </button>
        );
      })}

      {/* Bottom sheet preview */}
      <Drawer open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
        <DrawerContent className="pb-8">
          {previewCard && (
            <div className="flex flex-col items-center gap-4 px-6 pt-6">
              <previewCard.icon size={40} strokeWidth={1.5} className="text-primary" />
              <DrawerHeader className="p-0 text-center">
                <DrawerTitle className="text-lg">{getCardName(previewCard, locale)}</DrawerTitle>
                <DrawerDescription className="text-sm text-muted-foreground mt-1">
                  {previewCard.id === "gym"
                    ? (locale === "it"
                      ? "Registra la sessione di oggi o modifica il tuo piano di allenamento."
                      : "Log today's session or edit your workout plan.")
                    : getCardDescription(previewCard, locale)}
                </DrawerDescription>
              </DrawerHeader>

              <span className={`text-xs ${isConfigured(previewCard) ? "text-primary" : "text-accent"}`}>
                {isConfigured(previewCard) ? t("cards.configured") : t("cards.notConfigured")}
              </span>

              {/* Primary CTA */}
              <button
                onClick={() => {
                  setPreviewCard(null);
                  navigate(previewCard.route);
                }}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
              >
                {previewCard.id === "gym"
                  ? (locale === "it" ? "Allenati oggi" : "Train today")
                  : t("cards.open")}
              </button>

              {/* Secondary CTA for gym only */}
              {previewCard.id === "gym" && (
                <button
                  onClick={() => {
                    setPreviewCard(null);
                    navigate("/cards/gym/edit");
                  }}
                  className="w-full h-12 rounded-xl ring-1 ring-border text-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
                >
                  {locale === "it" ? "Modifica piano" : "Edit plan"}
                </button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
