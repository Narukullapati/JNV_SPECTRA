export const THEMES = [
  { id: "gold", label: "JNV Gold" },
  { id: "purple", label: "JNV Purple" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "jnv-theme";
const CLASSES = ["theme-gold", "theme-purple", "dark"];

export function getTheme(): ThemeId {
  const t = localStorage.getItem(KEY) as ThemeId | null;
  return t && THEMES.some((x) => x.id === t) ? t : "gold";
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  root.classList.remove(...CLASSES);
  if (id === "dark") root.classList.add("dark");
  else if (id !== "light") root.classList.add(`theme-${id}`);
  localStorage.setItem(KEY, id);
}

applyTheme(getTheme());
