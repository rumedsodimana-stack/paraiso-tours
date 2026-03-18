import {
  defaultThemeId,
  themeIds,
  themeStorageKey,
} from "@/components/theme/theme-config";

const initialThemeScript = `
(() => {
  const storageKey = ${JSON.stringify(themeStorageKey)};
  const fallbackTheme = ${JSON.stringify(defaultThemeId)};
  const validThemes = new Set(${JSON.stringify(themeIds)});

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme = validThemes.has(storedTheme ?? "") ? storedTheme : fallbackTheme;
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = fallbackTheme;
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />;
}
