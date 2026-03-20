import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ColorPalette = "teal" | "ocean" | "sunset" | "forest";

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  palette: ColorPalette;
  setPalette: (p: ColorPalette) => void;
  resolvedMode: "dark" | "light";
  resetIfLocked: (isPlusActive: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  setMode: () => {},
  palette: "teal",
  setPalette: () => {},
  resolvedMode: "dark",
  resetIfLocked: () => {},
});

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const EXTRA_PALETTES: ColorPalette[] = ["ocean", "sunset", "forest"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    (localStorage.getItem("theme-mode") as ThemeMode) || "dark"
  );
  const [palette, setPaletteState] = useState<ColorPalette>(() =>
    (localStorage.getItem("theme-palette") as ColorPalette) || "teal"
  );

  const resolvedMode = mode === "system" ? getSystemTheme() : mode;

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem("theme-mode", m);
  }, []);

  const setPalette = useCallback((p: ColorPalette) => {
    setPaletteState(p);
    localStorage.setItem("theme-palette", p);
  }, []);

  const resetIfLocked = useCallback((isPlusActive: boolean) => {
    if (!isPlusActive && EXTRA_PALETTES.includes(palette)) {
      setPaletteState("teal");
      localStorage.setItem("theme-palette", "teal");
    }
  }, [palette]);

  // Apply classes to html
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(resolvedMode);
    root.setAttribute("data-palette", palette);
  }, [resolvedMode, palette]);

  // Listen for system theme changes
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setModeState((prev) => prev); // force re-render
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, palette, setPalette, resolvedMode, resetIfLocked }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
