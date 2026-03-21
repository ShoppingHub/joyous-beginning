import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { AVAILABLE_CARDS, type CardDefinition } from "@/lib/cards";
import type { Database } from "@/integrations/supabase/types";

type AreaType = Database["public"]["Enums"]["area_type"];

export interface UserCard {
  id: string;
  user_id: string;
  card_type: string;
  area_id: string | null;
  enabled: boolean;
  created_at: string;
}

interface UserCardsContextType {
  enabledCards: (CardDefinition & { userCard: UserCard })[];
  allUserCards: UserCard[];
  toggleCard: (cardType: string, enabled: boolean) => void;
  toggleAllCards: (enabled: boolean) => void;
  getCardsForSection: (section: AreaType) => (CardDefinition & { userCard?: UserCard })[];
  isCardEnabled: (cardType: string) => boolean;
  getUserCard: (cardType: string) => UserCard | undefined;
  loading: boolean;
  refetch: () => void;
}

const UserCardsContext = createContext<UserCardsContextType>({
  enabledCards: [],
  allUserCards: [],
  toggleCard: () => {},
  toggleAllCards: () => {},
  getCardsForSection: () => [],
  isCardEnabled: () => false,
  getUserCard: () => undefined,
  loading: true,
  refetch: () => {},
});

export function UserCardsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async () => {
    if (isDemo) {
      setUserCards([
        { id: "demo-card-gym", user_id: "demo", card_type: "gym", area_id: "demo-health-1", enabled: true, created_at: "" },
        { id: "demo-card-finance", user_id: "demo", card_type: "finance_projection", area_id: "demo-finance-1", enabled: true, created_at: "" },
      ]);
      setLoading(false);
      return;
    }
    if (!user) {
      // Reset state on logout
      setUserCards([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_cards" as any)
      .select("*")
      .eq("user_id", user.id);
    if (data) setUserCards(data as any as UserCard[]);
    setLoading(false);
  }, [user, isDemo]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const toggleCard = useCallback(async (cardType: string, enabled: boolean) => {
    if (!user || isDemo) return;
    const existing = userCards.find((c) => c.card_type === cardType);
    // Optimistic update
    if (existing) {
      setUserCards((prev) => prev.map((c) => c.card_type === cardType ? { ...c, enabled } : c));
      const { error } = await supabase
        .from("user_cards" as any)
        .update({ enabled } as any)
        .eq("id", existing.id);
      if (error) {
        setUserCards((prev) => prev.map((c) => c.card_type === cardType ? { ...c, enabled: !enabled } : c));
      }
    } else {
      const newCard: UserCard = {
        id: crypto.randomUUID(),
        user_id: user.id,
        card_type: cardType,
        area_id: null,
        enabled,
        created_at: new Date().toISOString(),
      };
      setUserCards((prev) => [...prev, newCard]);
      const { error } = await supabase
        .from("user_cards" as any)
        .insert({ user_id: user.id, card_type: cardType, enabled } as any);
      if (error) {
        setUserCards((prev) => prev.filter((c) => c.id !== newCard.id));
      } else {
        fetchCards(); // refetch to get real id
      }
    }
  }, [user, isDemo, userCards, fetchCards]);

  const toggleAllCards = useCallback(async (enabled: boolean) => {
    for (const card of AVAILABLE_CARDS) {
      toggleCard(card.id, enabled);
    }
  }, [toggleCard]);

  const enabledCards = AVAILABLE_CARDS
    .filter((c) => userCards.some((uc) => uc.card_type === c.id && uc.enabled))
    .map((c) => ({ ...c, userCard: userCards.find((uc) => uc.card_type === c.id)! }));

  const getCardsForSection = useCallback((section: AreaType) => {
    return AVAILABLE_CARDS
      .filter((c) => c.section === section)
      .filter((c) => userCards.some((uc) => uc.card_type === c.id && uc.enabled))
      .map((c) => ({ ...c, userCard: userCards.find((uc) => uc.card_type === c.id) }));
  }, [userCards]);

  const isCardEnabled = useCallback((cardType: string) => {
    return userCards.some((uc) => uc.card_type === cardType && uc.enabled);
  }, [userCards]);

  const getUserCard = useCallback((cardType: string) => {
    return userCards.find((uc) => uc.card_type === cardType);
  }, [userCards]);

  return (
    <UserCardsContext.Provider value={{ enabledCards, allUserCards: userCards, toggleCard, toggleAllCards, getCardsForSection, isCardEnabled, getUserCard, loading, refetch: fetchCards }}>
      {children}
    </UserCardsContext.Provider>
  );
}

export const useUserCards = () => useContext(UserCardsContext);
