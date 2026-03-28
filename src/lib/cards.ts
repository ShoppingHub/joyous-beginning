import { Dumbbell, TrendingUp, Apple } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AreaType = Database["public"]["Enums"]["area_type"];

export interface CardDefinition {
  id: string;
  section: AreaType;
  nameIT: string;
  nameEN: string;
  descriptionIT: string;
  descriptionEN: string;
  icon: typeof Dumbbell;
  route: string;
  requiresArea: boolean;
  areaDetection?: {
    type: AreaType;
    namePattern?: RegExp;
  };
}

export const AVAILABLE_CARDS: CardDefinition[] = [
  {
    id: "gym",
    section: "health",
    nameIT: "Scheda Palestra",
    nameEN: "Gym Card",
    descriptionIT: "Gestisci la tua scheda di allenamento e registra i carichi.",
    descriptionEN: "Manage your workout plan and log your weights.",
    icon: Dumbbell,
    route: "/cards/gym",
    requiresArea: true,
    areaDetection: { type: "health", namePattern: /gym|palestra/i },
  },
  {
    id: "diet",
    section: "health",
    nameIT: "Scheda Dieta",
    nameEN: "Diet Card",
    descriptionIT: "Gestisci il tuo schema alimentare e registra i pasti.",
    descriptionEN: "Manage your diet plan and log your meals.",
    icon: Apple,
    route: "/cards/diet",
    requiresArea: true,
    areaDetection: { type: "health", namePattern: /dieta|diet|alimentazione|nutrition/i },
  },
  {
    id: "finance_projection",
    section: "finance",
    nameIT: "Proiezione Finanze",
    nameEN: "Finance Projection",
    descriptionIT: "Visualizza la proiezione della tua traiettoria finanziaria.",
    descriptionEN: "View the projection of your financial trajectory.",
    icon: TrendingUp,
    route: "/cards/finance",
    requiresArea: true,
    areaDetection: { type: "finance" },
  },
];

export function getCardName(card: CardDefinition, locale: string): string {
  return locale === "it" ? card.nameIT : card.nameEN;
}

export function getCardDescription(card: CardDefinition, locale: string): string {
  return locale === "it" ? card.descriptionIT : card.descriptionEN;
}

export function matchCardForArea(areaType: AreaType, areaName: string): CardDefinition | undefined {
  return AVAILABLE_CARDS.find((c) => {
    if (!c.areaDetection) return false;
    if (c.areaDetection.type !== areaType) return false;
    if (c.areaDetection.namePattern && !c.areaDetection.namePattern.test(areaName)) return false;
    return true;
  });
}
