import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { LayoutDashboard, Activity, TrendingUp, BarChart2, Settings } from "lucide-react";
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
  extraTabEnabled: boolean;
  setExtraTabEnabled: (enabled: boolean) => void;
  loading: boolean;
}

const NavConfigContext = createContext<NavConfigContextType>({
  items: [],
  visibleItems: [],
  extraTabEnabled: false,
  setExtraTabEnabled: () => {},
  loading: true,
});

export function NavConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const [extraTabEnabled, setExtraTabEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setExtraTabEnabledState(false);
      setLoading(false);
      return;
    }
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("extra_tab_enabled")
        .eq("user_id", user.id)
        .single();
      if (data) setExtraTabEnabledState((data as any).extra_tab_enabled ?? false);
      setLoading(false);
    })();
  }, [user, isDemo]);

  const setExtraTabEnabled = useCallback((enabled: boolean) => {
    setExtraTabEnabledState(enabled);
    if (user && !isDemo) {
      supabase
        .from("users")
        .update({ extra_tab_enabled: enabled } as any)
        .eq("user_id", user.id)
        .then();
    }
  }, [user, isDemo]);

  const items: NavItem[] = [
    { key: "home", to: "/", icon: LayoutDashboard, labelKey: "nav.home", visible: true },
    { key: "activities", to: "/activities", icon: Activity, labelKey: "nav.activities", visible: true },
    { key: "progress", to: "/progress", icon: TrendingUp, labelKey: "nav.progress", visible: true },
    { key: "finance", to: "/finance", icon: BarChart2, labelKey: "nav.finance", visible: extraTabEnabled },
    { key: "settings", to: "/settings", icon: Settings, labelKey: "nav.settings", visible: true, isLast: true },
  ];

  const visibleItems = items.filter(i => i.visible);

  return (
    <NavConfigContext.Provider value={{ items, visibleItems, extraTabEnabled, setExtraTabEnabled, loading }}>
      {children}
    </NavConfigContext.Provider>
  );
}

export const useNavConfig = () => useContext(NavConfigContext);
