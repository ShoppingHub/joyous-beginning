import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
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
  disablePlus: () => Promise<void>;
  enablePlus: () => Promise<void>;
}

const PlusContext = createContext<PlusContextType>({
  isPlusActive: false,
  loading: true,
  isFeatureLocked: () => true,
  refreshPlusStatus: async () => {},
  disablePlus: async () => {},
  enablePlus: async () => {},
});

export function PlusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { resetIfLocked } = useTheme();
  const [isPlusActive, setIsPlusActive] = useState(false);
  const [loading, setLoading] = useState(true);
  // When manually disabled, suppress background re-enable
  const manuallyDisabledRef = useRef(false);

  const checkSubscription = useCallback(async () => {
    if (!user) return;
    // Don't auto-re-enable if user manually disabled for testing
    if (manuallyDisabledRef.current) return;
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
    // If DB says disabled, respect it
    if (!active) manuallyDisabledRef.current = true;
    else manuallyDisabledRef.current = false;
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
    (async () => {
      await loadFromDB();
      setLoading(false);
      // Only background-check if not manually disabled
      if (!manuallyDisabledRef.current) {
        checkSubscription();
      }
    })();

    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, isDemo, loadFromDB, checkSubscription]);

  const refreshPlusStatus = useCallback(async () => {
    // Explicit refresh clears the manual disable flag
    manuallyDisabledRef.current = false;
    await checkSubscription();
  }, [checkSubscription]);

  const disablePlus = useCallback(async () => {
    if (!user && !isDemo) return;
    manuallyDisabledRef.current = true;
    if (user) {
      await supabase.from("users").update({ plus_active: false } as any).eq("user_id", user.id);
    }
    setIsPlusActive(false);
    resetIfLocked(false);
  }, [user, isDemo, resetIfLocked]);

  const enablePlus = useCallback(async () => {
    if (!user && !isDemo) return;
    manuallyDisabledRef.current = false;
    if (user) {
      await supabase.from("users").update({
        plus_active: true,
        plus_activated_at: new Date().toISOString(),
        plus_provider: "promo",
      } as any).eq("user_id", user.id);
    }
    setIsPlusActive(true);
  }, [user, isDemo]);

  const isFeatureLocked = (feature: PlusFeature) => !isPlusActive;

  return (
    <PlusContext.Provider value={{ isPlusActive, loading, isFeatureLocked, refreshPlusStatus, disablePlus, enablePlus }}>
      {children}
    </PlusContext.Provider>
  );
}

export const usePlusStatus = () => useContext(PlusContext);
