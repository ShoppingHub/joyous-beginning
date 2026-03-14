import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export type AreaDraft = {
  name: string;
  type: "health" | "study" | "reduce" | "finance" | null;
  frequency: number;
  isPreset: boolean;
};

export type OnboardingState = {
  areas: AreaDraft[];
  setAreas: (areas: AreaDraft[]) => void;
};

import { createContext, useContext } from "react";

const OnboardingContext = createContext<OnboardingState>({
  areas: [],
  setAreas: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

export default function OnboardingLayout() {
  const { session, loading } = useAuth();
  const [areas, setAreas] = useState<AreaDraft[]>([]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <OnboardingContext.Provider value={{ areas, setAreas }}>
      <div className="flex min-h-screen flex-col max-w-[428px] mx-auto px-4 pt-6 pb-8">
        <Outlet />
      </div>
    </OnboardingContext.Provider>
  );
}
