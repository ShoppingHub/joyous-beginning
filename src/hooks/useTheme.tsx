import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ColorPalette = "teal" | "ocean" | "sunset" | "forest";

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  palette: ColorPalette;
  setPalette: (p: ColorPalette) => void;
  resolvedMode: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  setMode: () => {},
  palette: "teal",
  setPalette: () => {},
  resolvedMode: "dark",
});

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

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
    <ThemeContext.Provider value={{ mode, setMode, palette, setPalette, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
