"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  defaultThemeId,
  isThemeId,
  themeStorageKey,
  themes,
  type ThemeId,
} from "@/components/theme/theme-config";

type ThemeContextValue = {
  ready: boolean;
  setTheme: (theme: ThemeId) => void;
  theme: ThemeId;
  themes: typeof themes;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}

function resolveTheme(): ThemeId {
  if (typeof window === "undefined") {
    return defaultThemeId;
  }

  const activeTheme = document.documentElement.dataset.theme;
  if (isThemeId(activeTheme)) {
    return activeTheme;
  }

  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (isThemeId(storedTheme)) {
      return storedTheme;
    }
  } catch {
    return defaultThemeId;
  }

  return defaultThemeId;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => resolveTheme());
  const ready = typeof window !== "undefined";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== themeStorageKey || !isThemeId(event.newValue)) {
        return;
      }

      applyTheme(event.newValue);
      setThemeState(event.newValue);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function setTheme(nextTheme: ThemeId) {
    applyTheme(nextTheme);
    setThemeState(nextTheme);

    try {
      window.localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // Ignore storage failures and keep the theme applied for this session.
    }
  }

  return (
    <ThemeContext.Provider value={{ ready, setTheme, theme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}
