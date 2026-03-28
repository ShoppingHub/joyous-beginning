import { createContext, useContext, ReactNode } from "react";

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
  isPlusActive: true,
  loading: false,
  isFeatureLocked: () => false,
  refreshPlusStatus: async () => {},
  disablePlus: async () => {},
  enablePlus: async () => {},
});

export function PlusProvider({ children }: { children: ReactNode }) {
  const value: PlusContextType = {
    isPlusActive: true,
    loading: false,
    isFeatureLocked: () => false,
    refreshPlusStatus: async () => {},
    disablePlus: async () => {},
    enablePlus: async () => {},
  };

  return (
    <PlusContext.Provider value={value}>
      {children}
    </PlusContext.Provider>
  );
}

export const usePlusStatus = () => useContext(PlusContext);
