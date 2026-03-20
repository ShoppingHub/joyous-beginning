import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useTheme } from "@/hooks/useTheme";

type PlusFeature = "cards" | "quantity_reduce" | "themes_extra";

interface PlusContextType {
  isPlusActive: boolean;
  loading: boolean;
  isFeatureLocked: (feature: PlusFeature) => boolean;
  refreshPlusStatus: () => Promise<void>;
}

const PlusContext = createContext<PlusContextType>({
  isPlusActive: false,
  loading: true,
  isFeatureLocked: () => true,
  refreshPlusStatus: async () => {},
});

export function PlusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { resetIfLocked } = useTheme();
  const [isPlusActive, setIsPlusActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      if (data?.subscribed !== undefined) {
        setIsPlusActive(data.subscribed);
        resetIfLocked(data.subscribed);
      }
    } catch (err) {
      console.error("check-subscription error:", err);
    }
  }, [user, resetIfLocked]);

  const loadFromDB = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("plus_active")
      .eq("user_id", user.id)
      .single();
    const active = (data as any)?.plus_active ?? false;
    setIsPlusActive(active);
    resetIfLocked(active);
  }, [user, resetIfLocked]);

  useEffect(() => {
    if (isDemo) {
      setIsPlusActive(false);
      setLoading(false);
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }
    // Load from DB first (fast), then verify with Stripe
    (async () => {
      await loadFromDB();
      setLoading(false);
      // Background check with Stripe
      checkSubscription();
    })();

    // Periodic check every 60s
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, isDemo, loadFromDB, checkSubscription]);

  const refreshPlusStatus = useCallback(async () => {
    await checkSubscription();
  }, [checkSubscription]);

  const isFeatureLocked = (feature: PlusFeature) => !isPlusActive;

  return (
    <PlusContext.Provider value={{ isPlusActive, loading, isFeatureLocked, refreshPlusStatus }}>
      {children}
    </PlusContext.Provider>
  );
}

export const usePlusStatus = () => useContext(PlusContext);
