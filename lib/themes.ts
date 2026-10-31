// Реестр тем оформления. Каждая тема — набор CSS-переменных в globals.css
// ([data-theme="..."]), применяется к <html>. Каждый аккаунт выбирает свою тему
// (User.theme), выбор сохраняется на сервере и в localStorage.

export interface ThemeDef {
  id: string; // "" и "zinc-dark" обслуживаются классом .dark без data-theme
  name: string;
  dark: boolean;
  swatch: { bg: string; primary: string; accent: string }; // hex для превью в пикере
}

export const THEMES: ThemeDef[] = [
  { id: "", name: "Стандартная светлая", dark: false, swatch: { bg: "#ffffff", primary: "#18181b", accent: "#10b981" } },
  { id: "zinc-dark", name: "Стандартная тёмная", dark: true, swatch: { bg: "#09090b", primary: "#fafafa", accent: "#34d399" } },
  { id: "emerald", name: "Изумрудная", dark: false, swatch: { bg: "#f2faf5", primary: "#047857", accent: "#10b981" } },
  { id: "emerald-dark", name: "Изумрудная ночь", dark: true, swatch: { bg: "#0c1f18", primary: "#34d399", accent: "#6ee7b7" } },
  { id: "ocean", name: "Океан", dark: false, swatch: { bg: "#f0f6fd", primary: "#1d4ed8", accent: "#3b82f6" } },
  { id: "ocean-dark", name: "Глубина", dark: true, swatch: { bg: "#0b1220", primary: "#60a5fa", accent: "#38bdf8" } },
  { id: "sky", name: "Небесная", dark: false, swatch: { bg: "#f2f9ff", primary: "#0284c7", accent: "#38bdf8" } },
  { id: "sunset", name: "Закат", dark: false, swatch: { bg: "#fdf5ef", primary: "#ea580c", accent: "#f97316" } },
  { id: "sunset-dark", name: "Сумерки", dark: true, swatch: { bg: "#16101f", primary: "#fb923c", accent: "#e879f9" } },
  { id: "rose", name: "Роза", dark: false, swatch: { bg: "#fdf3f4", primary: "#e11d48", accent: "#fb7185" } },
  { id: "grape", name: "Виноград", dark: false, swatch: { bg: "#f8f4fd", primary: "#7c3aed", accent: "#a78bfa" } },
  { id: "forest", name: "Лес", dark: true, swatch: { bg: "#0d1a10", primary: "#4ade80", accent: "#a3e635" } },
  { id: "coffee", name: "Кофе", dark: true, swatch: { bg: "#1a1410", primary: "#d6a35c", accent: "#f0c48c" } },
  { id: "mono", name: "Контраст", dark: false, swatch: { bg: "#ffffff", primary: "#000000", accent: "#525252" } },
  { id: "mono-dark", name: "Чёрная", dark: true, swatch: { bg: "#000000", primary: "#ffffff", accent: "#a3a3a3" } },
  { id: "neon", name: "Неон", dark: true, swatch: { bg: "#0d0618", primary: "#22d3ee", accent: "#e879f9" } },
  { id: "sand", name: "Песок", dark: false, swatch: { bg: "#faf6ec", primary: "#92702c", accent: "#d6b25c" } },
  { id: "crimson", name: "Кримсон", dark: true, swatch: { bg: "#190d10", primary: "#f87171", accent: "#fb923c" } },
];

export function themeById(id: string): ThemeDef | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Применить тему к <html> и запомнить выбор в localStorage (только клиент) */
export function applyTheme(id: string): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const theme = themeById(id);
  const effective = theme ? id : "";
  el.classList.toggle("dark", Boolean(theme?.dark));
  // Стандартные (светлая/тёмная) живут на :root/.dark — data-theme не нужен
  if (effective === "" || effective === "zinc-dark") {
    el.removeAttribute("data-theme");
  } else {
    el.setAttribute("data-theme", effective);
  }
  try {
    localStorage.setItem("crm-theme", effective);
  } catch {
    // приватный режим — не критично
  }
}

/** Тема из localStorage (мгновенное применение до ответа сервера) */
export function storedTheme(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("crm-theme") ?? "";
  } catch {
    return "";
  }
}
