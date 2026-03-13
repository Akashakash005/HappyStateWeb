import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { PRIVATE_COLORS, PUBLIC_COLORS } from "../constants/colors";
import { getActiveCharacterMode, setActiveCharacterMode } from "../services/characterModeService";

const ThemeContext = createContext(null);

function applyColors(colors) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
}

export function ThemeProvider({ children }) {
  const [isPrivateMode, setIsPrivateMode] = useState(getActiveCharacterMode() === "private");

  useEffect(() => {
    applyColors(isPrivateMode ? PRIVATE_COLORS : PUBLIC_COLORS);
  }, [isPrivateMode]);

  const value = useMemo(
    () => ({
      isPrivateMode,
      modeClassName: isPrivateMode ? "theme-private" : "theme-public",
      setPrivateMode(nextValue) {
        const next = Boolean(nextValue);
        setIsPrivateMode(next);
        setActiveCharacterMode(next ? "private" : "public");
      },
    }),
    [isPrivateMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
