import { createContext, useContext, useState, ReactNode } from "react";

interface DemoContextType {
  isDemo: boolean;
  enableDemo: () => void;
  disableDemo: () => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemo: false,
  enableDemo: () => {},
  disableDemo: () => {},
});

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => {
    return sessionStorage.getItem("demo_mode") === "true";
  });

  const enableDemo = () => {
    sessionStorage.setItem("demo_mode", "true");
    setIsDemo(true);
  };

  const disableDemo = () => {
    sessionStorage.removeItem("demo_mode");
    setIsDemo(false);
  };

  return (
    <DemoContext.Provider value={{ isDemo, enableDemo, disableDemo }}>
      {children}
    </DemoContext.Provider>
  );
}

export const useDemo = () => useContext(DemoContext);
