import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useUserCards } from "@/hooks/useUserCards";
import { LayoutDashboard, Activity, TrendingUp, LayoutGrid } from "lucide-react";
import type { TranslationKey } from "@/i18n/translations";

export interface NavItem {
  key: string;
  to: string;
  icon: typeof LayoutDashboard;
  labelKey: TranslationKey;
  visible: boolean;
  isLast?: boolean;
}

interface NavConfigContextType {
  items: NavItem[];
  visibleItems: NavItem[];
  loading: boolean;
}

const NavConfigContext = createContext<NavConfigContextType>({
  items: [],
  visibleItems: [],
  loading: true,
});

export function NavConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { isCardEnabled, loading: cardsLoading } = useUserCards();

  const financeEnabled = isCardEnabled("finance_projection");
  const anyCardEnabled = isCardEnabled("gym") || financeEnabled;

  const items: NavItem[] = [
    { key: "home", to: "/", icon: LayoutDashboard, labelKey: "nav.home", visible: true },
    { key: "activities", to: "/activities", icon: Activity, labelKey: "nav.activities", visible: true },
    { key: "cards", to: "/cards", icon: LayoutGrid, labelKey: "nav.cards", visible: anyCardEnabled },
    { key: "progress", to: "/progress", icon: TrendingUp, labelKey: "nav.progress", visible: true },
  ];

  const visibleItems = items.filter(i => i.visible);

  return (
    <NavConfigContext.Provider value={{ items, visibleItems, loading: cardsLoading }}>
      {children}
    </NavConfigContext.Provider>
  );
}

export const useNavConfig = () => useContext(NavConfigContext);
