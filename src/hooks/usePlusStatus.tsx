import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";

type PlusFeature = "cards" | "quantity_reduce" | "themes_extra";

interface PlusContextType {
  isPlusActive: boolean;
  loading: boolean;
  isFeatureLocked: (feature: PlusFeature) => boolean;
}

const PlusContext = createContext<PlusContextType>({
  isPlusActive: false,
  loading: true,
  isFeatureLocked: () => true,
});

export function PlusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const [isPlusActive, setIsPlusActive] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const { data } = await supabase
        .from("users")
        .select("plus_active")
        .eq("user_id", user.id)
        .single();
      setIsPlusActive((data as any)?.plus_active ?? false);
      setLoading(false);
    })();
  }, [user, isDemo]);

  const isFeatureLocked = (feature: PlusFeature) => !isPlusActive;

  return (
    <PlusContext.Provider value={{ isPlusActive, loading, isFeatureLocked }}>
      {children}
    </PlusContext.Provider>
  );
}

export const usePlusStatus = () => useContext(PlusContext);
